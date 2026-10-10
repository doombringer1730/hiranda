'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Minus, Plus, X, Lock, LayoutGrid, RotateCcw, ChevronRight, Layers, Check } from 'lucide-react'
import {
  WIDGETS, WIDGET_IDS, SIZE_NAMES, DEFAULT_LAYOUT, TINTS, nextSize, moveItem, idsOf, sizesOf,
  type LayoutItem, type WidgetId, type WidgetSize, type Tint,
} from '@/lib/home-widgets'
import { saveHomeLayout } from './home-actions'
import { haptic, toast } from '@/lib/feel'

// iPhone widget geometry: square cells, two across on phones and four on
// wider screens. Small is one cell, medium two side by side, large two by two.
const SPAN: Record<WidgetSize, string> = {
  s: 'col-span-1 row-span-1',
  m: 'col-span-2 row-span-1',
  l: 'col-span-2 row-span-2',
  w: '', // its own row, as tall as it needs
}
const CELLS: Record<Exclude<WidgetSize, 'w'>, [number, number]> = { s: [1, 1], m: [2, 1], l: [2, 2] }
const GRID_CSS = `
  .hw-wrap { container-type: inline-size; width: 100%; --cols: 2; --gap: 16px; }
  @media (min-width: 768px) { .hw-wrap { --cols: 4; --gap: 18px; } }
  .hw-grid { display: grid; gap: var(--gap); grid-auto-flow: row dense;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    grid-auto-rows: calc((100cqw - (var(--cols) - 1) * var(--gap)) / var(--cols)); }
  /* Full cards keep the original Home's fit: one column on phones, two
     flowing columns on desktop (no row lining them up, so no holes), with
     its spacing: 24px after the things you do together, 16px between the
     keepsakes. Your move spans both columns, as it always sat on top. */
  .hw-full { margin-bottom: -16px; }
  .hw-full > .hw-cell { break-inside: avoid; margin-bottom: 16px; }
  .hw-full > [data-wid=moves], .hw-full > [data-wid=question], .hw-full > [data-wid=talk] { margin-bottom: 24px; }
  .hw-full:has(> :last-child:is([data-wid=moves], [data-wid=question], [data-wid=talk])) { margin-bottom: -24px; }
  @media (min-width: 768px) {
    .hw-full { columns: 2; column-gap: 24px; }
    .hw-full > [data-wid=moves] { column-span: all; }
  }
  .hw-grid .hw-cell .tile { border-radius: 22px; }
  @keyframes hw-jiggle { 0%,100% { rotate: -0.6deg } 50% { rotate: 0.6deg } }
  .hw-jiggle { animation: hw-jiggle 0.3s ease-in-out infinite; }
  .hw-jiggle-b { animation-delay: -0.15s; }
  @media (prefers-reduced-motion: reduce) { .hw-jiggle { animation: none; } }
  .hw-stack { scrollbar-width: none; }
  .hw-stack::-webkit-scrollbar { display: none; }
  /* Tinted widgets: one color washed over the widget, like iOS. Mixed with
     the theme's own surface so it suits whichever theme you use. */
  .hw-tinted .tile { background: linear-gradient(160deg,
      color-mix(in oklab, var(--tint) 38%, var(--color-stone-900)),
      color-mix(in oklab, var(--tint) 12%, var(--color-stone-900))) !important; }
  .hw-tint-mono > * { filter: grayscale(1); }
`

