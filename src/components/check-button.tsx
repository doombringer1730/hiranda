'use client'

import { useFormStatus } from 'react-dom'
import { Check } from 'lucide-react'
import { haptic, celebrate } from '@/lib/feel'

// A round, springy checkbox for use inside a <form action={...}>. It flips
// instantly while the server action runs (optimistic), pops, ticks the
// haptic, and sprinkles a little confetti when something gets done.
export default function CheckButton({ done, label }: { done: boolean; label: string }) {
  const { pending } = useFormStatus()
  const shown = pending ? !done : done
  return (
    <button
      type="submit"
      aria-label={done ? `Mark “${label}” not done` : `Mark “${label}” done`}
      aria-pressed={shown}
      onClick={e => {
        haptic()
        if (!done) celebrate(e.currentTarget, { count: 14, spread: 0.45 })
      }}
      className={`relative h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors duration-200 before:absolute before:-inset-2.5 before:content-[''] ${
        shown ? 'bg-amber-600 border-amber-600 text-amber-50' : 'border-stone-600 hover:border-amber-600'
      }`}
    >
      {shown && <Check key="on" size={14} strokeWidth={3} className="animate-pop" />}
    </button>
  )
}
