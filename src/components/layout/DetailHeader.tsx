'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

export interface DetailHeaderProps {
  /** Main category title (e.g. "โน้ต", "นาฬิกาปลุก", "การเตือน") */
  title: string;
  /** Subtitle with item count and ordering metadata (e.g. "12 โน้ต · ใหม่สุดอยู่บนสุด") */
  subtitle?: string;
  /** Background color class or hex for the squircle badge (e.g. "bg-[#EEE1FA]") */
  badgeBgColor: string;
  /** Icon element rendered inside the badge */
  badgeIcon: ReactNode;
  /** Route to navigate back to (defaults to `/${locale}/liff`) */
  backHref?: string;
  /** Service name displayed in top LINE bar (defaults to t('serviceName')) */
  serviceName?: string;
  /** Optional custom handler for closing the window */
  onClose?: () => void;
  /** Optional settings route for the options menu */
  settingsHref?: string;
}

export function DetailHeader({
  title,
  subtitle,
  badgeBgColor,
  badgeIcon,
  backHref,
  serviceName,
  onClose,
  settingsHref,
}: DetailHeaderProps) {
  const locale = useLocale();
  const t = useTranslations('dashboard');

  const defaultBackHref = backHref || `/${locale}/liff`;
  const defaultSettingsHref = settingsHref || `/${locale}/liff/settings`;
  const displayServiceName = serviceName || t('serviceName');

  const handleClose = () => {
    if (onClose) {
      onClose();
      return;
    }
    if (
      typeof window !== 'undefined' &&
      (
        window as unknown as {
          liff?: { isInClient: () => boolean; closeWindow: () => void };
        }
      ).liff?.isInClient()
    ) {
      (window as unknown as { liff: { closeWindow: () => void } }).liff.closeWindow();
    }
  };

  return (
    <div className="w-full">
      {/* Top Header Bar matching SVG: Close 'X', Service Title '[ชื่อบริการ]', Options '...' */}
      <header className="w-full bg-white h-[54px] px-5 flex items-center justify-between border-b border-[#F2F7FA]">
        <button
          type="button"
          onClick={handleClose}
          className="min-w-[48px] min-h-[48px] flex items-center justify-start text-[#111111] hover:opacity-75 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#21215C] rounded-lg"
          aria-label={t('cancel')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M1.5 1.5L12.5 12.5M12.5 1.5L1.5 12.5"
              stroke="#111111"
              strokeWidth="2.0174"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <h1 className="text-base sm:text-lg font-bold text-[#111111] tracking-tight">
          {displayServiceName}
        </h1>

        <Link
          href={defaultSettingsHref}
          className="min-w-[48px] min-h-[48px] flex items-center justify-end text-[#111111] hover:opacity-75 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#21215C] rounded-lg"
          aria-label={t('settings')}
        >
          <svg width="18" height="4" viewBox="0 0 18 4" fill="none" aria-hidden="true">
            <circle cx="2" cy="2" r="1.6" fill="#111111" />
            <circle cx="9" cy="2" r="1.6" fill="#111111" />
            <circle cx="16" cy="2" r="1.6" fill="#111111" />
          </svg>
        </Link>
      </header>

      {/* Sub-Header: Back chevron navigation + Category Squircle Badge + Title + Subtitle */}
      <div className="pt-4 pb-2 px-5 max-w-[440px] mx-auto">
        <div className="flex items-center gap-3">
          <Link
            href={defaultBackHref}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#21215C] hover:opacity-75 active:scale-95 transition-all -ml-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#21215C]"
            aria-label={t('back')}
          >
            <svg width="12" height="20" viewBox="0 0 12 20" fill="none" aria-hidden="true">
              <path
                d="M10 2L2 10L10 18"
                stroke="#21215C"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>

          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${badgeBgColor}`}
          >
            {badgeIcon}
          </div>

          <h2 className="text-3xl font-extrabold text-[#21215C] tracking-tight">{title}</h2>
        </div>

        {subtitle && (
          <p className="text-senior-base text-[#7D84A3] font-medium mt-3 pl-1">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
