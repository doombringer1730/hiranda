'use client'

import { Printer } from 'lucide-react'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 rounded-full bg-amber-700 hover:bg-amber-600 px-4 py-2.5 text-sm font-medium text-amber-50 transition-colors"
    >
      <Printer size={16} /> Print / Save PDF
    </button>
  )
}
