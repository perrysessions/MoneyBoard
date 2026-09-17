import { NextResponse, type NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Do not call Supabase from routing middleware. A network call here can time
  // out before Next.js reaches the page, producing Vercel's 504 middleware
  // error. Dashboard pages still verify the signed session server-side with
  // `auth.getUser()` before reading any user data.
  const hasSessionCookie = request.cookies
    .getAll()
    .some(({ name }) => name.includes('-auth-token'))

  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
