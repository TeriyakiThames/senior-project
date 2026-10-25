export interface VerifiedLineToken {
  lineUserId: string;
  displayName?: string;
  picture?: string;
  email?: string;
}

/**
 * Verifies a LINE OpenID Connect ID token using LINE's OAuth2 verification endpoint.
 *
 * @param idToken The raw JWT ID token string from LINE (e.g. from liff.getIDToken())
 * @param expectedChannelId Optional channel ID to verify against; defaults to configured LIFF / Login channel ID.
 * @returns VerifiedLineToken with the authentic lineUserId (sub) if valid, or null if invalid.
 */
export async function verifyLineIdToken(
  idToken: string,
  expectedChannelId?: string,
): Promise<VerifiedLineToken | null> {
  if (!idToken || typeof idToken !== 'string' || idToken.trim() === '') {
    return null;
  }

  const cleanToken = idToken.trim();

  // In non-production environments (test/development), allow mock-token prefixes for offline development
  if (process.env.NODE_ENV !== 'production' && cleanToken.startsWith('mock-token-')) {
    const suffix = cleanToken.slice('mock-token-'.length) || '123';
    return {
      lineUserId: `mock-user-${suffix}`,
      displayName: `Mock User ${suffix}`,
    };
  }

  const channelId =
    expectedChannelId ||
    process.env.LINE_LOGIN_CHANNEL_ID ||
    process.env.NEXT_PUBLIC_LIFF_ID?.split('-')[0] ||
    process.env.LIFF_ID?.split('-')[0] ||
    process.env.LINE_CHANNEL_ID;

  try {
    const params = new URLSearchParams();
    params.append('id_token', cleanToken);
    if (channelId) {
      params.append('client_id', channelId);
    }

    const response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data.sub || typeof data.sub !== 'string') {
      return null;
    }

    return {
      lineUserId: data.sub,
      displayName: data.name,
      picture: data.picture,
      email: data.email,
    };
  } catch (error) {
    console.error('[verifyLineIdToken] Failed to verify LINE ID token:', error);
    return null;
  }
}
