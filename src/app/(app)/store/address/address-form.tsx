'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { removeAddress, saveAddress, type Address } from '../actions'

const field = 'w-full bg-stone-900 border border-stone-800 rounded-xl px-4 py-3 text-amber-50 placeholder:text-stone-600 focus:outline-none focus:border-amber-700'

export default function AddressForm({ initial }: { initial: Address | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <form
      className="flex flex-col gap-3"
      action={form => start(async () => {
        const res = await saveAddress(form)
        if (res.error) { setMsg(res.error); return }
        router.push('/store')
      })}
    >
      <input name="full_name" required defaultValue={initial?.full_name} placeholder="Full name" autoComplete="name" className={field} />
      <input name="line1" required defaultValue={initial?.line1} placeholder="Street address" autoComplete="address-line1" className={field} />
      <input name="line2" defaultValue={initial?.line2 ?? ''} placeholder="Apartment, suite (optional)" autoComplete="address-line2" className={field} />
      <div className="grid grid-cols-2 gap-3">
        <input name="city" required defaultValue={initial?.city} placeholder="City" autoComplete="address-level2" className={field} />
        <input name="region" defaultValue={initial?.region ?? ''} placeholder="State" autoComplete="address-level1" className={field} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input name="postal_code" required defaultValue={initial?.postal_code} placeholder="ZIP code" autoComplete="postal-code" className={field} />
        <select name="country" defaultValue={initial?.country ?? 'US'} className={field} aria-label="Country">
          <option value="US">United States</option>
        </select>
      </div>
      <input name="phone" defaultValue={initial?.phone ?? ''} placeholder="Phone, for the courier (optional)" autoComplete="tel" className={field} />
      {msg && <p className="text-red-400 text-sm">{msg}</p>}
      <button disabled={pending} className="mt-2 inline-flex items-center justify-center gap-2 h-12 rounded-full bg-amber-700 hover:bg-amber-600 disabled:opacity-60 text-amber-50 font-medium">
        {pending && <Loader2 size={16} className="animate-spin" />} Save address
      </button>
      {initial && (
        <button type="button" disabled={pending} onClick={() => start(async () => { await removeAddress(); router.push('/store') })}
          className="text-stone-500 hover:text-red-400 text-sm py-2">Remove my address</button>
      )}
    </form>
  )
}