// The swatch color for each tint.
const TINT_COLOR: Record<Tint, string> = {
  rose: '#e8738f', peach: '#f0a072', butter: '#e9c869', sage: '#8fbf8a', sky: '#72a8e0', lilac: '#a993dc', mono: '#9a948c',
}
const TINT_NAMES: Record<Tint, string> = { rose: 'Rose', peach: 'Peach', butter: 'Butter', sage: 'Sage', sky: 'Sky', lilac: 'Lilac', mono: 'Mono' }
const tintStyle = (t?: Tint) => t ? ({ '--tint': TINT_COLOR[t] }) as React.CSSProperties : undefined

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
  const [options, setOptions] = useState<WidgetId | null>(null) // the widget whose options sheet is open
  const [dirty, setDirty] = useState(false)
  const [dragId, setDragId] = useState<WidgetId | null>(null)
  const [saving, startSaving] = useTransition()

  const gridRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)
  const pending = useRef<{ id: WidgetId; el: HTMLElement; pointerId: number; x0: number; y0: number; timer: number | null; mouse: boolean } | null>(null)
  const lastPos = useRef(new Map<string, { x: number; y: number }>())
  const raf = useRef(0)

  const nodeFor = (i: { id: WidgetId; size: WidgetSize }) => nodes[`${i.id}:${i.size}`] ?? nodes[i.id] ?? null
  // A Plus widget stays in the saved layout if Plus lapses; it just hides.
  const shown = layout.filter(i => plus || !WIDGETS[i.id].plus)

  // Square widgets flow in the iPhone grid; Full cards sit between them at
  // their own height (two side by side on wide screens), like the old Home.
  function runs(cells: React.ReactNode[], items: LayoutItem[]) {
    const out: { full: boolean; cells: React.ReactNode[] }[] = []
    cells.forEach((c, n) => {
      if (!c) return
      const full = items[n].size === 'w'
      if (out.at(-1)?.full !== full) out.push({ full, cells: [] })
      out.at(-1)!.cells.push(c)
    })
    return out.map((r, n) => <div key={n} className={r.full ? 'hw-full' : 'hw-grid'}>{r.cells}</div>)
  }

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

  function drop(e?: React.PointerEvent) {
    const p = pending.current
    if (p?.timer) clearTimeout(p.timer)
    pending.current = null
    // A tap (not a drag) in edit mode opens that widget's options.
    if (p && e?.type === 'pointerup' && p.pointerId === e.pointerId) { haptic(); setOptions(p.id); return }
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
  const resize = (id: WidgetId) => { haptic(); update(layout.map(i => i.id === id ? { ...i, size: nextSize(i.id, i.size, i.stack) } : i)) }
  // Swap one spot for its new self (and any widget split off it). Widgets that
  // joined its stack leave their own spots.
  const change = (id: WidgetId, next: LayoutItem | null, extra: LayoutItem[] = []) => {
    haptic()
    const joined = new Set(next?.stack ?? [])
    update(layout.flatMap(i => i.id === id ? [...(next ? [next] : []), ...extra] : joined.has(i.id) ? [] : [i]))
    setOptions(next?.id ?? null)
  }
  const add = (id: WidgetId, size: WidgetSize) => {
    haptic()
    update([{ id, size }, ...layout.filter(i => i.id !== id).map(i => i.stack?.includes(id) ? { ...i, stack: i.stack.filter(s => s !== id) } : i)])
    setAdding(false)
    window.scrollTo({ top: gridRef.current ? gridRef.current.getBoundingClientRect().top + window.scrollY - 120 : 0, behavior: 'smooth' })
  }

  // One cell's side in px, for true-size previews in the gallery.
  function unit() {
    const g = gridRef.current
    if (!g) return 170
    const cs = getComputedStyle(g)
    const cols = parseFloat(cs.getPropertyValue('--cols')) || 2
    const gap = parseFloat(cs.getPropertyValue('--gap')) || 14
    return (g.clientWidth - gap * (cols - 1)) / cols
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
  useEscape(editing && !adding && !options, finish)

  return (
    <div className={`w-full ${editing ? 'select-none' : ''}`}>
      <style>{GRID_CSS}</style>

      {editing && (
        <div className="sticky top-[calc(env(safe-area-inset-top)+8px)] z-30 mb-4 flex items-center justify-between gap-2 rounded-full material px-2 py-2 animate-fade">
          <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 rounded-full bg-stone-800/80 px-3.5 py-2 text-sm text-amber-50">
            <Plus size={16} /> Add widget
          </button>
          <p className="hidden sm:block text-stone-400 text-xs">Hold and drag to rearrange · shared with your partner</p>
          <button onClick={finish} className="rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-stone-950">Done</button>
        </div>
      )}

      <div className="hw-wrap">
      <div
        ref={gridRef}
        onPointerMove={onPointerMove}
        onPointerUp={drop}
        onPointerCancel={() => drop()}
        className="relative flex flex-col gap-6"
      >
        {runs(shown.map((item, n) => {
          const meta = WIDGETS[item.id]
          const members = idsOf(item).map(id => ({ id, node: nodeFor({ id, size: item.size }) }))
          const visible = editing ? members : members.filter(m => m.node)
          if (!visible.length) return null
          const stacked = item.stack?.length ? visible : null
          const lifted = dragId === item.id
          return (
            <div
              key={item.id}
              data-wid={item.id}
              tabIndex={editing ? 0 : undefined}
              role={editing ? 'button' : undefined}
              aria-roledescription={editing ? 'movable widget' : undefined}
              aria-label={editing ? `${item.stack?.length ? `Stack of ${idsOf(item).map(id => WIDGETS[id].name).join(', ')}` : meta.name}, ${SIZE_NAMES[item.size].toLowerCase()}. Position ${n + 1} of ${shown.length}. Arrow keys move it; tap for options.` : undefined}
              onPointerDown={e => onPointerDown(e, item.id)}
              onKeyDown={e => onKey(e, item.id)}
              onContextMenu={editing ? e => e.preventDefault() : undefined}
              className={`hw-cell relative min-w-0 min-h-0 ${SPAN[item.size]} ${editing ? 'cursor-grab [-webkit-touch-callout:none] outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-[22px]' : ''} ${lifted ? 'z-20 cursor-grabbing' : ''}`}
            >
              <div className={`h-full ${editing && !lifted ? `hw-jiggle ${n % 2 ? 'hw-jiggle-b' : ''}` : ''} ${lifted ? 'scale-[1.04] drop-shadow-2xl' : ''} transition-transform`}>
                <div inert={editing} style={tintStyle(item.tint)} className={`w-full rounded-[22px] ${item.size === 'w' ? '' : 'h-full overflow-hidden'} ${item.tint ? `hw-tinted hw-tint-${item.tint}` : ''} ${editing ? 'pointer-events-none' : ''}`}>
                  {stacked
                    ? <Stack members={stacked} editing={editing} />
                    : visible[0].node ?? <Placeholder id={item.id} />}
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
                  {sizesOf(item).length > 1 && (
                    <button
                      data-nodrag
                      onClick={() => resize(item.id)}
                      aria-label={`${meta.name} is ${SIZE_NAMES[item.size].toLowerCase()}. Make it ${SIZE_NAMES[nextSize(item.id, item.size, item.stack)].toLowerCase()}`}
                      className="absolute -right-1.5 -bottom-1.5 z-10 flex items-center gap-1 rounded-full bg-stone-700 px-2.5 h-7 text-[11px] font-medium text-amber-50 shadow-lg ring-1 ring-black/30"
                    >
                      <LayoutGrid size={12} /> {SIZE_NAMES[item.size]}
                    </button>
                  )}
                </>
              )}
            </div>
          )
        }), shown)}
      </div>
      </div>

      {editing && shown.length === 0 && (
        <button onClick={() => setAdding(true)} className="w-full tile p-6 text-stone-400 text-sm flex items-center justify-center gap-2">
          <Plus size={16} /> Your Home is empty. Add a widget
        </button>
      )}

      {!editing && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => { haptic(); if (plus) setEditing(true); else setAdding(true) }}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs text-stone-400 hover:text-amber-200 hover:bg-stone-800/50 transition-colors"
          >
            {plus ? <LayoutGrid size={14} /> : <Lock size={12} />} {saving ? 'Saving…' : 'Edit Home'}
          </button>
        </div>
      )}

      {options && (() => {
        const item = layout.find(i => i.id === options)
        return item ? (
          <OptionsSheet
            item={item}
            layout={layout}
            onChange={(next, extra) => change(item.id, next, extra)}
            onClose={() => setOptions(null)}
          />
        ) : null
      })()}

      {adding && (
        <AddSheet
          layout={layout}
          plus={plus}
          nodeFor={nodeFor}
          unit={unit()}
          onAdd={add}
          onReset={() => { haptic(); update(DEFAULT_LAYOUT.map(i => ({ ...i }))); setAdding(false) }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  )
}

function Preview({ node, size, unit, meta }: { node: React.ReactNode; size: WidgetSize; unit: number; meta: (typeof WIDGETS)[WidgetId] }) {
  // The widget at its real size, scaled down to fit the sheet.
  const gap = 14
  if (size === 'w') {
    // A Full card is as tall as its content, so shrink the whole card.
    const w = 2 * unit + gap
    const fit = Math.min(1, 300 / w)
    return (
      <div inert className="mx-auto max-h-[300px] overflow-hidden pointer-events-none" style={{ width: w * fit }}>
        <div className="hw-cell" style={{ width: w, zoom: fit }}>
          {node ?? <div className="tile p-6 text-center text-amber-50 text-sm">{meta.emoji} {meta.name}</div>}
        </div>
      </div>
    )
  }
  const [c, r] = CELLS[size]
  const w = c * unit + (c - 1) * gap, h = r * unit + (r - 1) * gap
  const fit = Math.min(1, 300 / w, 300 / h)
  return (
    <div className="mx-auto" style={{ width: w * fit, height: h * fit }}>
      <div inert className="hw-cell origin-top-left overflow-hidden rounded-[22px] pointer-events-none" style={{ width: w, height: h, scale: String(fit) }}>
        {node ?? (
          <div className="tile h-full w-full p-4 flex flex-col items-center justify-center gap-1 text-center">
            <span className="text-3xl" aria-hidden>{meta.emoji}</span>
            <span className="text-amber-50 text-sm">{meta.name}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function AddSheet({ layout, plus, nodeFor, unit, onAdd, onReset, onClose }: {
  layout: LayoutItem[]
  plus: boolean
  nodeFor: (i: { id: WidgetId; size: WidgetSize }) => React.ReactNode
  unit: number
  onAdd: (id: WidgetId, size: WidgetSize) => void
  onReset: () => void
  onClose: () => void
}) {
  const [open, setOpen] = useState<WidgetId | null>(null)
  const [size, setSize] = useState<WidgetSize>('s')
  const close = useCallback(() => { if (open) setOpen(null); else onClose() }, [open, onClose])
  useEscape(true, close)
  const onHome = new Set(layout.flatMap(idsOf))
  const choices = WIDGET_IDS.filter(id => !plus || !onHome.has(id))
  const pick = (id: WidgetId) => { haptic(); setOpen(id); setSize(WIDGETS[id].sizes[0]) }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Widgets" className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55 animate-fade" />
      <div className="relative w-full md:max-w-lg max-h-[88dvh] overflow-y-auto rounded-t-[28px] md:rounded-[28px] bg-stone-900 px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))] animate-sheet">
        {open ? (() => {
          const meta = WIDGETS[open]
          const locked = !plus || (meta.plus && !plus)
          return (
            <div className="flex flex-col items-center text-center">
              <div className="w-full flex items-center justify-between mb-2">
                <button onClick={() => setOpen(null)} className="text-sm text-amber-400">Back</button>
                <button onClick={onClose} aria-label="Close" className="grid place-items-center h-9 w-9 rounded-full bg-stone-800 text-stone-300"><X size={16} /></button>
              </div>
              <h2 className="text-[22px] font-semibold text-amber-50">{meta.name}</h2>
              <p className="text-stone-400 text-sm mt-1 mb-6 max-w-xs">{meta.blurb}</p>
              <div className="h-[300px] w-full grid place-items-center"><Preview node={nodeFor({ id: open, size })} size={size} unit={unit} meta={meta} /></div>
              {meta.sizes.length > 1 && (
                <div className="mt-5 flex items-center gap-1 rounded-full bg-stone-800/70 p-1">
                  {meta.sizes.map(s => (
                    <button key={s} onClick={() => { haptic(); setSize(s) }} aria-pressed={s === size} className={`rounded-full px-4 py-1.5 text-xs transition-colors ${s === size ? 'bg-stone-600 text-amber-50' : 'text-stone-400'}`}>{SIZE_NAMES[s]}</button>
                  ))}
                </div>
              )}
              {locked ? (
                <Link href="/plus" className="mt-6 w-full flex items-center justify-center gap-2 rounded-full bg-amber-500 py-3.5 text-[15px] font-semibold text-stone-950">
                  <Lock size={15} /> {plus ? 'Get Plus for this widget' : 'Customize Home with Plus'}
                </Link>
              ) : (
                <button onClick={() => onAdd(open, size)} className="mt-6 w-full flex items-center justify-center gap-2 rounded-full bg-amber-500 py-3.5 text-[15px] font-semibold text-stone-950">
                  <Plus size={17} strokeWidth={2.5} /> Add Widget
                </button>
              )}
            </div>
          )
        })() : (
          <>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[22px] font-semibold text-amber-50">Widgets</h2>
              <button onClick={onClose} aria-label="Close" className="grid place-items-center h-9 w-9 rounded-full bg-stone-800 text-stone-300"><X size={16} /></button>
            </div>
            <p className="text-stone-400 text-sm mb-4">
              {plus ? 'Your partner sees the same Home, so pick together.' : 'Arrange Home your way with Plus: add, resize and drag any of these.'}
            </p>
            {choices.length === 0 && <p className="text-stone-400 text-sm py-6 text-center">Every widget is already on your Home.</p>}
            <ul className="flex flex-col gap-1">
              {choices.map(id => {
                const meta = WIDGETS[id]
                return (
                  <li key={id}>
                    <button onClick={() => pick(id)} className="w-full rounded-[16px] px-2 py-2.5 flex items-center gap-3 text-left hover:bg-stone-800/60 transition-colors">
                      <span className="grid place-items-center h-11 w-11 shrink-0 rounded-[12px] bg-stone-800 text-xl" aria-hidden>{meta.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 text-amber-50 text-[15px] font-medium">
                          {meta.name}
                          {meta.plus && <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">Plus</span>}
                        </span>
                        <span className="block text-stone-400 text-xs leading-snug truncate">{meta.blurb}</span>
                      </span>
                      <ChevronRight size={16} className="text-stone-600 shrink-0" />
                    </button>
                  </li>
                )
              })}
            </ul>
            {plus && (
              <button onClick={onReset} className="mt-5 mx-auto flex items-center gap-1.5 text-stone-500 hover:text-stone-300 text-xs">
                <RotateCcw size={12} /> Reset to the original Home
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

function Placeholder({ id }: { id: WidgetId }) {
  const meta = WIDGETS[id]
  return (
    <div className="tile h-full w-full p-4 flex flex-col items-center justify-center gap-1 text-center">
      <span className="text-2xl" aria-hidden>{meta.emoji}</span>
      <span className="text-amber-50 text-sm">{meta.name}</span>
      <span className="text-stone-500 text-[11px] leading-snug line-clamp-3">{meta.blurb} Shows up when there’s something here.</span>
    </div>
  )
}

// A Smart Stack: widgets sharing one spot. Swipe sideways through them; it
// opens on Your move when something is waiting on you.
function Stack({ members, editing }: { members: { id: WidgetId; node: React.ReactNode }[]; editing: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  useEffect(() => {
    const el = ref.current
    const start = members.findIndex(m => m.id === 'moves' && m.node)
    if (el && start > 0) el.scrollLeft = start * el.clientWidth
    // Only when it first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="relative h-full w-full">
      <div
        ref={ref}
        onScroll={e => setAt(Math.round(e.currentTarget.scrollLeft / Math.max(1, e.currentTarget.clientWidth)))}
        className="hw-stack h-full w-full flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain"
      >
        {members.map(m => (
          <div key={m.id} className="h-full w-full shrink-0 snap-center snap-always">
            {m.node ?? <Placeholder id={m.id} />}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-1.5 inset-x-0 flex justify-center gap-1" aria-hidden>
        {members.map((m, i) => (
          <span key={m.id} className={`h-1.5 rounded-full transition-all ${i === at ? 'w-3 bg-amber-50/90' : 'w-1.5 bg-amber-50/35'}`} />
        ))}
      </div>
      {editing && (
        <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-amber-50"><Layers size={10} /> {members.length}</span>
      )}
    </div>
  )
}

// Tap a widget while editing: its size, its color, and stacking it with others.
function OptionsSheet({ item, layout, onChange, onClose }: {
  item: LayoutItem
  layout: LayoutItem[]
  onChange: (next: LayoutItem | null, extra?: LayoutItem[]) => void
  onClose: () => void
}) {
  useEscape(true, onClose)
  const ids = idsOf(item)
  const sizes = sizesOf(item)
  // Others on Home that could join this stack (same size, and not a stack themselves).
  const joinable = layout.filter(i => i.id !== item.id && !i.stack?.length && i.size === item.size && WIDGETS[i.id].sizes.includes(item.size))
  const set = (patch: Partial<LayoutItem>) => onChange({ ...item, ...patch })
  const join = (other: LayoutItem) => {
    if (ids.length >= 10) return
    // The other widget leaves its own spot and joins this one.
    onChange({ ...item, stack: [...(item.stack ?? []), other.id] })
  }
  const takeOut = (id: WidgetId) => {
    const rest = ids.filter(x => x !== id)
    const [top, ...more] = rest
    onChange({ ...item, id: top, stack: more.length ? more : undefined }, [{ id, size: item.size }])
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`${WIDGETS[item.id].name} options`} className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55 animate-fade" />
      <div className="relative w-full md:max-w-md max-h-[88dvh] overflow-y-auto rounded-t-[28px] md:rounded-[28px] bg-stone-900 px-5 pt-5 pb-[calc(20px+env(safe-area-inset-bottom))] animate-sheet">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[20px] font-semibold text-amber-50 truncate">
            {ids.length > 1 ? 'Smart Stack' : <>{WIDGETS[item.id].emoji} {WIDGETS[item.id].name}</>}
          </h2>
          <button onClick={onClose} className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-semibold text-stone-950">Done</button>
        </div>

        {sizes.length > 1 && (
          <section className="mb-5">
            <p className="text-stone-400 text-xs uppercase tracking-[0.16em] mb-2">Size</p>
            <div className="flex items-center gap-1 rounded-full bg-stone-800/70 p-1 w-fit">
              {sizes.map(s => (
                <button key={s} onClick={() => set({ size: s })} aria-pressed={s === item.size} className={`rounded-full px-4 py-1.5 text-xs transition-colors ${s === item.size ? 'bg-stone-600 text-amber-50' : 'text-stone-400'}`}>{SIZE_NAMES[s]}</button>
              ))}
            </div>
          </section>
        )}

        <section className="mb-5">
          <p className="text-stone-400 text-xs uppercase tracking-[0.16em] mb-2">Color</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={() => set({ tint: undefined })} aria-pressed={!item.tint} aria-label="No color"
              className={`grid place-items-center h-9 w-9 rounded-full bg-stone-800 ring-offset-2 ring-offset-stone-900 ${!item.tint ? 'ring-2 ring-amber-400' : ''}`}>
              {!item.tint && <Check size={14} className="text-amber-50" />}
            </button>
            {TINTS.map(t => (
              <button key={t} onClick={() => set({ tint: t })} aria-pressed={item.tint === t} aria-label={TINT_NAMES[t]}
                style={{ background: TINT_COLOR[t] }}
                className={`grid place-items-center h-9 w-9 rounded-full ring-offset-2 ring-offset-stone-900 ${item.tint === t ? 'ring-2 ring-amber-400' : ''}`}>
                {item.tint === t && <Check size={14} className="text-stone-950" />}
              </button>
            ))}
          </div>
        </section>

        {item.size !== 'w' && <section>
          <p className="text-stone-400 text-xs uppercase tracking-[0.16em] mb-1">Smart Stack</p>
          <p className="text-stone-500 text-xs mb-2">Stack widgets in one spot and swipe between them.</p>
          {ids.length > 1 && (
            <ul className="mb-3 flex flex-col gap-1">
              {ids.map(id => (
                <li key={id} className="flex items-center gap-3 rounded-[14px] bg-stone-800/50 px-3 py-2">
                  <span aria-hidden>{WIDGETS[id].emoji}</span>
                  <span className="flex-1 text-sm text-amber-50">{WIDGETS[id].name}</span>
                  <button onClick={() => takeOut(id)} className="text-xs text-amber-400">Take out</button>
                </li>
              ))}
            </ul>
          )}
          {joinable.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {joinable.map(o => (
                <button key={o.id} onClick={() => join(o)} className="flex items-center gap-1.5 rounded-full bg-stone-800 px-3 py-1.5 text-xs text-amber-50">
                  <Plus size={12} /> {WIDGETS[o.id].emoji} {WIDGETS[o.id].name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-stone-500 text-xs">Other {SIZE_NAMES[item.size].toLowerCase()} widgets on your Home can join this one.</p>
          )}
        </section>}
      </div>
    </div>,
    document.body,
  )
}
