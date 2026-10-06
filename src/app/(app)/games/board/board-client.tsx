'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useLive } from '@/lib/use-live'
import Link from 'next/link'
import { ChevronLeft, Loader2, Flag, RotateCcw } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  applyMove, winningLine, GAMES, C4_COLS, C4_ROWS, DB_SIZE, DB_H, DB_V,
  UNO_COLORS, UNO_DRAW, UNO_PASS, unoPlayMove, unoCanPlay, unoColorOf, unoValueOf,
  type Kind, type CellsBoard, type DotsBoard, type UnoBoard, type UnoColor,
} from './engine'
import { makeMove, startGame, resignGame, getLatestGame, type BoardGame } from './actions'
import { haptic, legendary } from '@/lib/feel'

type Props = {
  kind: Kind
  initial: BoardGame | null
  myId: string
  myName: string
  partnerName: string
  record: Record<string, number>
}

export default function BoardClient({ kind, initial, myId, myName, partnerName, record: initialRecord }: Props) {
  const [game, setGame] = useState<BoardGame | null>(initial)
  const [record, setRecord] = useState(initialRecord)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const meta = GAMES[kind]

  const myTurn = game?.status === 'active' && game.turn === myId
  // Which number (1/2) am I on this board?
  const me = game ? (game.player1 === myId ? 1 : 2) : 1

  const gameRef = useRef(game)
  useEffect(() => { gameRef.current = game }, [game])

  // Accept a newer copy of the game (a different game = a rematch was started).
  function receive(next: BoardGame | null) {
    if (!next) return
    const prev = gameRef.current
    if (prev && prev.id === next.id && next.move_count < prev.move_count) return
    if (prev && prev.id === next.id && prev.status === 'active' && next.status === 'won' && next.winner) {
      setRecord(r => ({ ...r, [next.winner!]: (r[next.winner!] ?? 0) + 1 }))
      if (next.winner === myId) legendary() // partner resigned
    }
    gameRef.current = next
    setGame(next)
  }

  // Live: listen for updates to this game's row.
  const gameId = game?.id
  useEffect(() => {
    if (!gameId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`board:${gameId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'board_games', filter: `id=eq.${gameId}` },
        ({ new: row }) => receive(row as BoardGame))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [gameId])

  // A rematch is a new row, so the per-game channel above can't see it:
  // listen for new games of this kind (RLS keeps it to our couple), with a
  // slow fallback poll in case realtime drops.
  useLive({ table: 'board_games', filter: `kind=eq.${kind}`, enabled: !myTurn }, async () => receive(await getLatestGame(kind)))

  function play(move: number) {
    if (!game || !myTurn || isPending) return
    haptic()
    // Uno draws from a hidden shuffled deck — let the server decide.
    if (kind === 'uno') {
      setError(null)
      startTransition(async () => {
        const res = await makeMove(game.id, move)
        if (res.error) setError(res.error)
        if (res.game?.status === 'won' && res.game.winner) {
          setRecord(r => ({ ...r, [res.game!.winner!]: (r[res.game!.winner!] ?? 0) + 1 }))
          if (res.game.winner === myId) legendary()
        }
        if (res.game) setGame(res.game)
      })
      return
    }
    let optimistic
    try {
      optimistic = applyMove(kind, game.board, move, me)
    } catch {
      return // illegal tap (taken square, full column) — ignore quietly
    }
    const before = game
    setError(null)
    setGame({
      ...game,
      board: optimistic.board,
      move_count: game.move_count + 1,
      turn: optimistic.winner !== null ? null : optimistic.extraTurn ? myId : (me === 1 ? game.player2 : game.player1),
      status: optimistic.winner === null ? 'active' : optimistic.winner === 0 ? 'draw' : 'won',
      winner: optimistic.winner ? myId : null,
    })
    startTransition(async () => {
      const res = await makeMove(before.id, move)
      if (res.error) { setError(res.error); setGame(res.game ?? before); return }
      if (res.game?.status === 'won' && res.game.winner) {
        setRecord(r => ({ ...r, [res.game!.winner!]: (r[res.game!.winner!] ?? 0) + 1 }))
        if (res.game.winner === myId) legendary()
      }
      setGame(res.game)
    })
  }

  function newGame() {
    setError(null)
    startTransition(async () => {
      try { setGame(await startGame(kind)) } catch (e) { setError(e instanceof Error ? e.message : 'Could not start') }
    })
  }

  function resign() {
    if (!game || !confirm(`Concede this game to ${partnerName}?`)) return
    startTransition(async () => {
      const g = await resignGame(game.id)
      if (g?.winner) setRecord(r => ({ ...r, [g.winner!]: (r[g.winner!] ?? 0) + 1 }))
      setGame(g)
    })
  }

  const partnerId = game ? (game.player1 === myId ? game.player2 : game.player1) : null
  const myWins = record[myId] ?? 0
  const theirWins = partnerId ? record[partnerId] ?? 0 : Object.entries(record).filter(([id]) => id !== myId).reduce((n, [, v]) => n + v, 0)

  let status: React.ReactNode = null
  if (!game) status = <span className="text-stone-400">No game yet — start one!</span>
  else if (game.status === 'draw') status = <span className="text-stone-300">It&rsquo;s a draw 🤝</span>
  else if (game.status === 'won') status = game.winner === myId
    ? <span className="text-amber-300">You won! 🎉</span>
    : <span className="text-stone-300">{partnerName} won this one</span>
  else if (myTurn) status = <span className="flex items-center gap-2 text-amber-200"><span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />Your move</span>
  else status = <span className="text-stone-400">Waiting for {partnerName}…</span>

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href="/games" className="text-stone-500 hover:text-amber-300 transition-colors -ml-2 p-2 flex items-center" aria-label="Back to games">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="font-serif text-3xl text-amber-50">{meta.name}</h1>
      </div>

      {/* Scoreboard */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-stone-900/70 border border-stone-800 rounded-2xl px-5 py-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-stone-400 text-xs truncate"><Swatch who="me" kind={kind} /> {myName}</p>
          <p className="font-serif text-3xl text-amber-50 mt-1">{myWins}</p>
        </div>
        <p className="text-stone-600 text-[10px] uppercase tracking-[0.25em]">wins</p>
        <div className="min-w-0 text-right">
          <p className="flex items-center justify-end gap-2 text-stone-400 text-xs truncate">{partnerName} <Swatch who="partner" kind={kind} /></p>
          <p className="font-serif text-3xl text-amber-50 mt-1">{theirWins}</p>
        </div>
      </div>

      <div className="flex items-center justify-between min-h-6 text-sm">
        {status}
        {isPending && <Loader2 size={14} className="animate-spin text-stone-500" />}
      </div>

      {game && kind === 'tic_tac_toe' && <TicTacToe game={game} me={me} canPlay={myTurn} onPlay={play} />}
      {game && kind === 'connect_four' && <ConnectFour game={game} me={me} canPlay={myTurn} onPlay={play} />}
      {game && kind === 'dots_and_boxes' && <DotsAndBoxes game={game} me={me} canPlay={myTurn} onPlay={play} myName={myName} partnerName={partnerName} />}

      {game && kind === 'uno' && <Uno game={game} me={me} canPlay={myTurn && !isPending} onPlay={play} partnerName={partnerName} />}

      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

      {(!game || game.status !== 'active') ? (
        <button
          onClick={newGame}
          disabled={isPending}
          className="w-full bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium rounded-xl px-4 py-3 text-sm transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw size={15} /> {game ? 'Rematch' : 'Start a game'}
        </button>
      ) : (
        <button onClick={resign} disabled={isPending} className="self-center text-stone-600 hover:text-red-400 text-xs flex items-center gap-1.5 transition-colors">
          <Flag size={12} /> Resign
        </button>
      )}
    </div>
  )
}

// ── Pieces ──
// You are always the accent colour; your partner is cream — whoever moves first.

function Swatch({ who, kind }: { who: 'me' | 'partner'; kind: Kind }) {
  const color = who === 'me' ? 'bg-amber-500' : 'bg-stone-300'
  return <span className={`inline-block h-2.5 w-2.5 shrink-0 ${kind === 'dots_and_boxes' ? 'rounded-sm' : 'rounded-full'} ${color}`} />
}

type BoardProps = { game: BoardGame; me: number; canPlay: boolean; onPlay: (move: number) => void }

function TicTacToe({ game, me, canPlay, onPlay }: BoardProps) {
  const { cells } = game.board as CellsBoard
  const line = new Set(winningLine('tic_tac_toe', game.board))
  return (
    <div className="grid grid-cols-3 gap-2 aspect-square w-full max-w-sm mx-auto">
      {cells.map((v, i) => (
        <button
          key={i}
          onClick={() => onPlay(i)}
          disabled={!canPlay || !!v}
          aria-label={`Square ${i + 1}${v ? (v === me ? ', yours' : ', theirs') : ''}`}
          className={`rounded-2xl border flex items-center justify-center transition-all ${
            line.has(i) ? 'border-amber-500 bg-amber-900/30' : 'border-stone-800 bg-stone-900/70'
          } ${canPlay && !v ? 'hover:border-amber-700 hover:bg-stone-800/70 cursor-pointer' : ''}`}
        >
          {v === 1 && <Mark x className={v === me ? 'text-amber-400' : 'text-stone-300'} />}
          {v === 2 && <Mark className={v === me ? 'text-amber-400' : 'text-stone-300'} />}
        </button>
      ))}
    </div>
  )
}

function Mark({ x, className }: { x?: boolean; className: string }) {
  return (
    <svg viewBox="0 0 40 40" className={`w-1/2 h-1/2 ${className}`} fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round">
      {x ? <path d="M8 8 L32 32 M32 8 L8 32" /> : <circle cx="20" cy="20" r="13" />}
    </svg>
  )
}

function ConnectFour({ game, me, canPlay, onPlay }: BoardProps) {
  const { cells } = game.board as CellsBoard
  const line = new Set(winningLine('connect_four', game.board))
  return (
    <div className="bg-stone-900/70 border border-stone-800 rounded-2xl p-2 sm:p-3 grid grid-cols-7 gap-1 sm:gap-1.5 w-full max-w-md mx-auto">
      {Array.from({ length: C4_COLS }, (_, c) => {
        const full = !!cells[c]
        return (
          <button
            key={c}
            onClick={() => onPlay(c)}
            disabled={!canPlay || full}
            aria-label={`Drop in column ${c + 1}`}
            style={{ minHeight: 0 }}
            className={`group flex flex-col gap-1 sm:gap-1.5 rounded-xl p-0.5 transition-colors ${canPlay && !full ? 'hover:bg-stone-800/70 cursor-pointer' : ''}`}
          >
            {Array.from({ length: C4_ROWS }, (_, r) => {
              const i = r * C4_COLS + c
              const v = cells[i]
              return (
                <span
                  key={r}
                  className={`aspect-square w-full rounded-full transition-colors ${
                    v === 0 ? 'bg-stone-950 shadow-[inset_0_2px_4px_rgb(0_0_0/0.5)]'
                    : v === me ? 'bg-amber-500' : 'bg-stone-300'
                  } ${line.has(i) ? 'ring-2 ring-offset-2 ring-offset-stone-900 ring-amber-200' : ''}`}
                />
              )
            })}
          </button>
        )
      })}
    </div>
  )
}

function DotsAndBoxes({ game, me, canPlay, onPlay, myName, partnerName }: BoardProps & { myName: string; partnerName: string }) {
  const { edges, boxes } = game.board as DotsBoard
  const n = DB_SIZE
  const track = `repeat(${n}, 14px 1fr) 14px`
  const mine = boxes.filter(b => b === me).length
  const theirs = boxes.filter(b => b && b !== me).length

  const cells: React.ReactNode[] = []
  for (let i = 0; i <= 2 * n; i++) {
    for (let j = 0; j <= 2 * n; j++) {
      const key = `${i}-${j}`
      if (i % 2 === 0 && j % 2 === 0) {
        cells.push(<span key={key} className="m-auto h-2.5 w-2.5 rounded-full bg-stone-400" />)
      } else if (i % 2 === 1 && j % 2 === 1) {
        const owner = boxes[((i - 1) / 2) * n + (j - 1) / 2]
        cells.push(
          <span key={key} className={`m-1 rounded-md flex items-center justify-center text-xs font-medium transition-colors ${
            owner === 0 ? '' : owner === me ? 'bg-amber-700/40 text-amber-200' : 'bg-stone-300/15 text-stone-300'
          }`}>
            {owner ? (owner === me ? myName : partnerName).slice(0, 1).toUpperCase() : null}
          </span>
        )
      } else {
        const horizontal = i % 2 === 0
        const e = horizontal ? DB_H(i / 2, (j - 1) / 2) : DB_V((i - 1) / 2, j / 2)
        const v = edges[e]
        cells.push(
          <button
            key={key}
            onClick={() => onPlay(e)}
            disabled={!canPlay || !!v}
            aria-label={`${horizontal ? 'Horizontal' : 'Vertical'} line`}
            style={{ minHeight: 0 }}
            className={`group flex items-center justify-center ${canPlay && !v ? 'cursor-pointer' : ''}`}
          >
            <span className={`rounded-full transition-colors ${horizontal ? 'h-1.5 w-full' : 'w-1.5 h-full'} ${
              v === 0
                ? canPlay ? 'bg-stone-800/60 group-hover:bg-amber-600/70' : 'bg-stone-800/40'
                : v === me ? 'bg-amber-500' : 'bg-stone-300'
            }`} />
          </button>
        )
      }
    }
  }

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
      <div
        className="grid aspect-square w-full bg-stone-900/70 border border-stone-800 rounded-2xl p-4"
        style={{ gridTemplateColumns: track, gridTemplateRows: track }}
      >
        {cells}
      </div>
      <p className="text-center text-stone-500 text-xs">Boxes — you {mine} · {partnerName} {theirs}</p>
    </div>
  )
}

// ── Uno ──

const UNO_BG: Record<UnoColor, string> = {
  r: 'bg-rose-500 text-white',
  g: 'bg-emerald-500 text-white',
  b: 'bg-sky-500 text-white',
  y: 'bg-yellow-400 text-neutral-950',
}
const UNO_NAME: Record<UnoColor, string> = { r: 'Red', g: 'Green', b: 'Blue', y: 'Yellow' }

function unoLabel(card: string) {
  const v = unoValueOf(card)
  return v === 'S' ? '⊘' : v === 'R' ? '⇄' : v === 'D' ? '+2' : v === 'W4' ? '+4' : v === 'W' ? '★' : v
}

function UnoCard({ card, onClick, disabled, playable, dim, small }: {
  card: string; onClick?: () => void; disabled?: boolean; playable?: boolean; dim?: boolean; small?: boolean
}) {
  const color = unoColorOf(card)
  const size = small ? 'w-11 h-16 text-base' : 'w-14 h-20 sm:w-16 sm:h-24 text-xl'
  const face = color
    ? UNO_BG[color]
    : 'text-white bg-[conic-gradient(from_45deg,#f43f5e_0_25%,#0ea5e9_0_50%,#10b981_0_75%,#fbbf24_0)]'
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ minHeight: 0 }}
      aria-label={color ? `${UNO_NAME[color]} ${unoLabel(card)}` : card === 'W4' ? 'Wild draw four' : 'Wild'}
      className={`${size} ${face} shrink-0 rounded-xl font-bold flex items-center justify-center border-2 border-white/80 shadow-lg transition-transform ${
        playable ? 'hover:-translate-y-2 cursor-pointer' : ''
      } ${dim ? 'opacity-40' : ''}`}
    >
      <span className={`flex items-center justify-center rounded-full ${small ? 'h-8 w-8' : 'h-10 w-10 sm:h-12 sm:w-12'} bg-white/20 [text-shadow:0_1px_2px_rgb(0_0_0/0.35)]`}>
        {unoLabel(card)}
      </span>
    </button>
  )
}

function Uno({ game, me, canPlay, onPlay, partnerName }: BoardProps & { partnerName: string }) {
  const board = game.board as UnoBoard
  const hand = board.hands[me - 1]
  const theirCount = board.hands[me === 1 ? 1 : 0].length
  const top = board.discard[board.discard.length - 1]
  const [choosing, setChoosing] = useState<number | null>(null)

  function tap(i: number) {
    if (hand[i][0] === 'W') setChoosing(i)
    else onPlay(unoPlayMove(i))
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Partner's hand, face down */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex -space-x-8">
          {Array.from({ length: Math.min(theirCount, 12) }, (_, i) => (
            <span key={i} className="w-11 h-16 rounded-xl border-2 border-white/70 bg-stone-800 bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgb(255_255_255/0.06)_6px_12px)] shadow" />
          ))}
        </div>
        <p className="text-stone-500 text-xs">
          {partnerName} · {theirCount} card{theirCount === 1 ? '' : 's'}
          {theirCount === 1 && game.status === 'active' && <span className="ml-2 text-rose-400 font-semibold">UNO!</span>}
        </p>
      </div>

      {/* Table */}
      <div className="flex items-center justify-center gap-6">
        <button
          onClick={() => onPlay(UNO_DRAW)}
          disabled={!canPlay || board.drew}
          style={{ minHeight: 0 }}
          aria-label="Draw a card"
          className="w-14 h-20 sm:w-16 sm:h-24 rounded-xl border-2 border-white/70 bg-stone-800 bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgb(255_255_255/0.06)_6px_12px)] shadow-lg flex items-center justify-center text-stone-300 text-xs font-medium enabled:hover:-translate-y-1 transition-transform disabled:opacity-60"
        >
          Draw
        </button>
        <div className="flex flex-col items-center gap-2">
          <UnoCard card={top} />
          <span className="flex items-center gap-1.5 text-xs text-stone-400">
            <span className={`h-2.5 w-2.5 rounded-full ${UNO_BG[board.color].split(' ')[0]}`} /> {UNO_NAME[board.color]}
          </span>
        </div>
      </div>

      {canPlay && board.drew && (
        <button onClick={() => onPlay(UNO_PASS)} className="self-center text-sm text-stone-400 hover:text-amber-200 underline underline-offset-4">
          Keep it and pass
        </button>
      )}

      {/* Wild colour picker */}
      {choosing !== null && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-stone-400 text-xs uppercase tracking-[0.2em]">Call a colour</p>
          <div className="flex gap-2">
            {UNO_COLORS.map((c, ci) => (
              <button
                key={c}
                onClick={() => { onPlay(unoPlayMove(choosing, ci)); setChoosing(null) }}
                aria-label={UNO_NAME[c]}
                className={`h-11 w-11 rounded-full border-2 border-white/80 ${UNO_BG[c].split(' ')[0]}`}
              />
            ))}
            <button onClick={() => setChoosing(null)} className="text-stone-500 text-xs px-2">cancel</button>
          </div>
        </div>
      )}

      {/* My hand */}
      <div className="flex flex-col gap-2">
        <p className="text-stone-500 text-[10px] uppercase tracking-[0.25em]">Your hand · {hand.length}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {hand.map((card, i) => {
            const playable = canPlay && unoCanPlay(card, top, board.color)
            return <UnoCard key={`${card}-${i}`} card={card} onClick={() => tap(i)} disabled={!playable} playable={playable} dim={canPlay && !playable} />
          })}
        </div>
      </div>
    </div>
  )
}
