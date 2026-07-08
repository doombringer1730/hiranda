import { createDeck } from '../actions'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// Minimal create step — title + optional description. Cards are added on the
// deck page right after, so you can start typing terms immediately.
export default function NewDeckPage() {
  return (
    <div className="px-4 pt-4 pb-8 max-w-md mx-auto">
      <Link href="/study" className="inline-flex items-center gap-1.5 text-stone-500 hover:text-stone-300 text-sm transition-colors mb-6">
        <ArrowLeft size={15} /> Study
      </Link>
      <h1 className="font-serif text-3xl text-amber-100 mb-6">New deck</h1>
      <form action={createDeck} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="text-stone-400 text-xs uppercase tracking-widest">Title</label>
          <input id="title" name="title" required maxLength={120} autoFocus
            placeholder="e.g. Spanish verbs, Bio chapter 4"
            className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 transition-colors" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className="text-stone-400 text-xs uppercase tracking-widest">Description <span className="text-stone-600 normal-case tracking-normal">(optional)</span></label>
          <input id="description" name="description" maxLength={300}
            className="bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 focus:outline-none focus:border-amber-700 transition-colors" />
        </div>
        <button type="submit" className="mt-2 bg-amber-700 hover:bg-amber-600 text-amber-50 font-medium rounded-xl px-4 py-3 transition-colors">
          Create &amp; add cards
        </button>
      </form>
    </div>
  )
}
