import Link from 'next/link'

// Shared shell for /privacy and /terms — readable long-form, public.
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-5 py-12">
      <article className="max-w-2xl mx-auto">
        <Link href="/" className="text-stone-500 hover:text-amber-300 text-sm">← Hiranda</Link>
        <p className="mt-8 text-stone-500 text-[10px] uppercase tracking-[0.3em]">Last updated {updated}</p>
        <h1 className="font-serif text-5xl text-amber-50 mt-2">{title}<span className="text-amber-500">.</span></h1>
        <div className="mt-8 flex flex-col gap-5 text-stone-300 text-[15px] leading-relaxed [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-amber-50 [&_h2]:mt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_b]:text-amber-50 [&_b]:font-medium">
          {children}
        </div>
      </article>
    </main>
  )
}
