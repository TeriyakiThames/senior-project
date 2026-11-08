/**
 * Environment detection and mock authorization utilities.
 * Ensures mock users/tokens are permitted in local development and Vercel preview environments,
 * while strictly blocking them in production (S3, S7 Security Hardening).
 */

/**
 * Detects whether the current execution is running in a preview/staging environment
 * (such as Vercel preview deployments) or local development.
 */
export function isVercelPreview(): boolean {
  if (
    process.env.VERCEL_ENV === 'preview' ||
    process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'
  ) {
    return true;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Vercel preview URLs usually contain '-git-' or end with '.vercel.app' while not being the production domain
    if (
      host.includes('-git-') ||
      (host.endsWith('.vercel.app') && !host.startsWith('senior-project-eta-two'))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether mock user/mock data access is permitted.
 * Permitted in:
 * - Vercel preview deployments (VERCEL_ENV === 'preview' or preview hostname)
 * - Test environment (NODE_ENV === 'test')
 * - Local server/test development (NODE_ENV !== 'production')
 * - Localhost browser or explicit opt-in (NEXT_PUBLIC_ENABLE_MOCK_USER === 'true')
 */
export function isMockAllowed(): boolean {
  // Always allowed in Vercel preview (even though NODE_ENV is production in Next.js builds)
  if (isVercelPreview()) {
    return true;
  }

  // Strictly forbidden in production under all conditions
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  // In non-production browser environments, require localhost or explicit opt-in
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
    if (isLocal || process.env.NEXT_PUBLIC_ENABLE_MOCK_USER === 'true') {
      return true;
    }
    return false;
  }

  // In Node.js non-production environments (server API routes, tests, offline dev)
  return true;
}

/**
 * Returns true if running in strict production mode.
 * Strictly prevents mock user activation on deployed production environments (S7).
 */
export function isStrictProduction(): boolean {
  return process.env.NODE_ENV === 'production' && !isVercelPreview();
}
