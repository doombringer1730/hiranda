import type { Metadata } from 'next'
import Link from 'next/link'
import ApplyForm from './apply-form'

export const metadata: Metadata = {
  title: 'Sell on Hiranda',
  description: 'Sell gifts made for couples in the Hiranda Store.',
}

const STEPS = [
  { n: '1', title: 'Apply', text: 'Two minutes, below. Tell us what you make.' },
  { n: '2', title: 'We say hello', text: 'We reply within about a week. If it’s a fit, we set up your listings together.' },
  { n: '3', title: 'Couples order', text: 'One partner sends your piece to the other. You get the order with where to ship it.' },
  { n: '4', title: 'Ship it & get paid', text: 'Add tracking, and you’re paid through Stripe, minus a small commission.' },
]

const GOOD_FITS = [
  'Long-distance gifts — matching bracelets, touch lamps, “open when” letter kits',
  'Personalized and handmade things for two — portraits, prints, keepsakes',
  'Little treats and comforts that ship well — sweets, candles, cozy things',
  'Date-night-in kits, games and activities for couples',
]

// Public page (see middleware): businesses learn about selling in the
// Hiranda Store and apply. Applications land in /store/admin/sellers.
export default function SellPage() {
  return (
    <main className="min-h-screen px-5 py-12">
      <article className="max-w-2xl mx-auto flex flex-col gap-6 text-stone-300 text-[15px] leading-relaxed [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-amber-50 [&_h2]:mt-4 [&_b]:text-amber-50 [&_b]:font-medium">
        <Link href="/" className="text-stone-500 hover:text-amber-300 text-sm">← Hiranda</Link>
        <div>
          <p className="text-stone-500 text-[10px] uppercase tracking-[0.3em]">Sell on Hiranda</p>
          <h1 className="font-serif text-5xl text-amber-50 mt-2 leading-[1.05]">Make something for two<span className="text-amber-500">.</span></h1>
          <p className="font-hand text-[24px] text-amber-400 mt-2">for the days they can’t be there.</p>
        </div>
        <p>
          <b>Hiranda</b> is a private app for couples — especially long-distance ones. Its <b>Gifts</b> shop lets one partner send the other
          something real. We’re inviting a small group of makers and shops to sell there, to people who are already looking for a way to say
          “thinking of you.”
        </p>

        <h2>What sells</h2>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          {GOOD_FITS.map(t => <li key={t}>{t}</li>)}
        </ul>
        <p className="text-stone-400 text-sm">We keep the shop small and couples-only, so every listing feels like a gift — not a marketplace.</p>

        <h2>How it works</h2>
        <ol className="grid sm:grid-cols-2 gap-3">
          {STEPS.map(s => (
            <li key={s.n} className="rounded-2xl border border-stone-800 bg-stone-900/60 p-4">
              <p className="font-serif text-3xl text-amber-500 leading-none">{s.n}</p>
              <p className="text-amber-50 font-medium mt-2">{s.title}</p>
              <p className="text-stone-400 text-sm mt-0.5">{s.text}</p>
            </li>
          ))}
        </ol>

        <h2>What we ask</h2>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li>Ship within the US, with tracking, in the time you promise.</li>
          <li>Treat every address as private — use it only to deliver that order.</li>
          <li>Honest photos and descriptions, and a simple returns policy for damaged items.</li>
          <li>Nothing adult, unsafe or counterfeit.</li>
        </ul>
        <p className="text-stone-400 text-sm">Our first sellers get a lower commission while we grow together. We’ll share the full terms when we reply.</p>

        <h2 id="apply">Apply</h2>
        <ApplyForm />
      </article>
    </main>
  )
}
