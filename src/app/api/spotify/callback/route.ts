import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/settings?spotify=error', req.url))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  // Exchange code for tokens
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64')

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/spotify/callback`,
    }),
  })

  if (!tokenRes.ok) return NextResponse.redirect(new URL('/settings?spotify=error', req.url))

  const tokens = await tokenRes.json()

  // Get Spotify display name
  const profileRes = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const spotifyProfile = profileRes.ok ? await profileRes.json() : null

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const admin = createAdminClient()
  await admin.from('profiles').update({
    spotify_access_token: tokens.access_token,
    spotify_refresh_token: tokens.refresh_token,
    spotify_token_expires_at: expiresAt,
    spotify_display_name: spotifyProfile?.display_name ?? null,
  }).eq('id', user.id)

  return NextResponse.redirect(new URL('/settings?spotify=connected', req.url))
}
