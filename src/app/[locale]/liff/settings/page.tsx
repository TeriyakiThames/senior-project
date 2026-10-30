'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useLiff } from '@/components/liff/LiffProvider';
import { DetailHeader } from '@/components/layout/DetailHeader';
import { APP_VERSION } from '@/lib/constants/version';

export default function SettingsPage() {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const router = useRouter();
  const pathname = usePathname() || '';
  const { isReady, displayName, userId } = useLiff();

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#F2F7FA] flex items-center justify-center p-6">
        <div className="text-center">
          <div
            className="w-12 h-12 border-4 border-[#3E81F7] border-t-transparent rounded-full animate-spin mx-auto mb-4"
            aria-hidden="true"
          />
          <p className="text-[#21215C] text-senior-base font-semibold">{t('loading')}</p>
        </div>
      </div>
    );
  }

  const switchLanguage = (newLocale: 'th' | 'en') => {
    if (newLocale === locale) return;
    const cleanPath = pathname.replace(/^\/(th|en)/, '') || '/liff/settings';
    router.push(`/${newLocale}${cleanPath}`);
  };

  const isThai = locale.startsWith('th');

  return (
    <div className="min-h-screen bg-[#F2F7FA] text-[#21215C]">
      {/* Top LINE Service App Bar + Category Header matching Figma Ground Truth */}
      <DetailHeader
        title={t('settings')}
        subtitle={t('settingsSubtitle')}
        badgeBgColor="bg-[#FDE5F0]"
        badgeIcon={
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="3" stroke="#B4225A" strokeWidth="2.2" fill="#E8216F" />
            <path
              d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
              stroke="#B4225A"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        }
        showSettings={false}
      />

      <main className="px-5 pt-1 pb-16 max-w-[440px] mx-auto space-y-4">
        {/* Profile Card */}
        <section aria-labelledby="profile-heading">
          <div className="bg-white rounded-3xl p-5 shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)]">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl" aria-hidden="true">
                👤
              </span>
              <h2 id="profile-heading" className="text-xl font-bold text-[#21215C]">
                {t('profile')}
              </h2>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-[#7D84A3] mb-0.5">{t('name')}</p>
                <p className="text-xl font-bold text-[#21215C] break-words">{displayName || '—'}</p>
              </div>
              <div className="pt-3 border-t border-[#F2F7FA]">
                <p className="text-sm font-medium text-[#7D84A3] mb-1">{t('userId')}</p>
                <p className="text-xs sm:text-sm font-mono text-[#4B4F72] break-all bg-[#F2F7FA] p-2.5 rounded-2xl select-all">
                  {userId || '—'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Language Switcher Card */}
        <section aria-labelledby="language-heading">
          <div className="bg-white rounded-3xl p-5 shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)]">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl" aria-hidden="true">
                🌐
              </span>
              <h2 id="language-heading" className="text-xl font-bold text-[#21215C]">
                {t('language')}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => switchLanguage('th')}
                aria-pressed={isThai}
                className={`min-h-[52px] px-4 py-3 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#21215C] ${
                  isThai
                    ? 'bg-[#21215C] text-white shadow-md'
                    : 'bg-white text-[#21215C] border-2 border-[#7D84A3]/30 hover:border-[#21215C]'
                }`}
              >
                <span>{t('thai')}</span>
                {isThai && (
                  <span className="text-sm font-black" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => switchLanguage('en')}
                aria-pressed={!isThai}
                className={`min-h-[52px] px-4 py-3 rounded-2xl font-bold text-base transition-all flex items-center justify-center gap-2 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#21215C] ${
                  !isThai
                    ? 'bg-[#21215C] text-white shadow-md'
                    : 'bg-white text-[#21215C] border-2 border-[#7D84A3]/30 hover:border-[#21215C]'
                }`}
              >
                <span>{t('english')}</span>
                {!isThai && (
                  <span className="text-sm font-black" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* App Info Card */}
        <section aria-labelledby="app-info-heading">
          <div className="bg-white rounded-3xl p-5 shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl" aria-hidden="true">
                📱
              </span>
              <h2 id="app-info-heading" className="text-xl font-bold text-[#21215C]">
                {t('appInfo')}
              </h2>
            </div>
            <p className="text-base text-[#21215C] leading-relaxed mb-4">{t('appDescription')}</p>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#F2F7FA]">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E1E8F8] text-[#385289] rounded-full text-sm font-semibold">
                <span aria-hidden="true">🎙️</span>
                <span>{t('voiceAssistantBadge')}</span>
              </span>
              <span className="text-sm font-medium text-[#7D84A3]">
                {t('version')} {APP_VERSION}
              </span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
