import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './lib/i18n/config';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Protect against open redirect, host spoofing, and path traversal
  // Reject paths containing duplicate slashes, backslashes, control characters, or encoded traversal
  if (
    pathname.startsWith('//') ||
    pathname.includes('\\') ||
    pathname.includes('//') ||
    pathname.toLowerCase().includes('%5c') ||
    pathname.toLowerCase().includes('%2f') ||
    pathname.toLowerCase().includes('%00') ||
    /[\x00-\x1f\x7f]/.test(pathname)
  ) {
    return new NextResponse('Bad Request: Invalid URL path', { status: 400 });
  }

  return intlMiddleware(request);
}

export const config = {
  // Internationalize LIFF pages and locale routes, not API routes
  matcher: ['/(th|en)/:path*', '/liff/:path*', '/liff'],
};
