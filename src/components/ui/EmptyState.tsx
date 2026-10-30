'use client';

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import liff from '@line/liff';

export interface EmptyStateProps {
  /** Background color class for the large circular badge (e.g. "bg-[#EEE1FA]") */
  badgeBgColor: string;
  /** Primary icon inside the circular badge */
  badgeIcon: ReactNode;
  /** Primary message (e.g. "ยังไม่มีโน้ตค่ะ") */
  title: string;
  /** Guidance description (supports multi-line strings or custom React elements) */
  description?: ReactNode;
  /** Action button text (defaults to t('goToChat')) */
  actionLabel?: string;
  /** Custom icon for the action button */
  actionIcon?: ReactNode;
  /** Background color class for the action button (defaults to "bg-[#3E81F7]") */
  actionButtonColor?: string;
  /** Click handler for action button (defaults to closing LIFF window to return to LINE chat) */
  onAction?: () => void;
  /** Whether to show the action button (defaults to true) */
  showActionButton?: boolean;
}

/**
 * Handles closing the LIFF window to return to the LINE chat,
 * or redirecting to the LINE universal link if running in an external browser.
 */
export function handleCloseOrRedirectToLine(onAction?: () => void): void {
  if (onAction) {
    onAction();
    return;
  }
  if (typeof window !== 'undefined') {
    try {
      if (
        typeof liff !== 'undefined' &&
        typeof liff.isInClient === 'function' &&
        liff.isInClient()
      ) {
        liff.closeWindow();
        return;
      }
    } catch (err) {
      console.warn('[EmptyState] Failed to call liff.closeWindow():', err);
    }
    window.location.href = 'https://line.me/R/';
  }
}

export function EmptyState({
  badgeBgColor,
  badgeIcon,
  title,
  description,
  actionLabel,
  actionIcon,
  actionButtonColor = 'bg-[#3E81F7]',
  onAction,
  showActionButton = true,
}: EmptyStateProps) {
  const t = useTranslations('dashboard');

  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      {/* Large Circular Pastel Badge matching Figma Image 3 */}
      <div
        className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 shadow-xs ${badgeBgColor}`}
      >
        {badgeIcon}
      </div>

      {/* Title */}
      <h3 className="text-2xl sm:text-3xl font-extrabold text-[#21215C] mb-3 tracking-tight">
        {title}
      </h3>

      {/* Description / Speech Prompt Guidance */}
      {description && (
        <div className="text-[#4B4F72] text-lg leading-relaxed mb-8 max-w-[320px] mx-auto font-normal">
          {description}
        </div>
      )}

      {/* Action CTA Button */}
      {showActionButton && (
        <button
          type="button"
          onClick={() => handleCloseOrRedirectToLine(onAction)}
          className={`w-full max-w-[340px] h-[54px] ${actionButtonColor} hover:opacity-90 active:scale-[0.98] rounded-2xl text-white font-bold text-lg flex items-center justify-center gap-2.5 mx-auto transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-[#3E81F7]`}
        >
          {actionIcon || (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden="true"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" strokeLinecap="round" />
            </svg>
          )}
          <span>{actionLabel || t('goToChat')}</span>
        </button>
      )}
    </div>
  );
}
