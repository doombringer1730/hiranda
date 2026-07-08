'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ZoomIn } from 'lucide-react'

type Props = {
  file: File
  aspect: number      // width / height of the crop frame
  outWidth: number     // exported pixel width (height derived from aspect)
  title: string
  onCancel: () => void
  onApply: (blob: Blob) => void
}

// Lightweight pan + zoom cropper. The image is positioned to always cover the
// crop viewport; on apply we draw the visible region to a canvas and export.
export default function ImageCropper({ file, aspect, outWidth, title, onCancel, onApply }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [src, setSrc] = useState<string>('')
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null)
  const [vw, setVw] = useState(0)               // viewport width (css px)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const vh = vw / aspect

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    if (viewportRef.current) setVw(viewportRef.current.clientWidth)
  }, [src])

  // cover-scale so the image fills the viewport at zoom = 1
  const baseScale = natural && vw ? Math.max(vw / natural.w, vh / natural.h) : 1
  const dispW = natural ? natural.w * baseScale * zoom : 0
  const dispH = natural ? natural.h * baseScale * zoom : 0

  const clamp = useCallback((o: { x: number; y: number }) => ({
    x: Math.min(0, Math.max(vw - dispW, o.x)),
    y: Math.min(0, Math.max(vh - dispH, o.y)),
  }), [vw, vh, dispW, dispH])

  // recenter when zoom or image changes
  useEffect(() => {
    if (!natural || !vw) return
    setOffset(o => clamp({ x: o.x || (vw - dispW) / 2, y: o.y || (vh - dispH) / 2 }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [natural, vw, zoom])

  function onImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    imgRef.current = img
    setNatural({ w: img.naturalWidth, h: img.naturalHeight })
  }

  function onPointerDown(e: React.PointerEvent) {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    setOffset(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) }))
  }
  function onPointerUp() { drag.current = null }

  async function apply() {
    if (!natural) return
    setBusy(true)
    const scale = baseScale * zoom
    // viewport (0,0) maps to this point in natural image coords
    const sx = -offset.x / scale
    const sy = -offset.y / scale
    const sW = vw / scale
    const sH = vh / scale
    const canvas = document.createElement('canvas')
    canvas.width = outWidth
    canvas.height = Math.round(outWidth / aspect)
    const ctx = canvas.getContext('2d')!
    const img = imgRef.current!
    ctx.drawImage(img, sx, sy, sW, sH, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(b => { if (b) onApply(b); setBusy(false) }, 'image/jpeg', 0.9)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5 bg-black/70" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-sm bg-stone-900 border border-stone-800 rounded-2xl p-4 flex flex-col gap-4 animate-page-in">
        <p className="text-amber-100 font-medium">{title}</p>
        <div
          ref={viewportRef}
          className="relative w-full overflow-hidden rounded-xl bg-stone-950 touch-none cursor-grab active:cursor-grabbing select-none"
          style={{ height: vh || 200 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt=""
              onLoad={onImgLoad}
              draggable={false}
              className="absolute top-0 left-0 max-w-none pointer-events-none"
              style={{ width: dispW || 'auto', height: dispH || 'auto', transform: `translate(${offset.x}px, ${offset.y}px)` }}
            />
          )}
          {/* subtle frame guide */}
          <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl pointer-events-none" />
        </div>

        <div className="flex items-center gap-3">
          <ZoomIn size={16} className="text-stone-500 shrink-0" />
          <input
            type="range" min={1} max={4} step={0.01} value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="flex-1 accent-amber-600"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl py-2.5 text-sm transition-colors">Cancel</button>
          <button onClick={apply} disabled={busy || !natural} className="flex-1 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 rounded-xl py-2.5 text-sm transition-colors">
            {busy ? 'Saving…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}
