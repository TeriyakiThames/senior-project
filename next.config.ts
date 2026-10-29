import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig: NextConfig = {
  serverExternalPackages: ['@google-cloud/speech', '@google-cloud/tasks', 'firebase-admin'],
  outputFileTracingIncludes: {
    '/api/webhook': [
      './node_modules/@google-cloud/tasks/**/*.json',
      './node_modules/@google-cloud/speech/**/*.json',
    ],
    '/api/notify': ['./node_modules/@google-cloud/tasks/**/*.json'],
  },
};

export default withNextIntl(nextConfig);
