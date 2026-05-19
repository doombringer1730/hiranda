import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

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

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(null)

  // Find partner
  const { data: couple } = await supabase
    .from('couple')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .maybeSingle()

  const partnerId = couple
    ? couple.user1_id === user.id ? couple.user2_id : couple.user1_id
    : null

  if (!partnerId) return NextResponse.json(null)

  // Read partner's tokens via admin (bypasses RLS for sensitive columns)
  const admin = createAdminClient()
  const { data: partnerProfile } = await admin
    .from('profiles')
    .select('spotify_access_token, spotify_refresh_token, spotify_token_expires_at, display_name')
    .eq('id', partnerId)
    .maybeSingle()

  if (!partnerProfile?.spotify_access_token) return NextResponse.json(null)

  // Refresh if expired (with 60s buffer)
  let accessToken = partnerProfile.spotify_access_token
  const expiresAt = partnerProfile.spotify_token_expires_at
    ? new Date(partnerProfile.spotify_token_expires_at)
    : null

  if (expiresAt && expiresAt.getTime() - Date.now() < 60_000) {
    if (!partnerProfile.spotify_refresh_token) return NextResponse.json(null)
    const refreshed = await refreshToken(partnerId, partnerProfile.spotify_refresh_token)
    if (!refreshed) return NextResponse.json(null)
    accessToken = refreshed
  }

  // Fetch currently playing
  const nowRes = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 0 },
  })

  if (nowRes.status === 204 || !nowRes.ok) return NextResponse.json(null)

  const nowData = await nowRes.json()

  if (!nowData?.is_playing || nowData?.currently_playing_type !== 'track') {
    return NextResponse.json(null)
  }

  const track = nowData.item
  return NextResponse.json({
    song: track.name,
    artist: track.artists.map((a: { name: string }) => a.name).join(', '),
    albumArt: track.album.images?.[2]?.url ?? track.album.images?.[0]?.url ?? null,
    partnerName: partnerProfile.display_name,
  })
}
