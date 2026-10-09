'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Minus, Plus, X, Lock, LayoutGrid, RotateCcw } from 'lucide-react'
import {
  WIDGETS, WIDGET_IDS, SIZE_NAMES, DEFAULT_LAYOUT, nextSize, moveItem,
  type LayoutItem, type WidgetId, type WidgetSize,
} from '@/lib/home-widgets'
import { saveHomeLayout } from './home-actions'
import { haptic, toast } from '@/lib/feel'

// Widgets per size: on phones two columns, on wider screens four.
const SPAN: Record<WidgetSize, string> = {
  s: 'col-span-1',
  m: 'col-span-2',
  l: 'col-span-2 md:col-span-4',
}

const HOLD_MS = 220 // touch: hold this long to pick a widget up
const SLOP = 8 // px a finger may drift during the hold before it counts as a scroll

type Drag = {
  id: WidgetId
  el: HTMLElement
  grabX: number; grabY: number // pointer offset inside the widget when picked up
  x: number; y: number // pointer, in viewport coordinates
  lastMove: number
}

function useEscape(on: boolean, fn: () => void) {
  useEffect(() => {
    if (!on) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') fn() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [on, fn])
}

export default function HomeGrid({ initial, nodes, plus }: {
  initial: LayoutItem[]
  // Rendered widgets, by `id:size` (or just `id` when every size looks the
  // same). Missing or null: nothing to show right now.
  nodes: Partial<Record<string, React.ReactNode>>
  plus: boolean
}) {
  const [layout, setLayout] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [dragId, setDragId] = useState<WidgetId | null>(null)
  const [saving, startSaving] = useTransition()

  const gridRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const pending = useRef<{ id: WidgetId; el: HTMLElement; pointerId: number; x0: number; y0: number; timer: number | null; mouse: boolean } | null>(null)
  const lastPos = useRef(new Map<string, { x: number; y: number }>())
  const raf = useRef(0)

  const nodeFor = (i: LayoutItem) => nodes[`${i.id}:${i.size}`] ?? nodes[i.id] ?? null
  // A Plus widget stays in the saved layout if Plus lapses; it just hides.
  const shown = layout.filter(i => plus || !WIDGETS[i.id].plus)

  const update = useCallback((next: LayoutItem[]) => { setLayout(next); setDirty(true) }, [])

  // ── Smoothly slide widgets into their new places (FLIP) ──
  useLayoutEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const seen = new Map<string, { x: number; y: number }>()
    for (const el of grid.querySelectorAll<HTMLElement>('[data-wid]')) {
      const id = el.dataset.wid!
      const now = { x: el.offsetLeft, y: el.offsetTop }
      seen.set(id, now)
      const before = lastPos.current.get(id)
      if (!before || reduce || id === drag.current?.id) continue
      const dx = before.x - now.x, dy = before.y - now.y
      if (dx || dy) el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
    }
    lastPos.current = seen
    if (drag.current) place()
  })

  // Keep the lifted widget under the finger, wherever its slot is now.
  function place() {
    const d = drag.current, grid = gridRef.current
    if (!d || !grid) return
    const g = grid.getBoundingClientRect()
    const tx = d.x - d.grabX - g.left - d.el.offsetLeft
    const ty = d.y - d.grabY - g.top - d.el.offsetTop
    d.el.style.translate = `${tx}px ${ty}px`
  }

  // Which widget is under the pointer? Hit-test the slots, not the (moving) boxes.
  function reorderUnder() {
    const d = drag.current, grid = gridRef.current
    if (!d || !grid) return
    if (performance.now() - d.lastMove < 160) return // let the last move settle
    const g = grid.getBoundingClientRect()
    const px = d.x - g.left, py = d.y - g.top
    for (const el of grid.querySelectorAll<HTMLElement>('[data-wid]')) {
      if (el === d.el) continue
      if (px < el.offsetLeft || px > el.offsetLeft + el.offsetWidth || py < el.offsetTop || py > el.offsetTop + el.offsetHeight) continue
      const target = el.dataset.wid as WidgetId
      setLayout(cur => {
        const from = cur.findIndex(i => i.id === d.id), to = cur.findIndex(i => i.id === target)
        return from < 0 || to < 0 ? cur : moveItem(cur, from, to)
      })
      setDirty(true)
      d.lastMove = performance.now()
      haptic()
      return
    }
  }

  // While dragging: follow the pointer, and scroll when it nears an edge.
  function loop() {
    const d = drag.current
    if (!d) return
    const edge = 90
    const bottom = window.innerHeight - edge - 40
    if (d.y < edge) window.scrollBy(0, -Math.ceil((edge - d.y) / 6))
    else if (d.y > bottom) window.scrollBy(0, Math.ceil((d.y - bottom) / 6))
    place()
    reorderUnder()
    raf.current = requestAnimationFrame(loop)
  }

  function lift(p: NonNullable<typeof pending.current>, x: number, y: number) {
    const r = p.el.getBoundingClientRect()
    drag.current = { id: p.id, el: p.el, grabX: p.x0 - r.left, grabY: p.y0 - r.top, x, y, lastMove: 0 }
    try { p.el.setPointerCapture(p.pointerId) } catch {}
    setDragId(p.id)
    haptic()
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(loop)
  }

  function onPointerDown(e: React.PointerEvent<HTMLElement>, id: WidgetId) {
    if (!editing || drag.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    if ((e.target as HTMLElement).closest('[data-nodrag]')) return
    const el = e.currentTarget
    const mouse = e.pointerType === 'mouse'
    const p = { id, el, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, timer: null as number | null, mouse }
    pending.current = p
    if (!mouse) p.timer = window.setTimeout(() => { if (pending.current === p) { pending.current = null; lift(p, p.x0, p.y0) } }, HOLD_MS)
  }

  function onPointerMove(e: React.PointerEvent) {
    const p = pending.current
    if (p && p.pointerId === e.pointerId) {
      const moved = Math.hypot(e.clientX - p.x0, e.clientY - p.y0)
      if (p.mouse && moved > 4) { pending.current = null; lift(p, e.clientX, e.clientY) }
      else if (!p.mouse && moved > SLOP) { if (p.timer) clearTimeout(p.timer); pending.current = null } // a scroll
      return
    }
    const d = drag.current
    if (d) { d.x = e.clientX; d.y = e.clientY }
  }

  function drop() {
    const p = pending.current
    if (p?.timer) clearTimeout(p.timer)
    pending.current = null
    const d = drag.current
    if (!d) return
    drag.current = null
    cancelAnimationFrame(raf.current)
    const from = d.el.style.translate || '0 0'
    d.el.style.translate = ''
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      d.el.animate([{ translate: from }, { translate: '0 0' }], { duration: 280, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
    }
    setDragId(null)
  }

  // A finger that has picked a widget up mustn't scroll the page. (Touch
  // scrolling can't be switched off mid-gesture with CSS, so cancel the moves.)
  useEffect(() => {
    if (!editing) return
    const block = (e: TouchEvent) => { if (drag.current && e.cancelable) e.preventDefault() }
    document.addEventListener('touchmove', block, { passive: false })
    return () => document.removeEventListener('touchmove', block)
  }, [editing])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  function onKey(e: React.KeyboardEvent, id: WidgetId) {
    if (!editing) return
    const step = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : 0
    if (!step) return
    e.preventDefault()
    const from = layout.findIndex(i => i.id === id)
    update(moveItem(layout, from, from + step))
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLElement>(`[data-wid="${id}"]`)?.focus())
  }

  const remove = (id: WidgetId) => { haptic(); update(layout.filter(i => i.id !== id)) }
  const resize = (id: WidgetId) => { haptic(); update(layout.map(i => i.id === id ? { ...i, size: nextSize(i.id, i.size) } : i)) }
  const add = (id: WidgetId, size: WidgetSize) => {
    haptic()
    update([{ id, size }, ...layout.filter(i => i.id !== id)])
    setAdding(false)
    window.scrollTo({ top: gridRef.current ? gridRef.current.getBoundingClientRect().top + window.scrollY - 120 : 0, behavior: 'smooth' })
  }

  const finish = useCallback(() => {
    setAdding(false)
    setEditing(false)
    if (!dirty) return
    const snapshot = layout
    startSaving(async () => {
      const res = await saveHomeLayout(snapshot)
      if (res.error) toast(`${res.error}. Try again in a moment.`)
      else setDirty(false)
    })
  }, [dirty, layout])
  useEscape(editing && !adding, finish)

  return (
    <div className={editing ? 'select-none' : ''}>
      <style>{`
        @keyframes hw-jiggle { 0%,100% { rotate: -0.5deg } 50% { rotate: 0.5deg } }
        .hw-jiggle { animation: hw-jiggle 0.32s ease-in-out infinite; }
        .hw-jiggle-b { animation-delay: -0.16s; }
        @media (prefers-reduced-motion: reduce) { .hw-jiggle { animation: none; } }
      `}</style>

      {editing && (
        <div className="sticky top-[calc(env(safe-area-inset-top)+8px)] z-30 mb-4 flex items-center justify-between gap-2 rounded-full material px-2 py-2 animate-fade">
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-full bg-stone-800/80 px-3.5 py-2 text-sm text-amber-50">
            <Plus size={16} /> Add widget
          </button>
          <p className="hidden sm:block text-stone-400 text-xs">Hold and drag to rearrange · shared with your partner</p>
          <button onClick={finish} className="rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-stone-950">Done</button>
        </div>
      )}

      <div
        ref={gridRef}
        onPointerMove={onPointerMove}
        onPointerUp={drop}
        onPointerCancel={drop}
        className="relative grid grid-cols-2 md:grid-cols-4 grid-flow-row-dense gap-3 md:gap-4"
      >
        {shown.map((item, n) => {
          const meta = WIDGETS[item.id]
          const node = nodeFor(item)
          if (!node && !editing) return null
          const lifted = dragId === item.id
          return (
            <div
              key={item.id}
              data-wid={item.id}
              tabIndex={editing ? 0 : undefined}
              role={editing ? 'button' : undefined}
              aria-roledescription={editing ? 'movable widget' : undefined}
              aria-label={editing ? `${meta.name}, ${SIZE_NAMES[item.size].toLowerCase()}. Position ${n + 1} of ${shown.length}. Arrow keys move it.` : undefined}
              onPointerDown={e => onPointerDown(e, item.id)}
              onKeyDown={e => onKey(e, item.id)}
              onContextMenu={editing ? e => e.preventDefault() : undefined}
              className={`relative min-w-0 ${SPAN[item.size]} ${editing ? 'cursor-grab [-webkit-touch-callout:none] outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-[24px]' : ''} ${lifted ? 'z-20 cursor-grabbing' : ''}`}
            >
              <div className={`h-full ${editing && !lifted ? `hw-jiggle ${n % 2 ? 'hw-jiggle-b' : ''}` : ''} ${lifted ? 'scale-[1.04] drop-shadow-2xl' : ''} transition-transform`}>
                <div inert={editing} className={`h-full ${editing ? 'pointer-events-none' : ''}`}>
                  {node ?? (
                    <div className="tile h-full min-h-[120px] p-4 flex flex-col items-center justify-center gap-1 text-center">
                      <span className="text-2xl" aria-hidden>{meta.emoji}</span>
                      <span className="text-amber-50 text-sm">{meta.name}</span>
                      <span className="text-stone-500 text-[11px] leading-snug">Shows up when there’s something here</span>
                    </div>
                  )}
                </div>
              </div>

              {editing && !lifted && (
                <>
                  <button
                    data-nodrag
                    onClick={() => remove(item.id)}
                    aria-label={`Remove ${meta.name}`}
                    className="absolute -left-1.5 -top-1.5 z-10 grid place-items-center h-7 w-7 rounded-full bg-stone-700 text-amber-50 shadow-lg ring-1 ring-black/30"
                  >
                    <Minus size={15} strokeWidth={3} />
                  </button>
                  {meta.sizes.length > 1 && (
                    <button
                      data-nodrag
                      onClick={() => resize(item.id)}
                      aria-label={`${meta.name} is ${SIZE_NAMES[item.size].toLowerCase()}. Make it ${SIZE_NAMES[nextSize(item.id, item.size)].toLowerCase()}`}
                      className="absolute -right-1.5 -bottom-1.5 z-10 flex items-center gap-1 rounded-full bg-stone-700 px-2.5 h-7 text-[11px] font-medium text-amber-50 shadow-lg ring-1 ring-black/30"
                    >
                      <LayoutGrid size={12} /> {SIZE_NAMES[item.size]}
                    </button>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {editing && shown.length === 0 && (
        <button onClick={() => setAdding(true)} className="w-full tile p-6 text-stone-400 text-sm flex items-center justify-center gap-2">
          <Plus size={16} /> Your Home is empty. Add a widget
        </button>
      )}

      {!editing && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => { haptic(); setEditing(true) }}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs text-stone-400 hover:text-amber-200 hover:bg-stone-800/50 transition-colors"
          >
            <LayoutGrid size={14} /> {saving ? 'Saving…' : 'Edit Home'}
          </button>
        </div>
      )}

      {adding && (
        <AddSheet
          layout={layout}
          plus={plus}
          onAdd={add}
          onReset={() => { haptic(); update(DEFAULT_LAYOUT.map(i => ({ ...i }))); setAdding(false) }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  )
}

function AddSheet({ layout, plus, onAdd, onReset, onClose }: {
  layout: LayoutItem[]
  plus: boolean
  onAdd: (id: WidgetId, size: WidgetSize) => void
  onReset: () => void
  onClose: () => void
}) {
  useEscape(true, onClose)
  const onHome = new Set(layout.map(i => i.id))
  const choices = WIDGET_IDS.filter(id => !onHome.has(id) || (WIDGETS[id].plus && !plus))
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Add a widget" className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55 animate-fade" />
      <div className="relative w-full md:max-w-lg max-h-[85dvh] overflow-y-auto rounded-t-[28px] md:rounded-[28px] bg-stone-900 px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))] animate-sheet">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-serif text-2xl text-amber-50">Add a widget</h2>
          <button onClick={onClose} aria-label="Close" className="grid place-items-center h-9 w-9 rounded-full bg-stone-800 text-stone-300"><X size={16} /></button>
        </div>
        <p className="text-stone-400 text-sm mb-4">Your partner sees the same Home, so pick together.</p>

        {choices.length === 0 && <p className="text-stone-400 text-sm py-6 text-center">Every widget is already on your Home.</p>}
        <ul className="flex flex-col gap-2">
          {choices.map(id => {
            const meta = WIDGETS[id]
            const locked = meta.plus && !plus
            return (
              <li key={id} className="rounded-[20px] bg-stone-800/50 p-3 flex items-center gap-3">
                <span className="grid place-items-center h-11 w-11 shrink-0 rounded-[14px] bg-stone-800 text-xl" aria-hidden>{meta.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-amber-50 text-[15px]">
                    {meta.name}
                    {meta.plus && <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300">Plus</span>}
                  </span>
                  <span className="block text-stone-400 text-xs leading-snug">{meta.blurb}</span>
                </span>
                {locked ? (
                  <Link href="/plus" className="flex items-center gap-1 rounded-full bg-stone-700 px-3 py-1.5 text-xs text-amber-100 shrink-0">
                    <Lock size={12} /> Plus
                  </Link>
                ) : (
                  <span className="flex gap-1 shrink-0">
                    {meta.sizes.map(s => (
                      <button key={s} onClick={() => onAdd(id, s)} aria-label={`Add ${meta.name}, ${SIZE_NAMES[s].toLowerCase()}`} className="rounded-full bg-stone-700 hover:bg-amber-600 hover:text-stone-950 px-2.5 py-1.5 text-xs text-amber-50 transition-colors">
                        {SIZE_NAMES[s]}
                      </button>
                    ))}
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        <button onClick={onReset} className="mt-5 mx-auto flex items-center gap-1.5 text-stone-500 hover:text-stone-300 text-xs">
          <RotateCcw size={12} /> Reset to the original Home
        </button>
      </div>
    </div>,
    document.body,
  )
}
