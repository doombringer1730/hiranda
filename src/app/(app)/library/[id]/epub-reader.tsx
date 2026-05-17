'use client'

import { useEffect, useRef, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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

  const handleLocationChange = useCallback((location: { start: { cfi: string } }) => {
    const cfi = location?.start?.cfi
    if (!cfi) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveProgress(bookId, cfi), 1500)
  }, [bookId])

  useEffect(() => {
    if (!viewerRef.current) return
    let rendition: typeof renditionRef.current

    async function init() {
      const ePub = (await import('epubjs')).default
      const book = ePub(epubUrl)

      rendition = book.renderTo(viewerRef.current!, {
        width: '100%',
        height: '100%',
        spread: 'none',
      })

      rendition.themes.default({
        body: {
          background: '#1c1208',
          color: '#fef3c7',
          fontFamily: 'Georgia, serif',
          lineHeight: '1.8',
          padding: '0 1rem',
        },
        a: { color: '#d97706' },
      })

      rendition.on('locationChanged', handleLocationChange)

      if (initialCfi) {
        await rendition.display(initialCfi)
      } else {
        await rendition.display()
      }

      renditionRef.current = rendition
    }

    init()

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      rendition?.destroy?.()
    }
  }, [epubUrl, initialCfi, handleLocationChange])

  function prev() { renditionRef.current?.prev() }
  function next() { renditionRef.current?.next() }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div ref={viewerRef} className="flex-1 min-h-0" />

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
