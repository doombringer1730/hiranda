import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { hasPlus } from '@/lib/plus'
import { togetherStubs, totalHours } from '@/lib/together'
import { Polaroid, Scribble } from '@/components/handmade'

export const metadata = { title: 'Our month · Hiranda' }

// "Our Month": a keepsake of one month together. Things you made, not scores:
// no counts of what you missed, no comparing partners. The cover is free; the
// full story comes with Plus.

const monthKey = (d: Date) => d.toISOString().slice(0, 7)
function shift(key: string, by: number) {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(Date.UTC(y, m - 1 + by, 1)))
}
// The most recent finished month is the default keepsake.
function lastMonth(now = new Date()) { return shift(monthKey(now), -1) }

export default async function OurMonthPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const current = monthKey(new Date())
  const key = m && /^\d{4}-\d{2}$/.test(m) && m <= current ? m : lastMonth()
  const from = `${key}-01`, to = `${shift(key, 1)}-01`
  const fromTs = `${from}T00:00:00Z`, toTs = `${to}T00:00:00Z`
  const title = new Date(`${from}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const inProgress = key === current

  const { data: couple } = await supabase.from('couple').select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`).order('user2_id', { nullsFirst: false }).limit(1).maybeSingle()
  const partnerId = couple ? (couple.user1_id === user.id ? couple.user2_id : couple.user1_id) : null

  const [plus, { data: mems }, { data: goodNews }, { data: answers }, { data: songs }, { count: letters }, { count: thanks }, { data: someday }, stubs, { data: people }] = await Promise.all([
    hasPlus(),
    supabase.from('memories').select('id, title, happened_at, photos(storage_path)').gte('happened_at', from).lt('happened_at', to).order('happened_at'),
    supabase.from('messages').select('id, sender, body, created_at').eq('kind', 'good_news').gte('created_at', fromTs).lt('created_at', toTs).order('created_at').limit(12),
    supabase.from('prompt_responses').select('prompt_id, user_id, prompts!inner(text)').gte('responded_at', fromTs).lt('responded_at', toTs).limit(400),
    supabase.from('music_moments').select('id, song_name, artist').gte('created_at', fromTs).lt('created_at', toTs).order('created_at').limit(12),
    supabase.from('letters').select('id', { count: 'exact', head: true }).gte('created_at', fromTs).lt('created_at', toTs),
    supabase.from('jar_slips').select('id', { count: 'exact', head: true }).eq('jar', 'thanks').gte('created_at', fromTs).lt('created_at', toTs),
    supabase.from('bucket_list').select('id, title').eq('completed', true).gte('completed_at', fromTs).lt('completed_at', toTs),
    togetherStubs(supabase, fromTs, toTs),
    supabase.from('profiles').select('id, display_name').in('id', [user.id, ...(partnerId ? [partnerId] : [])]),
  ])

  const first = (id: string) => (people ?? []).find(p => p.id === id)?.display_name.split(' ')[0] ?? 'You'
  const memories = (mems ?? []) as { id: string; title: string; happened_at: string; photos: { storage_path: string }[] | null }[]
  const withPhoto = memories.filter(x => x.photos?.length)
  const cover = withPhoto[0] ?? null
  const paths = (plus ? withPhoto.slice(0, 4) : withPhoto.slice(0, 1)).map(x => x.photos![0].storage_path)
  const urls = new Map<string, string>()
  if (paths.length) {
    const { data } = await supabase.storage.from('photos').createSignedUrls(paths, 3600)
    for (const r of data ?? []) if (r.path && r.signedUrl) urls.set(r.path, r.signedUrl)
  }

  // Questions you both answered this month.
  const byPrompt = new Map<string, { text: string; who: Set<string> }>()
  for (const a of (answers ?? []) as { prompt_id: string; user_id: string; prompts: { text: string } | { text: string }[] }[]) {
    const text = Array.isArray(a.prompts) ? a.prompts[0]?.text : a.prompts?.text
    const e = byPrompt.get(a.prompt_id) ?? { text: text ?? '', who: new Set<string>() }
    e.who.add(a.user_id); byPrompt.set(a.prompt_id, e)
  }
  const together = [...byPrompt.values()].filter(e => e.who.size >= 2)
  const hours = totalHours(stubs)
  const watchNights = stubs.filter(s => s.kind === 'watch')

  const lines = [
    memories.length && `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'} pinned up`,
    together.length && `${together.length} question${together.length === 1 ? '' : 's'} answered together`,
    hours >= 0.5 && `${hours < 10 ? hours.toFixed(1) : Math.round(hours)} hours side by side`,
    (songs ?? []).length && `${songs!.length} song${songs!.length === 1 ? '' : 's'} added`,
  ].filter(Boolean) as string[]

  const empty = !lines.length && !(goodNews ?? []).length && !letters && !thanks && !(someday ?? []).length

  return (
    <div className="px-4 pt-6 pb-16 max-w-xl mx-auto">
      <nav className="flex items-center justify-between text-sm text-stone-400 mb-6">
        <Link href={`/month?m=${shift(key, -1)}`} className="inline-flex items-center gap-1 hover:text-amber-100"><ChevronLeft size={16} /> Earlier</Link>
        {key < current && <Link href={`/month?m=${shift(key, 1)}`} className="inline-flex items-center gap-1 hover:text-amber-100">Later <ChevronRight size={16} /></Link>}
      </nav>

      {/* Cover: free for everyone */}
      <section className="book-cover rounded-2xl p-7 relative overflow-hidden text-amber-50">
        <p className="book-eyebrow">Our month{inProgress ? ' · so far' : ''}</p>
        <h1 className="font-serif text-5xl mt-3 leading-none">{title.split(' ')[0]}<span className="text-amber-500">.</span></h1>
        <p className="text-amber-100/60 mt-1">{title.split(' ')[1]}</p>
        {cover && (
          <div className="mt-6 w-48 mx-auto">
            <Polaroid src={urls.get(cover.photos![0].storage_path) ?? null} caption={cover.title} tilt={-3} />
          </div>
        )}
        <p className="font-hand text-[24px] text-amber-300/90 mt-6 leading-snug">
          {empty ? 'a quiet month. those count too.' : lines[0] ?? 'a month of small things.'}
        </p>
      </section>

      {!plus ? (
        <Link href="/plus" className="mt-6 block paper rounded-xl p-5">
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.22em] text-[var(--paper-muted)]"><Sparkles size={12} /> Hiranda Plus</p>
          <p className="font-serif text-xl mt-1">Read the whole month</p>
          <p className="text-sm text-[var(--paper-muted)] mt-1">Plus turns every month into a keepsake: your photos, the good news you celebrated, the questions you both answered and the songs you added.</p>
        </Link>
      ) : empty ? (
        <p className="mt-8 text-center text-stone-400 text-sm">Nothing pinned this month yet. The next memory you add will start the page.</p>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {lines.length > 1 && (
            <ul className="paper paper-ruled rounded-lg px-6 py-5 font-hand text-[22px] leading-[30px] -rotate-[0.6deg]">
              {lines.map(l => <li key={l}>{l}</li>)}
            </ul>
          )}

          {withPhoto.length > 1 && (
            <section className="grid grid-cols-2 gap-5 px-2">
              {withPhoto.slice(1, 4).map((x, i) => (
                <Link key={x.id} href={`/memories/${x.id}`}>
                  <Polaroid src={urls.get(x.photos![0].storage_path) ?? null} caption={x.title} tilt={i % 2 ? 2.5 : -2} tape={i === 0} />
                </Link>
              ))}
            </section>
          )}

          {(goodNews ?? []).length > 0 && (
            <section>
              <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-3">Good news you celebrated</h2>
              <div className="flex flex-col gap-3">
                {goodNews!.map((g, i) => (
                  <blockquote key={g.id} className="paper rounded-md px-4 py-3" style={{ rotate: `${i % 2 ? 0.8 : -0.8}deg` }}>
                    <p className="font-serif text-[17px] leading-snug">“{g.body}”</p>
                    <p className="text-xs text-[var(--paper-muted)] mt-1">{first(g.sender)} · {new Date(g.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                  </blockquote>
                ))}
              </div>
            </section>
          )}

          {together.length > 0 && (
            <section>
              <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-3">Questions you both answered</h2>
              <ul className="flex flex-col gap-2">
                {together.slice(0, 5).map(q => <li key={q.text} className="font-serif text-lg text-amber-50 leading-snug">{q.text}</li>)}
              </ul>
            </section>
          )}

          {watchNights.length > 0 && (
            <section>
              <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-3">Watched together</h2>
              <p className="text-stone-300">{watchNights.slice(0, 6).map(s => s.title).join(' · ')}</p>
              <Link href="/together" className="text-xs text-amber-400 hover:text-amber-300 mt-1 inline-block">All your ticket stubs →</Link>
            </section>
          )}

          {(songs ?? []).length > 0 && (
            <section>
              <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-3">The soundtrack</h2>
              <ol className="flex flex-col gap-1">
                {songs!.map(s => <li key={s.id} className="text-stone-200"><span className="text-amber-50">{s.song_name}</span> <span className="text-stone-500">· {s.artist}</span></li>)}
              </ol>
            </section>
          )}

          {(someday ?? []).length > 0 && (
            <section className="relative">
              <h2 className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-3">Somedays that became days</h2>
              <ul className="flex flex-col gap-1">
                {someday!.map(b => <li key={b.id} className="font-hand text-[22px] text-amber-200">✓ {b.title}</li>)}
              </ul>
            </section>
          )}

          {(!!letters || !!thanks) && (
            <p className="font-hand text-[22px] text-stone-300 text-center relative">
              {[letters && `${letters} letter${letters === 1 ? '' : 's'} sealed`, thanks && `${thanks} thank-you${thanks === 1 ? '' : 's'} dropped in the jar`].filter(Boolean).join(' and ')}.
              <Scribble kind="heart" className="inline-block w-5 h-5 ml-1 text-rose-400 align-middle" />
            </p>
          )}
        </div>
      )}
    </div>
  )
}
