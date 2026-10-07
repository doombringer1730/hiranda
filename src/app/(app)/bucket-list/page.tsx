import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getPeople, type Person } from '@/lib/profiles'
import { addBucketItem, completeBucketItem, deleteBucketItem } from './actions'
import { Plus, X, Camera } from 'lucide-react'
import PageHeader from '@/components/page-header'
import CheckButton from '@/components/check-button'
import { EmptyState, PersonChip } from '@/components/ui'
import WhyItWorks from '@/components/why-it-works'
import SponsorCard from '@/components/sponsor-card'

const CATEGORIES = ['travel', 'food', 'experience', 'other'] as const
type Category = typeof CATEGORIES[number]

// Each category is a stamp colour and a picture.
const STAMP: Record<Category, { label: string; emoji: string; color: string }> = {
  travel:     { label: 'Travel', emoji: '✈️', color: '#3f7fb5' },
  food:       { label: 'Food', emoji: '🍜', color: '#cf6b35' },
  experience: { label: 'Experience', emoji: '🎟️', color: '#8b5cc4' },
  other:      { label: 'Other', emoji: '⭐', color: '#3c9a7a' },
}
const stampFor = (c: string) => STAMP[(CATEGORIES as readonly string[]).includes(c) ? c as Category : 'other']
const TILTS = [-2, 1.5, -0.8, 2.4, -1.6, 0.8]

type Item = { id: string; title: string; category: string; created_by: string; completed_at?: string | null }

// Someday, as a sheet of stamps: the plans you collect. Doing one stamps it
// with a postmark — and invites you to keep it as a memory.
export default async function BucketListPage() {
  const supabase = await createClient()
  const [{ data: items }, people] = await Promise.all([
    supabase.from('bucket_list').select('*').order('created_at', { ascending: false }),
    getPeople(),
  ])

  const open = (items?.filter(i => !i.completed) ?? []) as Item[]
  const done = (items?.filter(i => i.completed) ?? []) as Item[]

  return (
    <div className="px-4 pt-6 pb-12 max-w-2xl md:max-w-4xl mx-auto">
      <PageHeader eyebrow="Someday, together" title="Bucket List" />
      <p className="font-hand text-[22px] text-stone-400 mt-2 mb-6">
        {done.length ? `${done.length} done, ${open.length} still out there.` : 'collect the things you want to do together.'}
      </p>

      <form action={addBucketItem} className="tile p-3 mb-8">
        <div className="flex gap-2">
          <input
            name="title"
            type="text"
            required
            maxLength={140}
            className="flex-1 min-w-0 bg-transparent px-2 py-2 text-amber-50 placeholder:text-stone-500 focus:outline-none"
            placeholder="Someday we should…"
          />
          <button type="submit" aria-label="Add" className="grid place-items-center h-10 w-10 shrink-0 rounded-full bg-amber-700 hover:bg-amber-600 text-amber-50"><Plus size={18} /></button>
        </div>
        <div className="flex gap-1.5 mt-2 flex-wrap" role="radiogroup" aria-label="Kind">
          {CATEGORIES.map((c, i) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="category" value={c} defaultChecked={i === 0} className="peer sr-only" />
              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[13px] bg-stone-800/70 text-stone-300 peer-checked:bg-amber-700 peer-checked:text-amber-50 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 transition-colors">
                {STAMP[c].emoji} {STAMP[c].label}
              </span>
            </label>
          ))}
        </div>
      </form>

      {!items?.length && (
        <EmptyState title="No dreams on the sheet yet." sub="Places, meals, silly things — anything you’d love to do together one day." />
      )}

      {open.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6">
          {open.map((item, i) => <Stamp key={item.id} item={item} i={i} person={people.get(item.created_by)} />)}
        </div>
      )}

      {done.length > 0 && (
        <section className="mt-12">
          <p className="text-stone-400 text-[11px] uppercase tracking-[0.22em] mb-4">Done together · {done.length}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-6">
            {done.map((item, i) => <Stamp key={item.id} item={item} i={i} done person={people.get(item.created_by)} />)}
          </div>
        </section>
      )}

      <WhyItWorks className="mt-12" source="Aron et al., 2000">
        New experiences shared with a partner get linked to the relationship itself — that’s why doing something new together feels like falling for them again.
      </WhyItWorks>
      <div className="mt-8"><SponsorCard place="someday" /></div>
    </div>
  )
}

function Stamp({ item, i, done = false, person }: { item: Item; i: number; done?: boolean; person?: Person }) {
  const s = stampFor(item.category)
  const when = item.completed_at ? new Date(item.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  return (
    <div className="group relative animate-rise" style={{ '--i': Math.min(i, 8), rotate: `${TILTS[i % TILTS.length]}deg` } as React.CSSProperties}>
      <div className="stamp">
        <div className="relative aspect-[4/5] flex flex-col p-3 overflow-hidden" style={{ background: `linear-gradient(160deg, ${s.color}, color-mix(in oklab, ${s.color} 60%, black))` }}>
          <span aria-hidden className="absolute inset-0 opacity-[0.12] bg-[repeating-linear-gradient(-45deg,white_0_1px,transparent_1px_7px)]" />
          <span className="relative text-[34px] leading-none drop-shadow">{s.emoji}</span>
          <p className="relative mt-auto font-hand text-[22px] leading-[1.05] text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.4)] line-clamp-4">{item.title}</p>
          <p className="relative mt-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">{s.label}</p>
        </div>
      </div>
      {done && (
        <span className="postmark -right-3 -top-3 text-[#2b2620] bg-[rgb(255_255_255/0.0)] rotate-[-14deg]">done<br />{when}</span>
      )}
      <div className="flex items-center gap-2 mt-2 px-1 min-h-[36px]">
        {!done ? (
          <form action={completeBucketItem.bind(null, item.id)}>
            <CheckButton done={false} label={item.title} />
          </form>
        ) : (
          <Link href="/memories/new" className="inline-flex items-center gap-1 text-[12px] text-amber-300 hover:text-amber-200"><Camera size={13} /> make it a memory</Link>
        )}
        <span className="ml-auto"><PersonChip person={person} size={18} /></span>
        <form action={deleteBucketItem.bind(null, item.id)} className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button type="submit" aria-label={`Remove “${item.title}”`} className="grid place-items-center h-8 w-8 rounded-full text-stone-500 hover:text-red-400"><X size={14} /></button>
        </form>
      </div>
    </div>
  )
}
