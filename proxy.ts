import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { appUrlFor } from '@/lib/site-urls';

const MARKETING_HOST = 'www.pitchinpublic.io';
const INTERNAL_MARKETING_PATH = '/marketing-home';

const privateHtmlPrefixes = [
  '/events',
  '/me',
  '/founder/invite',
  '/organizer/invite',
  '/reviewer/invite',
  '/notifications',
  '/pilot',
  '/pip-super-admin',
  '/auth',
];

const appOwnedPublicPrefixes = ['/pitch', '/profile', '/leaderboard'];

export function requestHost(request: Pick<NextRequest, 'headers'>) {
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  return (forwardedHost || request.headers.get('host') || '').split(':')[0].toLowerCase();
}

export function isPrivateHtmlPath(pathname: string) {
  return privateHtmlPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAppOwnedPath(pathname: string) {
  return [...privateHtmlPrefixes, ...appOwnedPublicPrefixes].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function isMarketingHomeRequest(host: string, pathname: string) {
  return host === MARKETING_HOST && pathname === '/';
}

export async function proxy(request: NextRequest) {
  const host = requestHost(request);
  const { pathname } = request.nextUrl;

  if (isMarketingHomeRequest(host, pathname)) {
    const destination = request.nextUrl.clone();
    destination.pathname = INTERNAL_MARKETING_PATH;
    return NextResponse.rewrite(destination);
  }

  if (host === MARKETING_HOST && pathname === INTERNAL_MARKETING_PATH) {
    return NextResponse.redirect(new URL('/', request.url), 308);
  }

  if (host === MARKETING_HOST && isAppOwnedPath(pathname)) {
    return NextResponse.redirect(appUrlFor(`${pathname}${request.nextUrl.search}`), 308);
  }

  const response = await updateSession(request);
  if (isPrivateHtmlPath(pathname)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  }
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - All static assets (fonts, images, documents, etc)
     *
     * This reduces middleware overhead by skipping static file requests
     * which don't need auth validation.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|eot|ico|css|js|map)$).*)',
  ],
};
