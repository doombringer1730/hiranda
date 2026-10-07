import Link from 'next/link'
import { coupleContext } from '@/lib/couple'
import { getPeople } from '@/lib/profiles'

export const metadata = { title: 'Gift sent' }

// Stripe brings you here after paying. (In the iPhone app this opens inside
// the Safari sheet — closing it takes you to your orders.)
export default async function ThanksPage() {
  const ctx = await coupleContext()
  const partner = ctx ? (await getPeople()).get(ctx.partnerId)?.first ?? 'your partner' : 'your partner'
  return (
    <div className="px-4 pt-16 pb-12 max-w-md mx-auto text-center">
      <p className="text-6xl" aria-hidden="true">💝</p>
      <h1 className="font-serif text-4xl text-amber-50 mt-4">On its way.</h1>
      <p className="font-hand text-[24px] text-amber-400 mt-1">{partner} is going to love this.</p>
      <p className="text-stone-400 text-sm mt-4">We’ll let {partner} know something’s coming — without spoiling what. You can follow it in your sent gifts.</p>
      <div className="mt-8 flex flex-col gap-3 items-center">
        <Link href="/store/orders" className="inline-flex items-center h-11 px-5 rounded-full bg-amber-700 hover:bg-amber-600 text-amber-50 text-sm font-medium">See your gifts</Link>
        <Link href="/" className="text-stone-500 hover:text-stone-300 text-sm">Back home</Link>
      </div>
    </div>
  )
}
