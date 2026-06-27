import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Flip to true when you're ready to open the app to everyone.
const APP_LAUNCHED = false;

// Share this URL with testers: https://nuskhaa.app?preview=nuskhaa-dev-2026
// Visiting it once sets a cookie that bypasses the waitlist gate forever.
const PREVIEW_TOKEN = 'pp-dev-2026';
const PREVIEW_COOKIE = 'pp_preview';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Always allow static assets and auth flow
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/auth')
  ) {
    return NextResponse.next();
  }

  // If someone visits with ?preview=<token>, set the bypass cookie and redirect clean
  const token = searchParams.get('preview');
  if (token === PREVIEW_TOKEN) {
    const url = request.nextUrl.clone();
    url.searchParams.delete('preview');
    const res = NextResponse.redirect(url);
    res.cookies.set(PREVIEW_COOKIE, '1', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 90, // 90 days
      path: '/',
    });
    return res;
  }

  // If app is launched OR tester has the bypass cookie → let through
  if (APP_LAUNCHED || request.cookies.get(PREVIEW_COOKIE)?.value === '1') {
    return NextResponse.next();
  }

  // Allow waitlist page itself
  if (pathname.startsWith('/waitlist')) {
    return NextResponse.next();
  }

  // Everyone else → waitlist
  return NextResponse.redirect(new URL('/waitlist', request.url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
