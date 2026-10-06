import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './lib/i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed', // Only show /en/ prefix, /th/ is default
});

export const config = {
  // Only internationalize LIFF pages, not API routes
  matcher: ['/(th|en)/liff/:path*'],
};
