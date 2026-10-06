import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/nav'
import HubSwitcher from '@/components/hub-switcher'
import PageTransition from '@/components/page-transition'
import { getTheaterState } from '@/lib/theater'
import { RememberAccount, type RememberedAccount } from '@/components/remember-account'


export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let remembered: RememberedAccount | null = null

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
    if (!profile?.display_name) redirect('/setup')
    remembered = { name: profile.display_name.split(' ')[0], email: user.email ?? '', provider: user.app_metadata?.provider ?? 'email' }

    // A user should only ever be in one couple, but user1_id and user2_id are
    // independently unique, so someone who started their own space and then
    // accepted an invite ends up in two rows. .maybeSingle() errors on that and
    // yields null, which bounced them between here and /invite-partner forever.
    // Prefer the paired space; nullsFirst: false sorts a real partner ahead.
    const { data: couples } = await supabase
      .from('couple')
      .select('user2_id')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order('user2_id', { nullsFirst: false })
      .limit(1)

    if (!couples?.[0]?.user2_id) redirect('/invite-partner')
  }

  const { unlocked } = await getTheaterState()

  return (
    <div className="min-h-screen">
      <Nav theaterUnlocked={unlocked} />
      {remembered && <RememberAccount {...remembered} />}
      <main className="md:ml-[16.5rem] pb-[calc(96px+env(safe-area-inset-bottom))] md:pb-10 min-h-screen">
        <HubSwitcher theaterUnlocked={unlocked} />
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  )
}
