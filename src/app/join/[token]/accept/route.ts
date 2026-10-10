import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notifyPartner, myFirstName } from '@/lib/push'

// A signed-in person opening an invite: claim the spot, then ping the partner
// who sent it. A route handler (not the page) because the ping runs after the
// response and needs the session cookie, which pages can't read at that point.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url))
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return to(`/join/${encodeURIComponent(token)}`)

  // Tapping your own link to check it: back to your invite screen.
  const { data: mine } = await supabase.from('couple').select('id').eq('invite_token', token).eq('user1_id', user.id).limit(1)
  if (mine?.length) return to('/invite-partner')

  const { data: joined, error } = await supabase.rpc('accept_invite', { token, new_user_id: user.id })
  if (!joined || error) return to(`/join/${encodeURIComponent(token)}?error=1`)
  notifyPartner(async () => ({ title: `${await myFirstName()} joined your space 💗`, body: 'Your little place is ready. Come say hi.', url: '/', tag: 'joined' }))
  return to('/')
}
