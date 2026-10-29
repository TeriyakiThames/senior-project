import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig: NextConfig = {
  serverExternalPackages: ['@google-cloud/speech', '@google-cloud/tasks', 'firebase-admin'],
  outputFileTracingIncludes: {
    '/*': ['./node_modules/.pnpm/@google-cloud+tasks*/**/@google-cloud/tasks/build/esm/**/*.json'],
  },
};

export default withNextIntl(nextConfig);
