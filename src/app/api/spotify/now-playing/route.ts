import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse, type NextRequest } from 'next/server'

async function refreshToken(userId: string, refreshToken: string) {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) return null

  const tokens = await res.json()
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const admin = createAdminClient()
  await admin.from('profiles').update({
    spotify_access_token: tokens.access_token,
    spotify_token_expires_at: expiresAt,
    ...(tokens.refresh_token ? { spotify_refresh_token: tokens.refresh_token } : {}),
  }).eq('id', userId)

  return tokens.access_token as string
}

// Returns the currently-playing track for a given user, or null.
async function trackFor(targetId: string) {
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('spotify_access_token, spotify_refresh_token, spotify_token_expires_at, display_name')
    .eq('id', targetId)
    .maybeSingle()

  if (!profile?.spotify_access_token) return null

  let accessToken = profile.spotify_access_token
  const expiresAt = profile.spotify_token_expires_at ? new Date(profile.spotify_token_expires_at) : null
  if (expiresAt && expiresAt.getTime() - Date.now() < 60_000) {
    if (!profile.spotify_refresh_token) return null
    const refreshed = await refreshToken(targetId, profile.spotify_refresh_token)
    if (!refreshed) return null
    accessToken = refreshed
  }

  const nowRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  })
  if (nowRes.status === 204 || !nowRes.ok) return null

  const nowData = await nowRes.json()
  if (!nowData?.is_playing || nowData?.currently_playing_type !== 'track') return null

  const track = nowData.item
  return {
    song: track.name,
    artist: track.artists.map((a: { name: string }) => a.name).join(', '),
    albumArt: track.album.images?.[2]?.url ?? track.album.images?.[0]?.url ?? null,
    partnerName: profile.display_name,
  }
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(null)

  // ?who=self returns the caller's own track; default (partner) preserves the
  // sidebar's original behaviour.
  const who = request.nextUrl.searchParams.get('who')
  if (who === 'self') return NextResponse.json(await trackFor(user.id))

  const { data: couple } = await supabase
    .from('couple')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .maybeSingle()

  const partnerId = couple
    ? couple.user1_id === user.id ? couple.user2_id : couple.user1_id
    : null

  if (!partnerId) return NextResponse.json(null)
  return NextResponse.json(await trackFor(partnerId))
}
