import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Bypass checks for login page, assets, and auth APIs
  if (
    path === '/login' ||
    path.startsWith('/api/auth') ||
    path.startsWith('/_next') ||
    path.includes('.')
  ) {
    return NextResponse.next();
  }

  const cookieName = 'salonpro_admin_token';
  const token = request.cookies.get(cookieName)?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Quick client-side expiry check
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = atob(base64);
    const payload = JSON.parse(jsonPayload);

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete(cookieName);
      return response;
    }
  } catch (err) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete(cookieName);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect all dashboard, users, notifications, revenue, settings, etc.
    '/((?!api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
