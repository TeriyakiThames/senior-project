'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import liff from '@line/liff';

export interface LiffContextType {
  isReady: boolean;
  userId: string | null;
  displayName: string | null;
  language: string;
  isInClient: boolean;
  idToken: string | null;
  error: Error | null;
}

export const MOCK_USER: LiffContextType = {
  isReady: true,
  userId: 'mock-user-123',
  displayName: 'คุณยายสมศรี',
  language: 'th',
  isInClient: false,
  idToken: 'mock-token-123',
  error: null,
};

const LiffContext = createContext<LiffContextType>({
  isReady: false,
  userId: null,
  displayName: null,
  language: 'th',
  isInClient: false,
  idToken: null,
  error: null,
});

export function isPlaceholderLiffId(id?: string | null): boolean {
  if (!id) return true;
  const trimmed = id.trim().toLowerCase();
  return trimmed === '' || trimmed.includes('placeholder') || trimmed.includes('<your-');
}

/**
 * Determines whether mock user fallback is permitted.
 * Strictly prevents mock user activation on deployed staging or production environments (S7).
 */
export function shouldEnableMockUser(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  if (process.env.NEXT_PUBLIC_ENABLE_MOCK_USER === 'true') {
    return true;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  }

  return false;
}

export function LiffProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiffContextType>({
    isReady: false,
    userId: null,
    displayName: null,
    language: 'th',
    isInClient: false,
    idToken: null,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

    // Check placeholder / unconfigured LIFF ID
    if (isPlaceholderLiffId(liffId)) {
      if (shouldEnableMockUser()) {
        console.info(
          '[LIFF] Placeholder or unconfigured LIFF ID detected; activating mock user for local development.',
        );
        setState(MOCK_USER);
      } else {
        setState({
          isReady: true,
          userId: null,
          displayName: null,
          language: 'th',
          isInClient: false,
          idToken: null,
          error: new Error(
            'NEXT_PUBLIC_LIFF_ID is not configured or is a placeholder. Set a valid LIFF ID in your environment.',
          ),
        });
      }
      return;
    }

    async function initLiff() {
      try {
        await liff.init({ liffId: liffId! });

        // If outside LINE client and not logged in
        if (!liff.isInClient() && !liff.isLoggedIn()) {
          if (shouldEnableMockUser()) {
            if (isMounted) setState(MOCK_USER);
            return;
          }
          liff.login();
          return;
        }

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        const lang = liff.getLanguage();
        let idToken: string | null = null;
        try {
          idToken = liff.getIDToken();
        } catch {
          idToken = null;
        }

        if (isMounted) {
          setState({
            isReady: true,
            userId: profile.userId,
            displayName: profile.displayName,
            language: lang === 'en' ? 'en' : 'th',
            isInClient: liff.isInClient(),
            idToken,
            error: null,
          });
        }
      } catch (err: unknown) {
        // Fallback to mock user ONLY in permitted local development environments (S7)
        if (shouldEnableMockUser() && isMounted) {
          console.warn(
            '[LIFF] Initialization failed in local development, falling back to mock user:',
            err,
          );
          setState(MOCK_USER);
        } else if (isMounted) {
          console.error('LIFF initialization error:', err);
          setState({
            isReady: true,
            userId: null,
            displayName: null,
            language: 'th',
            isInClient: false,
            idToken: null,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      }
    }

    initLiff();

    return () => {
      isMounted = false;
    };
  }, []);

  return <LiffContext.Provider value={state}>{children}</LiffContext.Provider>;
}

export function useLiff() {
  return useContext(LiffContext);
}
