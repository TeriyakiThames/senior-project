import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import packageJson from './package.json';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

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
