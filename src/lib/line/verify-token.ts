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

  // Guard against oversized tokens or illegal characters (e.g. CRLF injection)
  if (cleanToken.length > 4096 || /[\r\n]/.test(cleanToken)) {
    return null;
  }

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

  // In production, refusing to verify without a client_id prevents confused deputy token substitution attacks
  if (process.env.NODE_ENV === 'production' && (!channelId || !channelId.trim())) {
    console.error(
      '[verifyLineIdToken] Security Alert: LINE channel ID (client_id) is not configured in production.',
    );
    return null;
  }

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
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data.sub || typeof data.sub !== 'string') {
      return null;
    }

    // Verify audience matches expected channel ID if returned by LINE endpoint
    if (channelId && data.aud && typeof data.aud === 'string' && data.aud !== channelId) {
      console.error(
        `[verifyLineIdToken] Security Alert: Token audience (${data.aud}) does not match expected channel ID (${channelId})`,
      );
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
