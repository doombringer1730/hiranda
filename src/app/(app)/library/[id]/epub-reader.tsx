'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { saveProgress } from '../actions'

type Props = {
  bookId: string
  epubUrl: string
  initialCfi: string | null
}

export default function EpubReader({ bookId, epubUrl, initialCfi }: Props) {
  const viewerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renditionRef = useRef<any>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const handleLocationChange = useCallback((location: { start: { cfi: string } }) => {
    const cfi = location?.start?.cfi
    if (!cfi) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveProgress(bookId, cfi), 1500)
  }, [bookId])

  useEffect(() => {
    if (!viewerRef.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rendition: any

    async function init() {
      try {
        const ePub = (await import('epubjs')).default

        // Fetch the epub as an ArrayBuffer to avoid CORS issues with signed URLs
        const res = await fetch(epubUrl)
        if (!res.ok) throw new Error('Failed to fetch book')
        const arrayBuffer = await res.arrayBuffer()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const book = ePub(arrayBuffer as any)
        await book.ready

        const h = viewerRef.current!.clientHeight || window.innerHeight - 140

        rendition = book.renderTo(viewerRef.current!, {
          width: '100%',
          height: h,
          flow: 'paginated',
          spread: 'none',
        })

        rendition.themes.default({
          body: {
            background: '#1c1208 !important',
            color: '#fef3c7 !important',
            fontFamily: 'Georgia, serif',
            lineHeight: '1.8',
            padding: '1rem 1.5rem',
            maxWidth: '680px',
            margin: '0 auto',
          },
          a: { color: '#d97706' },
          p: { margin: '0 0 1em' },
        })

        rendition.on('locationChanged', handleLocationChange)
        rendition.on('rendered', () => setLoading(false))

        if (initialCfi) {
          await rendition.display(initialCfi)
        } else {
          await rendition.display()
        }

        renditionRef.current = rendition
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load book')
        setLoading(false)
      }
    }

    init()

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      try { rendition?.destroy?.() } catch { /* ignore */ }
    }
  }, [epubUrl, initialCfi, handleLocationChange])

  function prev() { renditionRef.current?.prev() }
  function next() { renditionRef.current?.next() }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="relative flex-1 min-h-0">
        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-950 z-10">
            <Loader2 size={28} className="animate-spin text-amber-600" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-stone-950 z-10">
            <p className="text-red-400 text-sm text-center px-6">{error}</p>
          </div>
        )}
        <div ref={viewerRef} className="w-full h-full" />
      </div>

      <div className="flex items-center justify-between px-6 py-4 border-t border-stone-800 flex-shrink-0">
        <button
          onClick={prev}
          className="flex items-center gap-1 text-stone-400 hover:text-amber-300 transition-colors px-4 py-2 rounded-xl hover:bg-stone-800"
        >
          <ChevronLeft size={20} /> Prev
        </button>
        <button
          onClick={next}
          className="flex items-center gap-1 text-stone-400 hover:text-amber-300 transition-colors px-4 py-2 rounded-xl hover:bg-stone-800"
        >
          Next <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
