'use client'

import Link from 'next/link'
import { Printer, Sparkles } from 'lucide-react'

// Printing / saving the book as a PDF is a Plus perk; the book itself is free.
export default function PrintButton({ plus }: { plus: boolean }) {
  if (!plus) {
    return (
      <Link
        href="/plus"
        className="flex items-center gap-2 rounded-full bg-stone-800 hover:bg-stone-700 px-4 py-2.5 text-sm font-medium text-stone-100 transition-colors"
      >
        <Sparkles size={15} className="text-amber-400" /> Print / Save PDF with Plus
      </Link>
    )
  }
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-full bg-amber-700 hover:bg-amber-600 px-4 py-2.5 text-sm font-medium text-amber-50 transition-colors"
    >
      <Printer size={16} /> Print / Save PDF
    </button>
  )
}
