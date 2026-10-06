import type { Metadata } from 'next'
import LegalPage from '@/components/legal-page'

export const metadata: Metadata = { title: 'Privacy · Hiranda' }

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="October 2026">
      <p>Hiranda is a private space for two people. This page explains, in plain language, what we store, who can see it, and how to take it with you or delete it.</p>

      <h2>Who can see your things</h2>
      <p><b>Only you and your partner.</b> Everything you add — memories, photos, journal entries, lists, answers — is visible only to the two people in your shared space. Access is enforced by the database itself, not just the app. We don’t sell your data, show ads, or share it with anyone for marketing.</p>

      <h2>What we store</h2>
      <ul>
        <li><b>Your account:</b> email, display name, and (if you add them) a profile photo, banner, bio and status.</li>
        <li><b>What you create:</b> memories and photos, journal entries, dates, todos, bucket list, watchlist, books, music, game moves, quiz answers, and study decks.</li>
        <li><b>Optional connections you choose to set up:</b> Spotify (to share what you’re listening to), streaming services for Theater, and push notifications for your devices.</li>
        <li><b>Sign-in security:</b> if you turn on two-factor login, your authenticator setup.</li>
      </ul>

      <h2>Services that help run Hiranda</h2>
      <ul>
        <li><b>Supabase</b> — stores the database, files and logins.</li>
        <li><b>Vercel</b> — hosts the website.</li>
        <li><b>Your browser’s push service</b> (Apple, Google or Mozilla) — delivers notifications you opt into.</li>
        <li><b>Google</b> — only if you choose “Continue with Google”.</li>
        <li><b>Spotify</b> and <b>TMDB</b> — only for features that use them; we send them the minimum needed (for example, a title to look up).</li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li><b>Download everything:</b> Settings → Your data → Download our data gives you a full copy.</li>
        <li><b>Delete your account:</b> Settings → Your data → Delete my account permanently removes everything you created, your files and your login. Your partner keeps what they made.</li>
        <li><b>Notifications and connections</b> can be turned off any time in Settings.</li>
      </ul>

      <h2>Security</h2>
      <p>Data is encrypted in transit, access is limited per couple at the database level, and you can add two-factor login in Settings. No system is perfect — please use a strong, unique password.</p>

      <h2>Changes and questions</h2>
      <p>If this policy changes in a meaningful way, we’ll update the date above.{contact ? <> Questions? Email <a className="text-amber-400 underline underline-offset-4" href={`mailto:${contact}`}>{contact}</a>.</> : null}</p>
    </LegalPage>
  )
}
