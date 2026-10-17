'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { notifyPartner, myFirstName } from '@/lib/push'

// A signed-in person tapping "Join" on an invite: claim the spot, then ping
// the partner who sent it. A server action (POST, and Next refuses actions
// posted from another site), so a link or page elsewhere can't join someone
// to a space without them pressing the button.
export async function acceptInvite(token: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const back = `/join/${encodeURIComponent(token)}`
  if (!user) redirect(back)

  // Tapping your own link to check it: back to your invite screen.
  const { data: mine } = await supabase.from('couple').select('id').eq('invite_token', token).eq('user1_id', user.id).limit(1)
  if (mine?.length) redirect('/invite-partner')

  const { data: joined, error } = await supabase.rpc('accept_invite', { token, new_user_id: user.id })
  if (!joined || error) redirect(`${back}?error=1`)
  notifyPartner(async () => ({ title: `${await myFirstName()} joined your space 💗`, body: 'Your little place is ready. Come say hi.', url: '/', tag: 'joined' }))
  redirect('/')
}
