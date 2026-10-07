'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { addCjProduct, addPartnerProduct, deleteProduct, setProductActive, setProductPrice } from './actions'

const field = 'w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-sm text-amber-50 placeholder:text-stone-600'
const label = 'block text-stone-500 text-[11px] uppercase tracking-[0.16em] mb-1'

type Defaults = {
  title: string; category: string; emoji: string; image: string; price: string; cost: string
  delivery: string; vid: string; pid: string; from: 'US' | 'CN'
}

export function AddForm({ defaults, categories }: { defaults: Defaults; categories: { key: string; title: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [price, setPrice] = useState(defaults.price)
  const profit = Number(price) - Number(defaults.cost) - Number(price) * 0.03 - 0.3

  return (
    <form action={form => start(async () => {
      const res = await addCjProduct(form)
      setMsg(res.ok ? { ok: true, text: 'Added to your store ✓' } : { ok: false, text: res.error ?? 'Something went wrong' })
      if (res.ok) router.refresh()
    })} className="flex flex-col gap-3">
      {(['vid', 'pid', 'from', 'image', 'cost', 'emoji'] as const).map(k => <input key={k} type="hidden" name={k} value={defaults[k]} />)}
      <div><label className={label} htmlFor="title">Name in your store</label>
        <input id="title" name="title" defaultValue={defaults.title} maxLength={120} required className={field} /></div>
      <div><label className={label} htmlFor="blurb">A line about it</label>
        <input id="blurb" name="blurb" maxLength={300} className={field} placeholder="Something to hug when you can’t hug them." /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label} htmlFor="category">Section</label>
          <select id="category" name="category" defaultValue={defaults.category} className={field}>
            {categories.map(c => <option key={c.key} value={c.key}>{c.title}</option>)}
          </select></div>
        <div><label className={label} htmlFor="price">Price ($)</label>
          <input id="price" name="price" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} className={field} /></div>
      </div>
      <div><label className={label} htmlFor="delivery">Delivery note</label>
        <input id="delivery" name="delivery" defaultValue={defaults.delivery} maxLength={80} className={field} /></div>
      <p className={`text-xs ${profit >= 5 ? 'text-emerald-300' : 'text-amber-300'}`}>
        You keep about ${Number.isFinite(profit) ? profit.toFixed(2) : '—'} per sale after cost and Stripe’s fee.
      </p>
      <button disabled={pending} className="inline-flex items-center justify-center gap-2 h-11 rounded-full bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium disabled:opacity-60">
        {pending && <Loader2 size={16} className="animate-spin" />} Add to store
      </button>
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`} role="status">{msg.text}</p>}
    </form>
  )
}

export function PartnerForm({ categories }: { categories: { key: string; title: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [price, setPrice] = useState('')
  const [cost, setCost] = useState('')
  const profit = Number(price) - Number(cost) - Number(price) * 0.03 - 0.3
  return (
    <form action={form => start(async () => {
      const res = await addPartnerProduct(form)
      setMsg(res.ok ? { ok: true, text: 'Added to your store ✓' } : { ok: false, text: res.error ?? 'Something went wrong' })
      if (res.ok) router.refresh()
    })} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label} htmlFor="p-partner">Partner shop</label>
          <input id="p-partner" name="partner" required maxLength={80} className={field} placeholder="PeachCustomShirts" /></div>
        <div><label className={label} htmlFor="p-category">Section</label>
          <select id="p-category" name="category" defaultValue="her" className={field}>
            {categories.map(c => <option key={c.key} value={c.key}>{c.title}</option>)}
          </select></div>
      </div>
      <div><label className={label} htmlFor="p-title">Name in your store</label>
        <input id="p-title" name="title" required maxLength={120} className={field} placeholder="Matching couple shirts" /></div>
      <div><label className={label} htmlFor="p-blurb">A line about it</label>
        <input id="p-blurb" name="blurb" maxLength={300} className={field} /></div>
      <div><label className={label} htmlFor="p-url">Link to order it from them</label>
        <input id="p-url" name="url" inputMode="url" maxLength={500} className={field} placeholder="https://www.etsy.com/listing/…" /></div>
      <div><label className={label} htmlFor="p-image">Photo link (https)</label>
        <input id="p-image" name="image" inputMode="url" maxLength={500} className={field} placeholder="Right-click their photo → Copy image address" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={label} htmlFor="p-price">Your price ($)</label>
          <input id="p-price" name="price" inputMode="decimal" required value={price} onChange={e => setPrice(e.target.value)} className={field} /></div>
        <div><label className={label} htmlFor="p-cost">You pay them ($)</label>
          <input id="p-cost" name="cost" inputMode="decimal" value={cost} onChange={e => setCost(e.target.value)} className={field} placeholder="incl. their shipping" /></div>
      </div>
      <div><label className={label} htmlFor="p-delivery">Delivery note</label>
        <input id="p-delivery" name="delivery" maxLength={80} className={field} defaultValue="Made to order — arrives in about 1–2 weeks" /></div>
      {price && cost && <p className={`text-xs ${profit >= 5 ? 'text-emerald-300' : 'text-amber-300'}`}>You keep about ${Number.isFinite(profit) ? profit.toFixed(2) : '—'} per sale.</p>}
      <p className="text-stone-500 text-xs">Only use photos you have the partner’s OK to show.</p>
      <button disabled={pending} className="inline-flex items-center justify-center gap-2 h-11 rounded-full bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium disabled:opacity-60">
        {pending && <Loader2 size={16} className="animate-spin" />} Add partner product
      </button>
      {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-300' : 'text-red-300'}`} role="status">{msg.text}</p>}
    </form>
  )
}

