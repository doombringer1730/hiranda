import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, isValidSession, sitePassword } from './lib/auth'

export function proxy(request: NextRequest) {
  if (!sitePassword()) {
    return new NextResponse('Set SITE_PASSWORD to use this site.', { status: 503 })
  }
  if (request.nextUrl.pathname === '/login') return NextResponse.next()
  if (isValidSession(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next()
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt).*)'],
}
