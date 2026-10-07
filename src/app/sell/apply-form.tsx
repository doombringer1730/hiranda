'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { applyToSell, type ApplyState } from './actions'

const field = 'w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-[15px] text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700'
const label = 'block text-stone-400 text-xs uppercase tracking-[0.18em] mb-1.5'

export default function ApplyForm() {
  const [state, action, pending] = useActionState<ApplyState, FormData>(applyToSell, {})

  if (state.ok) {
    return (
      <div className="paper rounded-[6px] px-6 py-5 -rotate-[0.4deg]" role="status">
        <p className="font-hand text-[28px] leading-tight text-[var(--paper-ink)]">Got it — thank you!</p>
        <p className="text-sm text-[var(--paper-muted)] mt-1">We read every application and reply by email, usually within a week.</p>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-3xl border border-stone-800 bg-stone-900/60 p-5">
      {/* Hidden from people; bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>Company URL <input name="company_url" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className={label} htmlFor="business_name">Your shop or brand</label>
          <input id="business_name" name="business_name" required maxLength={120} className={field} autoComplete="organization" /></div>
        <div><label className={label} htmlFor="contact_name">Your name</label>
          <input id="contact_name" name="contact_name" required maxLength={120} className={field} autoComplete="name" /></div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className={label} htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required maxLength={200} className={field} autoComplete="email" /></div>
        <div><label className={label} htmlFor="website">Shop link <span className="normal-case tracking-normal text-stone-600">(Etsy, Instagram, site)</span></label>
          <input id="website" name="website" maxLength={300} className={field} placeholder="etsy.com/shop/…" autoComplete="url" /></div>
      </div>
      <div><label className={label} htmlFor="what_you_sell">What would you sell to couples?</label>
        <textarea id="what_you_sell" name="what_you_sell" required maxLength={1000} rows={4} className={field}
          placeholder="e.g. Hand-stamped long-distance bracelets with both cities’ coordinates" /></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className={label} htmlFor="price_range">Typical price</label>
          <select id="price_range" name="price_range" className={field} defaultValue="">
            <option value="">Choose…</option>
            <option value="under-25">Under $25</option>
            <option value="25-50">$25–50</option>
            <option value="50-100">$50–100</option>
            <option value="100-plus">$100+</option>
          </select></div>
        <div><label className={label} htmlFor="ships_from">Ships from</label>
          <input id="ships_from" name="ships_from" maxLength={120} className={field} placeholder="City, state" /></div>
      </div>
      <label className="flex items-start gap-2.5 text-sm text-stone-300">
        <input type="checkbox" name="ships_us" required className="mt-1 accent-amber-600" />
        I can ship within the US with tracking.
      </label>
      {state.error && <p className="text-sm text-red-300" role="alert">{state.error}</p>}
      <button disabled={pending} className="inline-flex items-center justify-center gap-2 h-12 rounded-full bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium disabled:opacity-60">
        {pending && <Loader2 size={18} className="animate-spin" />} Apply to sell
      </button>
      <p className="text-stone-500 text-xs">We only use this to review your application and reply. See our <a href="/privacy" className="underline underline-offset-4">privacy policy</a>.</p>
    </form>
  )
}
