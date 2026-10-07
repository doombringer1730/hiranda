import { redirect } from 'next/navigation'
import { createClient } from '@/theater/supabase/server'
import TheaterBar from '@/theater/ui/theater-bar'

// The Theater's own shell. It sits outside the (app) route group on purpose:
// none of the app's chrome (nav, hub switcher, page transitions) renders here,
// so changes to the rest of Hiranda can't reach the sync code. URLs are
// unchanged — route groups don't appear in the path. See src/theater/README.md.
export default async function TheaterLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Same entry rules as the main app: a name, and a partner.
  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  if (!profile?.display_name) redirect('/setup')
  const { data: couples } = await supabase
    .from('couple')
    .select('user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('user2_id', { nullsFirst: false })
    .limit(1)
  if (!couples?.[0]?.user2_id) redirect('/invite-partner')

  return (
    <div className="min-h-screen">
      <TheaterBar />
      {children}
    </div>
  )
}
