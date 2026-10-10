import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PageHeader from '@/components/page-header'
import PrintButton from './print-button'
import { hasPlus } from '@/lib/plus'

type Memory = {
  id: string
  title: string
  body: string | null
  happened_at: string
  location_name: string | null
  photos: { id: string; storage_path: string }[] | null
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Stable little tilt per memory, so the collage looks hand-placed but never
// reshuffles between visits (or between the screen and the printout).
function tilt(id: string, i = 0) {
  let h = 0
  for (const c of id + i) h = (h * 31 + c.charCodeAt(0)) | 0
  return ((Math.abs(h) % 7) - 3) * 0.9
}

function prettyDate(d: string) {
  return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default async function MemoryBookPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { year } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: couples } = await supabase
    .from('couple').select('user1_id, user2_id, together_since')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('user2_id', { nullsFirst: false }).limit(1)
  const couple = couples?.[0]

  const [{ data: rows }, { data: profiles }] = await Promise.all([
    supabase.from('memories')
      .select('id, title, body, happened_at, location_name, photos(id, storage_path)')
      .order('happened_at', { ascending: true }),
    supabase.from('profiles').select('id, display_name')
      .in('id', [couple?.user1_id, couple?.user2_id].filter(Boolean) as string[]),
  ])
  const all = (rows ?? []) as Memory[]
  const years = [...new Set(all.map(m => m.happened_at.slice(0, 4)))].sort()
  const memories = year ? all.filter(m => m.happened_at.startsWith(year)) : all

  // One batch of signed URLs for every photo in the book (max 3 per memory).
  const paths = memories.flatMap(m => (m.photos ?? []).slice(0, 3).map(p => p.storage_path))
  const urls = new Map<string, string>()
  if (paths.length) {
    const { data } = await supabase.storage.from('photos').createSignedUrls(paths, 60 * 60 * 3)
    for (const r of data ?? []) if (r.path && r.signedUrl) urls.set(r.path, r.signedUrl)
  }

  // year → month → memories
  const chapters = new Map<string, Map<number, Memory[]>>()
  for (const m of memories) {
    const y = m.happened_at.slice(0, 4), mo = Number(m.happened_at.slice(5, 7)) - 1
    if (!chapters.has(y)) chapters.set(y, new Map())
    const months = chapters.get(y)!
    months.set(mo, [...(months.get(mo) ?? []), m])
  }

  const names = (profiles ?? []).map(p => p.display_name.split(' ')[0])
  const photoCount = memories.reduce((n, m) => n + (m.photos?.length ?? 0), 0)
  const since = couple?.together_since
    ? new Date(couple.together_since + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="px-4 pt-8 max-w-3xl mx-auto pb-12">
      {/* Toolbar — never printed */}
      <div className="print:hidden">
        <div className="flex items-end justify-between gap-3 mb-5">
          <PageHeader eyebrow="Ours, in print" title="Memory Book" />
          <PrintButton plus={await hasPlus()} />
        </div>
        {years.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-3 [scrollbar-width:none]">
            {[undefined, ...years].map(y => (
              <Link
                key={y ?? 'all'}
                href={y ? `/memories/book?year=${y}` : '/memories/book'}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition-colors ${
                  (year ?? undefined) === y ? 'bg-stone-700 text-amber-50' : 'bg-stone-900/70 text-stone-400 hover:text-stone-200'
                }`}
              >
                {y ?? 'All time'}
              </Link>
            ))}
          </div>
        )}
        <p className="text-stone-500 text-xs mb-6">
          Tip: “Save as PDF” in the print dialog, then print at home. Or{' '}
          <Link href="/memories/print?kind=book" className="text-amber-400 underline underline-offset-4">order it as a bound photo book</Link>.
        </p>
      </div>

      <div className="book">
        {/* Cover */}
        <section className="book-page book-cover">
          <p className="book-eyebrow">Kids, this is the story of us</p>
          <h2 className="font-serif text-6xl md:text-7xl leading-[0.95] mt-4">
            {names.length === 2 ? <>{names[0]} <span className="italic">&amp;</span> {names[1]}</> : 'Us'}
          </h2>
          {since && <p className="mt-4 text-lg italic font-serif opacity-80">since {since}</p>}
          <p className="mt-10 text-sm opacity-70">
            {year ? `${year} · ` : ''}{memories.length} memories · {photoCount} photos
          </p>
          <p className="book-mark font-serif">Hiranda.</p>
        </section>

        {!memories.length && (
          <section className="book-page flex flex-col items-center justify-center text-center gap-3">
            <p className="font-serif text-3xl">The first page is waiting.</p>
            <Link href="/memories/new" className="print:hidden underline underline-offset-4 opacity-80">Add a memory →</Link>
          </section>
        )}

        {[...chapters].map(([y, months]) => (
          <section key={y} className="book-page">
            <h2 className="font-serif text-5xl border-b border-current/15 pb-3 mb-6">{y}</h2>
            {[...months].map(([mo, list]) => (
              <div key={mo} className="mb-8 break-inside-avoid-page">
                <h3 className="book-eyebrow mb-4">{MONTHS[mo]}</h3>
                <div className="columns-2 md:columns-3 gap-5">
                  {list.map(m => {
                    const photos = (m.photos ?? []).slice(0, 3).map(p => urls.get(p.storage_path)).filter(Boolean) as string[]
                    return photos.length ? (
                      photos.map((src, i) => (
                        <figure key={m.id + i} className="polaroid" style={{ rotate: `${tilt(m.id, i)}deg` }}>
                          <span className="tape" style={{ rotate: `${-tilt(m.id, i + 9) * 2}deg` }} aria-hidden />
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={i === 0 ? m.title : ''} loading="lazy" />
                          {i === 0 && (
                            <figcaption>
                              <span className="font-serif italic text-[15px] leading-tight block">{m.title}</span>
                              <span className="text-[10px] opacity-60">{prettyDate(m.happened_at)}{m.location_name ? ` · ${m.location_name}` : ''}</span>
                            </figcaption>
                          )}
                        </figure>
                      ))
                    ) : (
                      <article key={m.id} className="notecard" style={{ rotate: `${tilt(m.id) * 0.6}deg` }}>
                        <p className="text-[10px] uppercase tracking-[0.2em] opacity-60">{prettyDate(m.happened_at)}</p>
                        <p className="font-serif text-xl leading-tight mt-1">{m.title}</p>
                        {m.body && <p className="text-[13px] leading-relaxed mt-2 opacity-80 line-clamp-6">{m.body}</p>}
                      </article>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
