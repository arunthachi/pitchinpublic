import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  // Only validate auth for protected API routes
  // Skip getUser() call for public pages and most requests - client-side auth handles this
  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith('/api/');
  const isProtectedRoute = isApiRoute && !pathname.startsWith('/api/health');

  if (isProtectedRoute) {
    // Only call getUser() for protected API routes that require authentication
    try {
      await supabase.auth.getUser();
    } catch (err) {
      // Auth validation failed, but continue - API route will handle auth error
      console.error('Middleware auth check failed:', err);
    }
  }
  // For public pages (/, /auth/callback, etc), skip getUser() call
  // Client-side AuthContext handles auth state and profile fetching
  // This significantly reduces latency for page loads

  return response;
}