type Row = { key: string; title: string; image: string | null; emoji: string; active: boolean; delivery: string | null; section: string; price: string; cost: string | null }

export function ProductRow({ product: p }: { product: Row }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [price, setPrice] = useState(p.price)
  const [msg, setMsg] = useState<string | null>(null)
  const run = (fn: () => Promise<{ error?: string } | undefined>) => start(async () => {
    const res = await fn()
    setMsg(res?.error ?? null)
    if (!res?.error) router.refresh()
  })
  return (
    <div className={`rounded-2xl border border-stone-800 bg-stone-900/60 p-3 flex flex-col gap-2 ${p.active ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-3">
        {p.image
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={p.image} alt="" className="size-12 rounded-xl object-cover bg-stone-800" />
          : <span className="text-3xl" aria-hidden="true">{p.emoji}</span>}
        <div className="flex-1 min-w-0">
          <p className="text-stone-100 text-sm truncate">{p.title}</p>
          <p className="text-stone-500 text-xs truncate">{p.section}{p.cost ? ` · cost ${p.cost}` : ''}{p.delivery ? ` · ${p.delivery}` : ''}</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-stone-500 text-sm">$</span>
          <input value={price} onChange={e => setPrice(e.target.value)} inputMode="decimal" aria-label="Price"
            className="w-20 bg-stone-950 border border-stone-800 rounded-lg px-2 py-1 text-sm text-amber-50" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {price !== p.price && <button disabled={pending} onClick={() => run(() => setProductPrice(p.key, price))} className="h-8 px-3 rounded-full bg-amber-700 text-amber-50 text-xs">Save price</button>}
        <button disabled={pending} onClick={() => run(() => setProductActive(p.key, !p.active))} className="h-8 px-3 rounded-full bg-stone-800 text-stone-200 text-xs">
          {p.active ? 'Take off the shelf' : 'Put back on sale'}
        </button>
        <button disabled={pending} onClick={() => { if (confirm(`Remove “${p.title}” for good?`)) run(() => deleteProduct(p.key)) }} className="h-8 px-3 rounded-full text-stone-500 hover:text-red-400 text-xs">Remove</button>
      </div>
      {msg && <p className="text-xs text-red-300">{msg}</p>}
    </div>
  )
}
