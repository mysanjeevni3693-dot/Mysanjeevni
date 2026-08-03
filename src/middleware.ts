import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Prevent CDN/browser from caching HTML documents for a year.
 * Stale HTML after deploy references deleted `/_next/static/chunks/*` files → white screen.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let hashed build assets keep long-lived caching (handled in next.config).
  if (pathname.startsWith('/_next/static')) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.headers.set(
    'Cache-Control',
    'private, no-cache, no-store, max-age=0, must-revalidate'
  );
  response.headers.set('CDN-Cache-Control', 'no-store');
  response.headers.set('Surrogate-Control', 'no-store');
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except Next static assets and common static files.
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};
