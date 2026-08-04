import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export function shouldValidateSession(pathname: string) {
  return pathname.startsWith('/api/') && !pathname.startsWith('/api/health');
}

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
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
          applySessionCookieMutation(request, response, name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          applySessionCookieMutation(request, response, name, '', options);
        },
      },
    }
  );

  // Only validate auth for protected API routes
  // Skip getUser() call for public pages and most requests - client-side auth handles this
  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = shouldValidateSession(pathname);

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

/**
 * Mirrors each Supabase cookie mutation onto the request and the single
 * middleware response. Reusing the response is important: replacing it for
 * every mutation silently drops earlier Set-Cookie headers during token
 * rotation.
 */
export function applySessionCookieMutation(
  request: NextRequest,
  response: NextResponse,
  name: string,
  value: string,
  options: CookieOptions
) {
  request.cookies.set({ name, value, ...options });
  response.cookies.set({ name, value, ...options });
}
