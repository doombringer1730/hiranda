'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { applyMove, emptyBoard, GAMES, KINDS, type Board, type Kind } from './engine'
import { notifyPartner, myFirstName } from '@/lib/push'

export type BoardGame = {
  id: string
  kind: Kind
  board: Board
  player1: string
  player2: string
  turn: string | null
  status: 'active' | 'won' | 'draw'
  winner: string | null
  move_count: number
  updated_at: string
}

const FIELDS = 'id, kind, board, player1, player2, turn, status, winner, move_count, updated_at'

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Prefer the paired space if someone ended up in two rows (see (app)/layout).
  const { data: couples } = await supabase
    .from('couple')
    .select('id, user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('user2_id', { nullsFirst: false })
    .limit(1)
  const couple = couples?.[0]
  const partnerId = couple ? (couple.user1_id === user.id ? couple.user2_id : couple.user1_id) : null

  return { supabase, userId: user.id, coupleId: couple?.id ?? null, partnerId }
}

// The latest game of each kind (active or most recently finished).
export async function getLatestGames(): Promise<Partial<Record<Kind, BoardGame>>> {
  const { supabase, coupleId } = await getContext()
  if (!coupleId) return {}
  const results = await Promise.all(KINDS.map(kind =>
    supabase.from('board_games').select(FIELDS)
      .eq('couple_id', coupleId).eq('kind', kind)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
  ))
  const out: Partial<Record<Kind, BoardGame>> = {}
  KINDS.forEach((kind, i) => { if (results[i].data) out[kind] = results[i].data as BoardGame })
  return out
}

// Latest game of one kind — polled by the game screen so a partner's move or
// rematch shows up even if the realtime channel isn't delivering.
export async function getLatestGame(kind: Kind) {
  const { supabase, coupleId } = await getContext()
  if (!coupleId) return null
  const { data } = await supabase.from('board_games').select(FIELDS)
    .eq('couple_id', coupleId).eq('kind', kind)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  return data as BoardGame | null
}

// Head-to-head wins for one game kind.
export async function getRecord(kind: Kind) {
  const { supabase, coupleId } = await getContext()
  if (!coupleId) return {} as Record<string, number>
  const { data } = await supabase.from('board_games').select('winner')
    .eq('couple_id', coupleId).eq('kind', kind).eq('status', 'won')
  const tally: Record<string, number> = {}
  for (const r of data ?? []) if (r.winner) tally[r.winner] = (tally[r.winner] ?? 0) + 1
  return tally
}

export async function getGame(id: string) {
  const { supabase } = await getContext()
  const { data } = await supabase.from('board_games').select(FIELDS).eq('id', id).maybeSingle()
  return data as BoardGame | null
}

// Start a new game of `kind`, or return the one already in progress.
// Whoever went second last time goes first this time.
export async function startGame(kind: Kind): Promise<BoardGame> {
  if (!KINDS.includes(kind)) throw new Error('Unknown game')
  const { supabase, userId, coupleId, partnerId } = await getContext()
  if (!coupleId || !partnerId) throw new Error('Invite your partner to play')

  const { data: last } = await supabase.from('board_games').select(FIELDS)
    .eq('couple_id', coupleId).eq('kind', kind)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (last?.status === 'active') return last as BoardGame

  const first = last ? last.player2 : userId
  const second = first === userId ? partnerId : userId

  const { data, error } = await supabase.from('board_games').insert({
    couple_id: coupleId,
    kind,
    board: emptyBoard(kind),
    player1: first,
    player2: second,
    turn: first,
  }).select(FIELDS).single()
  if (error || !data) throw new Error('Could not start the game')

  const meta = GAMES[kind]
  notifyPartner(async () => ({
    title: `${await myFirstName()} started ${meta.name}`,
    body: first === userId ? 'They’re going first — watch for their move.' : 'You go first. Your move!',
    url: `/games/${meta.slug}`,
    tag: `game-${data.id}`,
  }))

  revalidatePath('/games')
  return data as BoardGame
}

export async function makeMove(gameId: string, move: number): Promise<{ game: BoardGame | null; error?: string }> {
  const { supabase, userId } = await getContext()
  const { data } = await supabase.from('board_games').select(FIELDS).eq('id', gameId).maybeSingle()
  const game = data as BoardGame | null
  if (!game) return { game: null, error: 'Game not found' }
  if (game.status !== 'active') return { game, error: 'This game is over' }
  if (game.turn !== userId) return { game, error: 'Not your turn' }

  const who = userId === game.player1 ? 1 : 2
  const other = who === 1 ? game.player2 : game.player1
  let result
  try {
    result = applyMove(game.kind, game.board, move, who)
  } catch (e) {
    return { game, error: e instanceof Error ? e.message : 'Invalid move' }
  }

  const done = result.winner !== null
  const patch = {
    board: result.board,
    move_count: game.move_count + 1,
    updated_at: new Date().toISOString(),
    turn: done ? null : result.extraTurn ? userId : other,
    status: done ? (result.winner === 0 ? 'draw' : 'won') : 'active',
    winner: done && result.winner ? (result.winner === 1 ? game.player1 : game.player2) : null,
  }

  // Optimistic lock: only lands if nobody moved since we read the row.
  const { data: updated } = await supabase.from('board_games').update(patch)
    .eq('id', gameId).eq('move_count', game.move_count)
    .select(FIELDS).maybeSingle()
  if (!updated) return { game: await getGame(gameId), error: 'The board changed — try again' }

  // Tell the partner when the ball is in their court (or the game ended).
  if (done || patch.turn === other) {
    const meta = GAMES[game.kind]
    notifyPartner(async () => {
      const me = await myFirstName()
      return {
        title: done ? (result.winner === 0 ? `${meta.name}: it’s a draw` : `${me} won ${meta.name}`) : `Your move in ${meta.name}`,
        body: done ? (result.winner === 0 ? 'Rematch?' : 'Rematch? 😤') : `${me} just played.`,
        url: `/games/${meta.slug}`,
        tag: `game-${gameId}`,
      }
    })
  }

  if (done) revalidatePath('/games')
  return { game: updated as BoardGame }
}

// Concede the current game to your partner.
export async function resignGame(gameId: string): Promise<BoardGame | null> {
  const { supabase, userId } = await getContext()
  const game = await getGame(gameId)
  if (!game || game.status !== 'active') return game
  if (userId !== game.player1 && userId !== game.player2) return game
  const { data } = await supabase.from('board_games').update({
    status: 'won',
    winner: userId === game.player1 ? game.player2 : game.player1,
    turn: null,
    move_count: game.move_count + 1,
    updated_at: new Date().toISOString(),
  }).eq('id', gameId).eq('status', 'active').select(FIELDS).maybeSingle()
  if (data) {
    const meta = GAMES[game.kind]
    notifyPartner(async () => ({
      title: `${await myFirstName()} resigned`,
      body: `You win ${meta.name} 🎉`,
      url: `/games/${meta.slug}`,
      tag: `game-${gameId}`,
    }))
  }
  revalidatePath('/games')
  return (data as BoardGame | null) ?? await getGame(gameId)
}
