import type { Metadata } from 'next'
import Link from 'next/link'
import QuickExit from './quick-exit'

export const metadata: Metadata = { title: 'Help & support · Hiranda' }

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL

type Resource = { name: string; how: string; href: string; note?: string }

const URGENT: Resource[] = [
  { name: 'Emergency services', how: 'Call 911 (US) or your local emergency number', href: 'tel:911', note: 'If you or someone else is in immediate danger.' },
  { name: '988 Suicide & Crisis Lifeline (US)', how: 'Call or text 988', href: 'https://988lifeline.org', note: 'Free, confidential, 24/7.' },
  { name: 'Crisis Text Line (US, UK, CA, IE)', how: 'Text HOME to 741741 (US)', href: 'https://www.crisistextline.org' },
  { name: 'Find a Helpline (worldwide)', how: 'Free directory of crisis lines in 130+ countries', href: 'https://findahelpline.com' },
]

const SAFETY: Resource[] = [
  { name: 'National Domestic Violence Hotline (US)', how: 'Call 1-800-799-7233 or text START to 88788', href: 'https://www.thehotline.org', note: 'Support, safety planning and local resources, 24/7.' },
  { name: 'love is respect (ages 13–26)', how: 'Text LOVEIS to 22522 or call 1-866-331-9474', href: 'https://www.loveisrespect.org', note: 'For young people worried about a relationship.' },
  { name: 'RAINN Sexual Assault Hotline (US)', how: 'Call 1-800-656-4673', href: 'https://www.rainn.org' },
]

const SUPPORT: Resource[] = [
  { name: 'Psychology Today therapist finder', how: 'Search therapists by location, issue and insurance', href: 'https://www.psychologytoday.com/us/therapists' },
  { name: 'Open Path Collective', how: 'Lower-cost therapy sessions', href: 'https://openpathcollective.org' },
  { name: 'NAMI HelpLine (US)', how: 'Call 1-800-950-6264 or text “helpline” to 62640', href: 'https://www.nami.org/help', note: 'Information and referrals, weekdays.' },
  { name: 'SAMHSA National Helpline (US)', how: 'Call 1-800-662-4357', href: 'https://www.samhsa.gov/find-help/national-helpline', note: 'Free referrals for mental health and substance use, 24/7.' },
]

function List({ items }: { items: Resource[] }) {
  return (
    <ul className="!list-none !pl-0 flex flex-col gap-2.5">
      {items.map(r => (
        <li key={r.name} className="rounded-2xl bg-stone-900/80 border border-stone-800 p-4">
          <a href={r.href} target={r.href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="text-amber-200 font-medium hover:text-amber-100">{r.name} ↗</a>
          <p className="text-stone-300 text-sm mt-1">{r.how}</p>
          {r.note && <p className="text-stone-500 text-xs mt-1">{r.note}</p>}
        </li>
      ))}
    </ul>
  )
}

export default function SupportPage() {
  return (
    <main className="min-h-screen px-5 py-12">
      <QuickExit />
      <article className="max-w-2xl mx-auto flex flex-col gap-5 text-stone-300 text-[15px] leading-relaxed [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:text-amber-50 [&_h2]:mt-6 [&_b]:text-amber-50 [&_b]:font-medium">
        <Link href="/" className="text-stone-500 hover:text-amber-300 text-sm">← Hiranda</Link>
        <div>
          <p className="text-stone-500 text-[10px] uppercase tracking-[0.3em]">Help & support</p>
          <h1 className="font-serif text-5xl text-amber-50 mt-2">You’re not alone<span className="text-amber-500">.</span></h1>
        </div>
        <p>Whether something went wrong with the app, a relationship has ended, or you just need someone to talk to — this page has answers and people who can help.</p>

        <h2>If you need help right now</h2>
        <List items={URGENT} />

        <h2>When a relationship ends</h2>
        <p>Breakups are hard, and it’s okay to take your time with the practical parts. Here’s exactly how Hiranda works when one of you leaves:</p>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li><b>Your memories stay yours.</b> Before anything changes, go to Settings → Your data → <b>Download our data</b> for a full copy of everything in your space, including links to your photos.</li>
          <li><b>Deleting your account</b> permanently removes what <i>you</i> created — memories, journal entries, photos, lists and answers — and your login. It can’t be undone.</li>
          <li><b>Your partner keeps what they made.</b> Their own memories, entries and photos stay with their account. The shared space closes, and they can start a new one whenever they’re ready.</li>
          <li><b>If your partner deleted their account,</b> you’ll land on the invite screen. Your own content is still yours — and under <b>Account options</b> you can download it or delete your account too.</li>
          <li><b>Not ready to decide?</b> You don’t have to do anything. Turning notifications off in Settings gives you some quiet in the meantime.</li>
        </ul>

        <h2>If you don’t feel safe</h2>
        <p>If someone is controlling, monitoring or hurting you, these confidential services can help you plan next steps. The <b>Leave quickly</b> button at the top of this page takes you away instantly. Consider changing your password and turning on <b>two-factor login</b> in Settings if someone may know your login.</p>
        <List items={SAFETY} />

        <h2>Someone to talk to</h2>
        <List items={SUPPORT} />

        <h2>Account questions</h2>
        <ul className="list-disc pl-5 flex flex-col gap-1.5">
          <li><b>Forgot your password?</b> Use <Link className="text-amber-400 underline underline-offset-4" href="/forgot-password">Forgot password</Link> on the sign-in screen.</li>
          <li><b>Made two accounts by mistake?</b> Sign in to the one you don’t want, download anything you’d like to keep, then delete it from Settings → Your data.</li>
          <li><b>Partner’s invite link not working?</b> Each link works once. Ask them for the link shown on their invite screen or in Settings.</li>
          <li><b>Lost your authenticator app?</b> {contact ? <>Email <a className="text-amber-400 underline underline-offset-4" href={`mailto:${contact}`}>{contact}</a> from your account’s email address and we’ll help you back in.</> : <>Contact whoever runs your Hiranda and they can help you back in.</>}</li>
        </ul>

        <p className="text-stone-500 text-xs mt-6">These services are independent of Hiranda. Numbers are for the US unless noted — Find a Helpline lists services in other countries.</p>
      </article>
    </main>
  )
}
