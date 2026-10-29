import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig: NextConfig = {
  serverExternalPackages: ['@google-cloud/speech', '@google-cloud/tasks', 'firebase-admin'],
  outputFileTracingIncludes: {
    '/api/**/*': [
      './node_modules/@google-cloud/tasks/**/*',
      './node_modules/@google-cloud/speech/**/*',
      './node_modules/.pnpm/@google-cloud+tasks*/**/*',
      './node_modules/.pnpm/@google-cloud+speech*/**/*',
    ],
  },
};

export default withNextIntl(nextConfig);
