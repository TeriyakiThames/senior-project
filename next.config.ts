import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import packageJson from './package.json';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

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
    value:
      "frame-ancestors 'self' https://line.me https://*.line.me https://*.line-apps.com https://*.naver.jp;",
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
