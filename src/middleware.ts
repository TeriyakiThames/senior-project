import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './lib/i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always',
});

export const config = {
  // Internationalize LIFF pages and locale routes, not API routes
  matcher: ['/(th|en)/:path*', '/liff/:path*', '/liff'],
};
