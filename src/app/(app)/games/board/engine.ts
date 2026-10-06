// Pure rules for the two-player board games. Shared by the server action
// (which validates every move) and the client (which renders the board), so
// nothing here may touch the network or the DOM.
//
// Players are numbered 1 (board_games.player1, moves first) and 2. A cell or
// edge holds 0 when empty, otherwise the number of the player who claimed it.

export type Kind = 'tic_tac_toe' | 'connect_four' | 'dots_and_boxes' | 'uno'
export type Player = 1 | 2

export type CellsBoard = { cells: number[] }
export type DotsBoard = { edges: number[]; boxes: number[] }
// Uno: cards are short codes — colour letter (r/g/b/y) + value (0-9, S skip,
// R reverse, D draw two), or "W" / "W4" for wilds. hands[0] belongs to player1.
export type UnoColor = 'r' | 'g' | 'b' | 'y'
export type UnoBoard = {
  deck: string[]
  discard: string[]
  hands: [string[], string[]]
  color: UnoColor
  // The player to move has already drawn this turn (may play it or pass).
  drew: boolean
}
export type Board = CellsBoard | DotsBoard | UnoBoard

export type MoveResult = {
  board: Board
  // Dots & Boxes: completing a box earns another move.
  extraTurn: boolean
  // null while the game continues; 0 is a draw.
  winner: null | 0 | Player
}

export const GAMES: Record<Kind, { slug: string; name: string; blurb: string; emoji: string }> = {
  tic_tac_toe:    { slug: 'tic-tac-toe',    name: 'Tic-Tac-Toe',    blurb: 'Three in a row. A classic for a reason.',  emoji: '✕' },
  connect_four:   { slug: 'connect-four',   name: 'Connect Four',   blurb: 'Drop discs, line up four, gloat.',          emoji: '●' },
  dots_and_boxes: { slug: 'dots-and-boxes', name: 'Dots & Boxes',   blurb: 'Close a box, go again. Most boxes wins.',   emoji: '▢' },
  uno:            { slug: 'uno',            name: 'Uno',            blurb: 'Match colours, stack +2s, first to empty wins.', emoji: '🃏' },
}

export const KINDS = Object.keys(GAMES) as Kind[]

export function kindFromSlug(slug: string): Kind | null {
  return KINDS.find(k => GAMES[k].slug === slug) ?? null
}

// ── Tic-Tac-Toe: 3×3, cells row-major ──
const TTT_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

// ── Connect Four: 6 rows × 7 columns, cells row-major from the top ──
export const C4_ROWS = 6
export const C4_COLS = 7

// ── Dots & Boxes: 4×4 boxes on a 5×5 grid of dots ──
// Edges 0..19 are horizontal (row r of dots 0..4, segment c 0..3) at r*4+c.
// Edges 20..39 are vertical (box row r 0..3, dot column c 0..4) at 20+r*5+c.
export const DB_SIZE = 4
export const DB_H = (r: number, c: number) => r * DB_SIZE + c
export const DB_V = (r: number, c: number) => (DB_SIZE + 1) * DB_SIZE + r * (DB_SIZE + 1) + c
const DB_EDGES = 2 * DB_SIZE * (DB_SIZE + 1)

function boxEdges(r: number, c: number) {
  return [DB_H(r, c), DB_H(r + 1, c), DB_V(r, c), DB_V(r, c + 1)]
}

export function emptyBoard(kind: Kind): Board {
  switch (kind) {
    case 'tic_tac_toe':    return { cells: Array(9).fill(0) }
    case 'connect_four':   return { cells: Array(C4_ROWS * C4_COLS).fill(0) }
    case 'dots_and_boxes': return { edges: Array(DB_EDGES).fill(0), boxes: Array(DB_SIZE * DB_SIZE).fill(0) }
    case 'uno':            return newUnoBoard()
  }
}

// ── Uno ──
export const UNO_COLORS: UnoColor[] = ['r', 'g', 'b', 'y']
export const UNO_DRAW = -1
export const UNO_PASS = -2
// Playing card `i` from your hand is move i*4 + colour index; the colour only
// matters for wilds (the colour you call).
export const unoPlayMove = (cardIndex: number, color = 0) => cardIndex * 4 + color

export const unoColorOf = (card: string) => (card[0] === 'W' ? null : (card[0] as UnoColor))
export const unoValueOf = (card: string) => (card[0] === 'W' ? card : card.slice(1))

export function unoCanPlay(card: string, top: string, color: UnoColor) {
  if (card[0] === 'W') return true
  return unoColorOf(card) === color || unoValueOf(card) === unoValueOf(top)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function newUnoBoard(): UnoBoard {
  const cards: string[] = []
  for (const c of UNO_COLORS) {
    cards.push(c + '0')
    for (const v of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'S', 'R', 'D']) cards.push(c + v, c + v)
  }
  for (let i = 0; i < 4; i++) cards.push('W', 'W4')
  const deck = shuffle(cards)
  const hands: [string[], string[]] = [deck.splice(0, 7), deck.splice(0, 7)]
  // Start on a plain number card so nobody opens on a penalty.
  const start = deck.findIndex(c => /^[rgby]\d$/.test(c))
  const [first] = deck.splice(start, 1)
  return { deck, discard: [first], hands, color: first[0] as UnoColor, drew: false }
}

