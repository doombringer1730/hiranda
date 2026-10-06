import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import CopyInviteButton from './copy-button'
import PartnerWatcher from './partner-watcher'
import AccountSection from '@/app/(app)/settings/account-section'
import { logout } from '@/app/(auth)/actions'

export default async function InvitePartnerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // .limit(1) rather than .maybeSingle(): see the note in (app)/layout.tsx.
  // A user in two couples made .maybeSingle() error into a null row, and the
  // `!couple -> redirect('/')` below then bounced them straight back into the
  // layout that sent them here — an infinite redirect.
  const { data: couples } = await supabase
    .from('couple')
    .select('invite_token, user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('user2_id', { nullsFirst: false })
    .limit(1)

  let couple = couples?.[0]

  // No space at all — signup's couple insert failed and was never checked.
  // Repair it here instead of redirecting, which is the other half of the loop.
  if (!couple) {
    const { data: created, error } = await supabase
      .from('couple')
      .insert({ user1_id: user.id })
      .select('invite_token, user1_id, user2_id')
      .single()
    if (error || !created) {
      return (
        <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-stone-950">
          <div className="w-full max-w-sm text-center">
            <h1 className="font-serif text-4xl text-amber-100 mb-3">Something went wrong</h1>
            <p className="text-stone-400 text-sm mb-8">
              We couldn&apos;t set up your space. Try reloading — if it keeps happening,
              sign out and back in.
            </p>
            <form action={logout}>
              <button type="submit" className="text-amber-500 hover:text-amber-400 text-sm transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </main>
      )
    }
    couple = created
  }

  // Already paired, or is Person 2 — nothing to do here
  if (couple.user2_id || couple.user1_id !== user.id) redirect('/')

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const inviteLink = `${protocol}://${host}/join/${couple?.invite_token}`

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 bg-stone-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_80%,rgba(120,53,15,0.15),transparent_70%)] pointer-events-none" />
      <div className="w-full max-w-sm text-center">
        <h1 className="font-serif text-4xl text-amber-100 mb-3">One more step</h1>
        <p className="text-stone-400 text-sm mb-8">
          Share this link with your partner so they can join your space. They’ll need it to sign up.
        </p>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 mb-4">
          <p className="text-stone-500 text-xs uppercase tracking-widest mb-3">Your invite link</p>
          <p className="text-amber-200 text-sm break-all mb-4 font-mono">{inviteLink}</p>
          <CopyInviteButton link={inviteLink} />
        </div>

        <p className="text-stone-600 text-xs mb-3">
          This link only works once. Once your partner joins you’ll both land in the app automatically.
        </p>
        <PartnerWatcher />

        <form action={logout}>
          <button type="submit" className="text-stone-600 hover:text-stone-400 text-sm transition-colors">
            ← Back to sign in
          </button>
        </form>

        {/* Settings is out of reach until you're paired, so the account
            controls (export / delete) live here too — e.g. after a partner
            deletes their account. */}
        <details className="mt-10 text-left">
          <summary className="cursor-pointer text-center text-stone-600 hover:text-stone-400 text-xs list-none">Account options</summary>
          <div className="mt-4 rounded-2xl bg-stone-900 border border-stone-800 p-5">
            <AccountSection partnerName={null} />
            <p className="text-stone-500 text-xs mt-4">Partner left, or going through something hard? <a href="/support" className="underline underline-offset-2 text-stone-300">Help &amp; support</a></p>
          </div>
        </details>
      </div>
    </main>
  )
}
