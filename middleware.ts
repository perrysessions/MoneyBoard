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

  // `getUser()` makes a request to Supabase Auth for every page navigation.
  // In Vercel middleware that external request can hold up routing long enough
  // to produce a 504. `getClaims()` verifies the signed session token locally
  // when the project uses asymmetric signing keys (with cached JWKS fallback).
  const { data: claimsData } = await supabase.auth.getClaims()
  const user = claimsData?.claims ?? null

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  // Keep Supabase session refresh and access checks on protected pages only.
  // In particular, a login form submission must not wait for middleware before
  // its server action can reach Supabase Auth.
  matcher: ['/dashboard/:path*'],
}
