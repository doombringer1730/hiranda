import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import CopyInviteButton from './copy-button'
import { logout } from '@/app/(auth)/actions'

export default async function InvitePartnerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: couple } = await supabase
    .from('couple')
    .select('invite_token, user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .maybeSingle()

  // Already paired, is Person 2, or has no couple — nothing to do here
  if (!couple || couple.user2_id || couple.user1_id !== user.id) redirect('/')

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
          Share this link with your partner so they can join your space. They'll need it to sign up.
        </p>

        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 mb-4">
          <p className="text-stone-500 text-xs uppercase tracking-widest mb-3">Your invite link</p>
          <p className="text-amber-200 text-sm break-all mb-4 font-mono">{inviteLink}</p>
          <CopyInviteButton link={inviteLink} />
        </div>

        <p className="text-stone-600 text-xs mb-8">
          This link only works once. Once your partner joins you'll both land in the app automatically.
        </p>

        <form action={logout}>
          <button type="submit" className="text-stone-600 hover:text-stone-400 text-sm transition-colors">
            ← Back to sign in
          </button>
        </form>
      </div>
    </main>
  )
}
