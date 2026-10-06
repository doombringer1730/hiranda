import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup')
    || request.nextUrl.pathname.startsWith('/forgot-password')
  // /demo is the public walkthrough space (static example data, no user content).
  // /join/<token> must stay reachable signed-out — bouncing it through /login
  // drops the invite token, which is the whole point of the link.
  const isPublicPage =
    isAuthPage ||
    request.nextUrl.pathname.startsWith('/demo') ||
    request.nextUrl.pathname.startsWith('/join/')

  if (!user && !isPublicPage) {
    const url = request.nextUrl.clone()
    const next = request.nextUrl.pathname + request.nextUrl.search
    url.pathname = '/login'
    url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  // Exclude static assets, Next.js internals, the favicon, AND all /api/* routes.
  // API routes handle their own auth internally — routing them through the
  // redirect middleware breaks unauthenticated callers (e.g. the extension's
  // NTP sync hits /api/time with no session cookie and gets HTML instead of JSON).
  // The PWA files (manifest, service worker) are excluded too:
  // browsers fetch the manifest without cookies, so a login redirect breaks
  // installing the app.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|manifest\\.webmanifest|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
