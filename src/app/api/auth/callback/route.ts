import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Where email links (password reset) and Google sign-in land. Exchanges the
// one-time code for a session, then continues to `next` — same-site paths only.
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(safeNext, url.origin))
  }

  const failed = new URL('/login', url.origin)
  failed.searchParams.set('error', url.searchParams.get('error_description') ?? 'That link has expired or was already used.')
  return NextResponse.redirect(failed)
}
