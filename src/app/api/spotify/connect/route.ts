import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NextRequest } from 'next/server'

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: 'user-read-currently-playing user-read-playback-state',
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/spotify/callback`,
    show_dialog: 'false',
  })

  redirect(`https://accounts.spotify.com/authorize?${params}`)
}
