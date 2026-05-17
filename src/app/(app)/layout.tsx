import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Nav from '@/components/nav'
import CoupleTimer from '@/components/couple-timer'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single()
    if (!profile?.display_name) redirect('/setup')
  }

  return (
    <div className="min-h-screen bg-stone-950">
      <Nav />
      <CoupleTimer />
      <main className="md:ml-56 pt-20 md:pt-0 min-h-screen animate-page-in">
        {children}
      </main>
    </div>
  )
}
