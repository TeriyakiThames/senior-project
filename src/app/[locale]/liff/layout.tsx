'use client';

import { LiffProvider } from '@/components/liff/LiffProvider';
import { BottomNav } from '@/components/layout/BottomNav';

export default function LiffLayout({ children }: { children: React.ReactNode }) {
  return (
    <LiffProvider>
      <main className="pb-24">{children}</main>
      <BottomNav />
    </LiffProvider>
  );
}
