import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// "Download our data": everything your couple can see, as one JSON file.
// Runs as the signed-in user, so row-level security decides what's included.
// Secrets (streaming API keys, passcode hash, invite token, Spotify tokens)
// are left out. Photo links are signed for 7 days so they can be saved.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    return NextResponse.json({ error: 'Finish two-factor sign-in first' }, { status: 403 })
  }

  const tables = [
    'memories', 'photos', 'journal_entries', 'journal_photos', 'important_dates', 'todos', 'bucket_list',
    'watchlist', 'books', 'music_moments', 'prompt_responses', 'study_decks', 'study_cards', 'study_attempts',
    'assignments', 'coupons', 'trivia_questions', 'board_games', 'love_taps', 'talk_sessions', 'messages', 'milestones', 'lesson_progress', 'lovemap_reviews',
    'store_addresses', 'store_orders', 'couple_plus', 'gift_sizes', 'trail_progress', 'trail_stamps', 'closeness_checkins', 'depth_optins',
  ]
  const results = await Promise.all(tables.map(t => supabase.from(t).select('*')))
  const data: Record<string, unknown> = {}
  tables.forEach((t, i) => { data[t] = results[i].data ?? [] })

  // Letters and jar slips are sealed: include what you're allowed to read
  // (your own, opened letters and drawn or opened slips) without opening
  // anything new.
  const { data: envelopes } = await supabase.from('letters').select('id, author, recipient, open_when, title, unlock_at, opened_at, created_at')
  data.letters = await Promise.all((envelopes ?? []).map(async l => {
    if (l.author !== user.id && !l.opened_at) return { ...l, body: null }
    const { data: b } = await supabase.rpc('read_letter', { p_id: l.id })
    return { ...l, body: (b as { body: string }[] | null)?.[0]?.body ?? null }
  }))
  const [{ data: ours }, { data: thanks }] = await Promise.all([
    supabase.rpc('jar_slips_for', { p_jar: 'ours' }),
    supabase.rpc('jar_slips_for', { p_jar: 'thanks' }),
  ])
  data.jar_slips = { ours: ours ?? [], thanks: thanks ?? [] }

  const [{ data: profiles }, { data: couple }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, username, bio, status_text, accent_color, avatar_url, banner_url, created_at'),
    supabase.from('couple').select('id, user1_id, user2_id, together_since, theme, created_at'),
  ])

  // Signed links for every memory and journal photo.
  const paths = [...(data.photos as { storage_path: string }[]), ...(data.journal_photos as { storage_path: string }[])]
    .map(p => p.storage_path).filter(Boolean)
  const photoLinks: Record<string, string> = {}
  if (paths.length) {
    const { data: signed } = await supabase.storage.from('photos').createSignedUrls(paths, 60 * 60 * 24 * 7)
    for (const s of signed ?? []) if (s.path && s.signedUrl) photoLinks[s.path] = s.signedUrl
  }

  const body = JSON.stringify({
    exported_at: new Date().toISOString(),
    exported_by: user.id,
    note: 'Everything your Hiranda space contains. Photo links work for 7 days.',
    profiles, couple, ...data, photo_links: photoLinks,
  }, null, 2)

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="hiranda-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
