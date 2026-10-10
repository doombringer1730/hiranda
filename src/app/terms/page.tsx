import type { Metadata } from 'next'
import LegalPage from '@/components/legal-page'

export const metadata: Metadata = { title: 'Terms · Hiranda' }

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL

export default function TermsPage() {
  return (
    <LegalPage title="Terms" updated="October 2026">
      <p>By creating an account or using Hiranda you agree to these terms. They’re short on purpose.</p>

      <h2>Your space, your content</h2>
      <p>You own what you add. You give Hiranda only the permission needed to store it and show it to you and your partner. You can download or delete it at any time from Settings.</p>

      <h2>Using Hiranda well</h2>
      <ul>
        <li>Only upload things you have the right to share.</li>
        <li>Don’t use Hiranda for anything illegal, to harass anyone, or to try to access someone else’s space.</li>
        <li>Keep your login safe. You’re responsible for activity on your account.</li>
        <li>Theater and streaming connections are for content you’re entitled to watch. You’re responsible for the services and sources you connect.</li>
      </ul>

      <h2>Hiranda Plus</h2>
      <p>Plus is an optional subscription that covers both of you. It starts with a free trial, then renews automatically each month or year at the price shown when you subscribe, until you cancel. Bought on the web, you can cancel anytime from the Plus page; bought in the iPhone app, cancel in Settings → Apple ID → Subscriptions. Cancelling keeps Plus until the end of the period you’ve paid for. We don’t refund partial periods, but if something went wrong, write to us and we’ll make it right. Apple handles refunds for purchases made through Apple.</p>

      <h2>Gifts</h2>
      <p>Gifts from the store are made and shipped by our suppliers to the address your partner saved. Delivery times shown are estimates. If a gift arrives damaged, wrong, or doesn’t arrive, tell us and we’ll replace it or refund you. Personalized items can’t be returned for a change of mind.</p>

      <h2>The service</h2>
      <p>Hiranda is provided as-is. We work to keep it running and your data safe, but we can’t promise it will always be available or error-free, and we’re not liable for indirect losses. Keep your own copy of anything precious — Download our data makes that easy.</p>

      <h2>Ending things</h2>
      <p>You can delete your account whenever you like. We may suspend accounts that break these terms.</p>

      <h2>Changes</h2>
      <p>If these terms change in a meaningful way, we’ll update the date above. Continuing to use Hiranda means you accept the updated terms.{contact ? <> Questions? Email <a className="text-amber-400 underline underline-offset-4" href={`mailto:${contact}`}>{contact}</a>.</> : null}</p>
    </LegalPage>
  )
}
