import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import packageJson from './package.json';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.line-scdn.net https://d.line-scdn.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.line.me https://*.line.me",
  "frame-ancestors 'self' https://line.me https://*.line.me https://*.line-apps.com https://*.naver.jp",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=(), browsing-topics=()',
  },
  {
    key: 'Content-Security-Policy',
    value: cspDirectives,
  },
];

const apiSecurityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none';",
  },
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
    NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV || '',
  },
  serverExternalPackages: ['@google-cloud/speech', '@google-cloud/tasks', 'firebase-admin'],
  outputFileTracingIncludes: {
    '/*': [
      './node_modules/.pnpm/@google-cloud+tasks*/**/@google-cloud/tasks/build/**/*.json',
      './node_modules/.pnpm/@google-cloud+speech*/**/@google-cloud/speech/build/**/*.json',
      './node_modules/.pnpm/google-gax*/**/google-gax/build/**/*.json',
    ],
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: apiSecurityHeaders,
      },
      {
        source: '/((?!api).*)',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/:locale(th|en)/liff/alarms',
        destination: '/:locale/liff/timer',
        permanent: true,
      },
      {
        source: '/:locale(th|en)/liff/alarm',
        destination: '/:locale/liff/timer',
        permanent: true,
      },
      {
        source: '/:locale(th|en)/liff/timers',
        destination: '/:locale/liff/timer',
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
