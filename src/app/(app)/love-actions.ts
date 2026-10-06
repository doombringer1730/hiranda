'use server'

import { createClient } from '@/lib/supabase/server'
import { notifyPartner, myFirstName } from '@/lib/push'

// "Thinking of you" — records a tap and pings the partner's phone.
export async function sendLove() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  // Gentle rate limit: one tap every 10 seconds is plenty of love.
  const { data: last } = await supabase.from('love_taps').select('created_at')
    .eq('from_user', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (last && Date.now() - new Date(last.created_at).getTime() < 10_000) return { ok: true }

  const { error } = await supabase.from('love_taps').insert({ from_user: user.id })
  if (error) return { error: 'Could not send' }

  notifyPartner(async () => ({
    title: `${await myFirstName()} is thinking of you 💗`,
    body: 'Tap to send one back.',
    url: '/',
    tag: 'love',
  }))
  return { ok: true }
}
