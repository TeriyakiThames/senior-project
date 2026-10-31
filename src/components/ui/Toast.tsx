'use client';

import { useEffect, type ReactNode } from 'react';
import Image from 'next/image';

export interface ToastProps {
  isOpen: boolean;
  message: string;
  icon?: ReactNode;
  durationMs?: number;
  onClose: () => void;
}

export function Toast({ isOpen, message, icon, durationMs = 3000, onClose }: ToastProps) {
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [isOpen, durationMs, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-5 right-5 max-w-[400px] mx-auto bg-[#21215C] text-white rounded-2xl py-3.5 px-5 shadow-2xl flex items-center gap-3 z-50 transition-all transform animate-in fade-in slide-in-from-bottom-4"
    >
      <div className="shrink-0 flex items-center justify-center">
        {icon || (
          <Image
            src="/icons/confirm_tick.svg"
            alt=""
            width={20}
            height={20}
            unoptimized
            aria-hidden="true"
          />
        )}
      </div>
      <p className="text-white font-medium text-base sm:text-lg leading-snug">{message}</p>
    </div>
  );
}
