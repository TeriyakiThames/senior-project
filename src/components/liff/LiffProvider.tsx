'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import liff from '@line/liff';

export interface LiffContextType {
  isReady: boolean;
  userId: string | null;
  displayName: string | null;
  language: string;
  isInClient: boolean;
  error: Error | null;
}

export const MOCK_USER: LiffContextType = {
  isReady: true,
  userId: 'mock-user-123',
  displayName: 'คุณยายสมศรี',
  language: 'th',
  isInClient: false,
  error: null,
};

const LiffContext = createContext<LiffContextType>({
  isReady: false,
  userId: null,
  displayName: null,
  language: 'th',
  isInClient: false,
  error: null,
});

export function LiffProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiffContextType>({
    isReady: false,
    userId: null,
    displayName: null,
    language: 'th',
    isInClient: false,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

    // Fallback to mock user if LIFF ID is not configured
    if (!liffId) {
      setState(MOCK_USER);
      return;
    }

    async function initLiff() {
      try {
        await liff.init({ liffId: liffId! });

        // If outside LINE client and not logged in during development, fallback to mock user
        if (!liff.isInClient() && !liff.isLoggedIn()) {
          if (process.env.NODE_ENV !== 'production') {
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
        if (isMounted) {
          setState({
            isReady: true,
            userId: profile.userId,
            displayName: profile.displayName,
            language: lang === 'en' ? 'en' : 'th',
            isInClient: liff.isInClient(),
            error: null,
          });
        }
      } catch (err: unknown) {
        console.error('LIFF initialization error:', err);
        // In local development, fallback gracefully to mock user on init error
        if (process.env.NODE_ENV !== 'production' && isMounted) {
          setState(MOCK_USER);
        } else if (isMounted) {
          setState((prev) => ({
            ...prev,
            isReady: true,
            error: err instanceof Error ? err : new Error(String(err)),
          }));
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
