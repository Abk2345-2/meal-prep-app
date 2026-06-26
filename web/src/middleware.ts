import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Set to true to open the app to everyone. Set to false to gate behind waitlist.
const APP_LAUNCHED = false;

export function middleware(request: NextRequest) {
  if (APP_LAUNCHED) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Allow: waitlist page, static assets, API routes, auth callbacks
  if (
    pathname.startsWith('/waitlist') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/auth')
  ) {
    return NextResponse.next();
  }

  // Everything else → waitlist
  return NextResponse.redirect(new URL('/waitlist', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