function unoDraw(board: UnoBoard, n: number): string[] {
  const out: string[] = []
  for (let i = 0; i < n; i++) {
    if (!board.deck.length) {
      // Reshuffle everything under the top card back into the deck.
      const top = board.discard.pop()!
      board.deck = shuffle(board.discard)
      board.discard = [top]
      if (!board.deck.length) break
    }
    out.push(board.deck.pop()!)
  }
  return out
}

function applyUno(prev: UnoBoard, move: number, who: Player): MoveResult {
  const board: UnoBoard = {
    deck: [...prev.deck], discard: [...prev.discard],
    hands: [[...prev.hands[0]], [...prev.hands[1]]],
    color: prev.color, drew: prev.drew,
  }
  const hand = board.hands[who - 1]
  const other = board.hands[who === 1 ? 1 : 0]
  const top = board.discard[board.discard.length - 1]

  if (move === UNO_DRAW) {
    if (board.drew) throw new Error('You already drew')
    const [card] = unoDraw(board, 1)
    if (card) hand.push(card)
    // Can't use what you drew? Turn passes automatically.
    if (!card || !unoCanPlay(card, top, board.color)) return { board: { ...board, drew: false }, extraTurn: false, winner: null }
    return { board: { ...board, drew: true }, extraTurn: true, winner: null }
  }
  if (move === UNO_PASS) {
    if (!board.drew) throw new Error('Draw a card first')
    return { board: { ...board, drew: false }, extraTurn: false, winner: null }
  }

  const index = Math.floor(move / 4)
  const card = hand[index]
  if (move < 0 || !card) throw new Error('Invalid card')
  if (!unoCanPlay(card, top, board.color)) throw new Error('That card doesn’t match')
  hand.splice(index, 1)
  board.discard.push(card)
  board.color = unoColorOf(card) ?? UNO_COLORS[move % 4]
  board.drew = false

  if (!hand.length) return { board, extraTurn: false, winner: who }

  // With two players, Skip and Reverse both mean "go again".
  const value = unoValueOf(card)
  let extraTurn = value === 'S' || value === 'R'
  if (value === 'D' || value === 'W4') {
    other.push(...unoDraw(board, value === 'D' ? 2 : 4))
    extraTurn = true
  }
  return { board, extraTurn, winner: null }
}

// Cells that make up the winning line, for highlighting. Empty if none.
export function winningLine(kind: Kind, board: Board): number[] {
  if (kind === 'tic_tac_toe') {
    const { cells } = board as CellsBoard
    return TTT_LINES.find(([a, b, c]) => cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) ?? []
  }
  if (kind === 'connect_four') {
    const { cells } = board as CellsBoard
    const at = (r: number, c: number) =>
      r >= 0 && r < C4_ROWS && c >= 0 && c < C4_COLS ? cells[r * C4_COLS + c] : 0
    for (let r = 0; r < C4_ROWS; r++) {
      for (let c = 0; c < C4_COLS; c++) {
        const p = at(r, c)
        if (!p) continue
        for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
          const line = [0, 1, 2, 3].map(i => [r + dr * i, c + dc * i])
          if (line.every(([rr, cc]) => at(rr, cc) === p)) return line.map(([rr, cc]) => rr * C4_COLS + cc)
        }
      }
    }
  }
  return []
}

// Applies `move` for `who`. Throws on an illegal move.
export function applyMove(kind: Kind, board: Board, move: number, who: Player): MoveResult {
  if (!Number.isInteger(move)) throw new Error('Invalid move')
  if (kind === 'uno') return applyUno(board as UnoBoard, move, who)

  if (kind === 'tic_tac_toe') {
    const cells = [...(board as CellsBoard).cells]
    if (move < 0 || move >= 9 || cells[move]) throw new Error('That square is taken')
    cells[move] = who
    const next = { cells }
    const line = winningLine(kind, next)
    const winner = line.length ? who : cells.every(Boolean) ? 0 : null
    return { board: next, extraTurn: false, winner }
  }

  if (kind === 'connect_four') {
    // `move` is a column; the disc falls to the lowest empty row.
    const cells = [...(board as CellsBoard).cells]
    if (move < 0 || move >= C4_COLS) throw new Error('Invalid column')
    let row = -1
    for (let r = C4_ROWS - 1; r >= 0; r--) if (!cells[r * C4_COLS + move]) { row = r; break }
    if (row < 0) throw new Error('That column is full')
    cells[row * C4_COLS + move] = who
    const next = { cells }
    const line = winningLine(kind, next)
    const winner = line.length ? who : cells.every(Boolean) ? 0 : null
    return { board: next, extraTurn: false, winner }
  }

  // Dots & Boxes — `move` is an edge index.
  const edges = [...(board as DotsBoard).edges]
  const boxes = [...(board as DotsBoard).boxes]
  if (move < 0 || move >= DB_EDGES || edges[move]) throw new Error('That line is drawn')
  edges[move] = who
  let claimed = 0
  for (let r = 0; r < DB_SIZE; r++) {
    for (let c = 0; c < DB_SIZE; c++) {
      const i = r * DB_SIZE + c
      if (!boxes[i] && boxEdges(r, c).every(e => edges[e])) { boxes[i] = who; claimed++ }
    }
  }
  let winner: MoveResult['winner'] = null
  if (edges.every(Boolean)) {
    const mine = boxes.filter(b => b === 1).length
    const theirs = boxes.filter(b => b === 2).length
    winner = mine === theirs ? 0 : mine > theirs ? 1 : 2
  }
  return { board: { edges, boxes }, extraTurn: claimed > 0, winner }
}
