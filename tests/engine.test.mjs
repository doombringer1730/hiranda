// Rules tests for the two-player games. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyMove, emptyBoard, winningLine, unoCanPlay, unoPlayMove, UNO_DRAW, UNO_PASS, DB_H, DB_V,
} from '../src/app/(app)/games/board/engine.ts'

test('tic-tac-toe: three in a row wins, taken squares are rejected', () => {
  let b = emptyBoard('tic_tac_toe')
  for (const [m, w] of [[0, 1], [3, 2], [1, 1], [4, 2]]) b = applyMove('tic_tac_toe', b, m, w).board
  const r = applyMove('tic_tac_toe', b, 2, 1)
  assert.equal(r.winner, 1)
  assert.deepEqual(winningLine('tic_tac_toe', r.board), [0, 1, 2])
  assert.throws(() => applyMove('tic_tac_toe', b, 0, 2))
})

test('tic-tac-toe: full board without a line is a draw', () => {
  let b = emptyBoard('tic_tac_toe'), r
  for (const [m, w] of [[0, 1], [1, 2], [2, 1], [4, 2], [3, 1], [5, 2], [7, 1], [6, 2], [8, 1]]) { r = applyMove('tic_tac_toe', b, m, w); b = r.board }
  assert.equal(r.winner, 0)
})

test('connect four: vertical win, full column rejected', () => {
  let b = emptyBoard('connect_four'), r
  for (const [c, w] of [[0, 1], [1, 2], [0, 1], [1, 2], [0, 1], [1, 2]]) { r = applyMove('connect_four', b, c, w); assert.equal(r.winner, null); b = r.board }
  assert.equal(applyMove('connect_four', b, 0, 1).winner, 1)
  b = emptyBoard('connect_four')
  for (let i = 0; i < 6; i++) b = applyMove('connect_four', b, 3, i % 2 ? 2 : 1).board
  assert.throws(() => applyMove('connect_four', b, 3, 1))
})

test('dots and boxes: closing a box earns another move; the game always finishes', () => {
  let b = emptyBoard('dots_and_boxes'), r
  for (const e of [DB_H(0, 0), DB_H(1, 0), DB_V(0, 0)]) { r = applyMove('dots_and_boxes', b, e, 1); assert.equal(r.extraTurn, false); b = r.board }
  r = applyMove('dots_and_boxes', b, DB_V(0, 1), 2)
  assert.equal(r.extraTurn, true)
  assert.equal(r.board.boxes[0], 2)

  b = emptyBoard('dots_and_boxes'); let who = 1
  for (const e of [...Array(40).keys()].sort(() => Math.random() - 0.5)) { r = applyMove('dots_and_boxes', b, e, who); b = r.board; if (!r.extraTurn) who = who === 1 ? 2 : 1 }
  assert.notEqual(r.winner, null)
})

test('uno: 200 random games finish and never lose or duplicate a card', () => {
  const total = u => u.hands[0].length + u.hands[1].length + u.deck.length + u.discard.length
  for (let g = 0; g < 200; g++) {
    let u = emptyBoard('uno'), p = 1, r, n = 0
    assert.equal(total(u), 108)
    while (n++ < 3000) {
      const hand = u.hands[p - 1], top = u.discard.at(-1)
      const i = hand.findIndex(c => unoCanPlay(c, top, u.color))
      const move = i >= 0 ? unoPlayMove(i, Math.floor(Math.random() * 4)) : (u.drew ? UNO_PASS : UNO_DRAW)
      r = applyMove('uno', u, move, p); u = r.board
      assert.equal(total(u), 108)
      if (r.winner) break
      if (!r.extraTurn) p = p === 1 ? 2 : 1
    }
    assert.ok(r.winner, `game ${g} finished`)
  }
})
