'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Plus, X, Star } from 'lucide-react'
import { Jar, SLIP_ME, SLIP_PARTNER } from '@/components/jar'
import { Scribble } from '@/components/handmade'
import WhyItWorks from '@/components/why-it-works'
import { haptic, celebrate, toast } from '@/lib/feel'
import { useLive } from '@/lib/use-live'
import { addBucketItem } from '../../bucket-list/actions'
import { getJar, addSlip, removeSlip, drawPair, type JarState } from './actions'

const GOAL = 10
const IDEAS = [
  'cook something neither of us has made', 'sunrise walk', 'build a blanket fort', 'try a restaurant we’ve never been to',
  'dance in the kitchen', 'stargazing', 'thrift each other an outfit', 'write each other a poem', 'picnic somewhere new',
  'learn a TikTok dance', 'bake from a grandma recipe', 'phone-free evening',
]

export default function JarClient({ initial }: { initial: JarState }) {
  const [state, setState] = useState(initial)
  const [draft, setDraft] = useState('')
  const [shaking, setShaking] = useState(false)
  const [drawn, setDrawn] = useState<{ author: string; body: string }[] | null>(null)
  const [pending, start] = useTransition()

  async function refresh() {
    const s = await getJar()
    if (s) setState(s)
  }
  useLive({ table: 'jar_slips', fallbackMs: 30_000 }, () => { void refresh() })

  const waiting = state.slips.filter(s => !s.drawn_at)
  const mine = waiting.filter(s => s.author === state.myId)
  const theirs = waiting.filter(s => s.author !== state.myId)
  const colors = [...waiting].reverse().map(s => s.author === state.myId ? SLIP_ME : SLIP_PARTNER)
  const canDraw = mine.length > 0 && theirs.length > 0

  // Past draws: slips drawn at the same moment are one pair.
  const history = new Map<string, { author: string; body: string | null }[]>()
  for (const s of state.slips.filter(s => s.drawn_at)) {
    const k = s.drawn_at!.slice(0, 19)
    history.set(k, [...(history.get(k) ?? []), { author: s.author, body: s.body }])
  }
  const pairs = [...history.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  const name = (id: string) => id === state.myId ? 'you' : state.partnerName

  function add(text = draft) {
    const body = text.trim()
    if (!body) return
    start(async () => {
      const res = await addSlip(body)
      if ('error' in res && res.error) { toast(res.error); return }
      haptic(); setDraft('')
      if (mine.length + 1 === GOAL) celebrate(null, { count: 24 })
      await refresh()
    })
  }

  function draw() {
    if (!canDraw) return
    haptic(); setDrawn(null); setShaking(true)
    start(async () => {
      const [res] = await Promise.all([drawPair(), new Promise(r => setTimeout(r, 750))])
      setShaking(false)
      if ('error' in res) { toast(res.error); return }
      setDrawn(res.pair)
      celebrate(null, { count: 36 })
      await refresh()
    })
  }

  return (
    <div className="px-4 pb-10 pt-6 max-w-2xl mx-auto">
      <Link href="/games" className="inline-flex items-center gap-1.5 text-stone-400 hover:text-amber-300 text-sm mb-4"><ArrowLeft size={16} /> Games</Link>

      <p className="text-stone-400 text-[11px] uppercase tracking-[0.3em]">Pull one, do both</p>
      <h1 className="font-serif text-[44px] leading-none text-amber-50 mt-2">The Jar<span className="text-amber-500">.</span></h1>
      <p className="text-stone-300 mt-3 leading-relaxed">Each of you folds up {GOAL} things you’d love to do together. Draw, and the jar picks one from each of you — that’s your plan.</p>

      {/* The jar */}
      <section className="tile mt-6 p-6 flex flex-col items-center text-center">
        <div className="text-stone-300">
          <Jar key={shaking ? 'shake' : 'still'} slips={colors} size={170} shake={shaking} />
        </div>
        <div className="grid grid-cols-2 gap-6 mt-4 w-full max-w-xs">
          {[{ who: 'You', n: mine.length, c: SLIP_ME }, { who: state.partnerName, n: theirs.length, c: SLIP_PARTNER }].map(p => (
            <div key={p.who}>
              <p className="text-stone-400 text-[11px] uppercase tracking-[0.18em] truncate">{p.who}</p>
              <div className="flex justify-center gap-1 mt-2 flex-wrap">
                {Array.from({ length: GOAL }).map((_, i) => (
                  <span key={i} className="h-2 w-2 rounded-full" style={{ background: i < p.n ? p.c : 'var(--color-stone-700)' }} />
                ))}
              </div>
              <p className="font-hand text-[20px] text-amber-100 mt-1">{p.n}{p.n > GOAL ? '' : `/${GOAL}`}</p>
            </div>
          ))}
        </div>
        <button onClick={draw} disabled={!canDraw || pending}
          className="mt-5 w-full max-w-xs flex items-center justify-center gap-2 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50 font-medium py-3 transition-colors">
          {pending && shaking ? <Loader2 size={15} className="animate-spin" /> : '🫙'} Draw one from each of us
        </button>
        {!canDraw && <p className="text-stone-500 text-xs mt-2">{mine.length === 0 ? 'Add a slip of your own to start.' : `Waiting on ${state.partnerName} to add one.`}</p>}
      </section>

      {/* The draw */}
      {drawn && (
        <section className="mt-6 animate-rise">
          <p className="relative inline-block font-hand text-[28px] text-amber-200">
            your plan:
            <Scribble kind="underline" className="absolute left-0 -bottom-1 h-2.5 w-full text-amber-500/70" />
          </p>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            {drawn.map((p, i) => (
              <div key={i} className="paper rounded-[3px] px-4 pt-4 pb-3 animate-letter" style={{ rotate: `${i ? 1.8 : -1.6}deg`, animationDelay: `${i * 120}ms` }}>
                <p className="font-hand text-[26px] leading-tight text-[var(--paper-ink)]">{p.body}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--paper-muted)]">from {name(p.author)}</p>
                  <form action={async fd => { await addBucketItem(fd); toast('Saved to Someday ⭐') }}>
                    <input type="hidden" name="title" value={p.body} />
                    <input type="hidden" name="category" value="experience" />
                    <button className="text-[11px] text-[var(--paper-muted)] hover:text-amber-700 flex items-center gap-1"><Star size={11} /> Someday</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add a slip */}
      <section className="mt-8">
        <p className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-2">Fold one up</p>
        <div className="flex gap-2">
          <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }} maxLength={200}
            placeholder="Something you’d love to do together…"
            className="flex-1 min-w-0 rounded-xl bg-stone-950/60 border border-stone-800 px-3 py-2.5 font-hand text-[21px] text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700" />
          <button onClick={() => add()} disabled={pending || !draft.trim()} aria-label="Add to the jar" className="grid place-items-center w-11 shrink-0 rounded-xl bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-amber-50"><Plus size={18} /></button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-2 -mx-1 px-1">
          {IDEAS.map(i => (
            <button key={i} onClick={() => add(i)} className="shrink-0 rounded-full bg-stone-800/80 text-stone-300 hover:text-amber-200 px-3 py-1.5 text-[13px]">{i}</button>
          ))}
        </div>

        {mine.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {mine.map((s, i) => (
              <span key={s.id} className="group relative paper rounded-[3px] pl-3 pr-7 py-1.5 font-hand text-[19px] text-[var(--paper-ink)]" style={{ rotate: `${[-1.5, 1, -0.5, 1.5][i % 4]}deg` }}>
                {s.body}
                <button onClick={() => start(async () => { await removeSlip(s.id); await refresh() })} aria-label="Take it out" className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--paper-muted)] hover:text-red-600"><X size={13} /></button>
              </span>
            ))}
          </div>
        )}
        <p className="text-stone-500 text-xs mt-3">{state.partnerName}’s slips stay folded until they’re drawn.</p>
      </section>

      {/* Past plans */}
      {pairs.length > 0 && (
        <section className="mt-10">
          <p className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-3">Drawn before</p>
          <div className="flex flex-col gap-2">
            {pairs.slice(0, 12).map(([at, ps]) => (
              <div key={at} className="tile px-4 py-3 flex items-center gap-3">
                <span className="text-stone-500 text-xs w-14 shrink-0">{new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <p className="font-hand text-[20px] text-amber-100 leading-tight min-w-0">{ps.map(p => p.body).join('  +  ')}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <WhyItWorks className="mt-10" source="Aron et al., 2000">
        Couples who did new, exciting things together reported more satisfaction with their relationship than couples who did pleasant but familiar ones.
      </WhyItWorks>
    </div>
  )
}
