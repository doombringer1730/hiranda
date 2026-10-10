import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { myFirstName, notifyPartner } from '@/lib/push'

// "Ask Miri to join" in the Theater: a notification to your partner's
// devices with a link straight into the session. Lives on the app side,
// since the Theater sandbox can't import the push code (src/theater/README.md);
// the Theater calls it by URL. RLS only finds sessions in your own couple.
export async function POST(req: NextRequest) {
  const { sessionId } = (await req.json().catch(() => ({}))) as { sessionId?: unknown }
  if (typeof sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(sessionId)) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const { data: session } = await supabase.from('watch_sessions').select('id, title, source_type').eq('id', sessionId).maybeSingle()
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const path = session.source_type === 'party' ? `/party/${session.id}` : `/watch/${session.id}`
  notifyPartner(async () => ({
    title: `${await myFirstName()} wants to watch with you 🍿`,
    body: `“${session.title}” — tap to join`,
    url: path,
    // One per session, so asking twice replaces rather than stacks.
    tag: `watch-${session.id}`,
  }))
  return NextResponse.json({ ok: true })
}
