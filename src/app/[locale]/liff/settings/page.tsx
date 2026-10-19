'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useLiff } from '@/components/liff/LiffProvider';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { PageWrapper } from '@/components/layout/PageWrapper';

export default function SettingsPage() {
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const router = useRouter();
  const pathname = usePathname() || '';
  const { isReady, displayName, userId } = useLiff();

  if (!isReady) {
    return (
      <PageWrapper className="flex items-center justify-center min-h-[60vh]">
        <Loading message={t('loading')} />
      </PageWrapper>
    );
  }

  const switchLanguage = (newLocale: 'th' | 'en') => {
    if (newLocale === locale) return;
    const cleanPath = pathname.replace(/^\/(th|en)/, '') || '/liff/settings';
    router.push(`/${newLocale}${cleanPath}`);
  };

  const isThai = locale.startsWith('th');

  return (
    <PageWrapper>
      {/* Top Header with Back Navigation */}
      <header className="mb-6">
        <Link
          href={`/${locale}/liff`}
          className="inline-flex items-center gap-1.5 text-senior-base text-senior-muted hover:text-senior-text min-h-touch py-2 font-medium focus:outline-none focus:ring-2 focus:ring-line-green rounded-md mb-1"
          aria-label={t('back')}
        >
          <span aria-hidden="true">←</span>
          <span>{t('back')}</span>
        </Link>
        <h1 className="text-senior-2xl font-bold text-senior-text">⚙️ {t('settings')}</h1>
      </header>

      <div className="space-y-4">
        {/* Profile Card */}
        <section aria-labelledby="profile-heading">
          <Card>
            <h2 id="profile-heading" className="text-senior-lg font-bold text-senior-text mb-4">
              👤 {t('profile')}
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-senior-sm text-senior-muted">{t('name')}</p>
                <p className="text-senior-base font-semibold text-senior-text break-words">
                  {displayName || '—'}
                </p>
              </div>
              <div className="pt-2 border-t border-gray-100">
                <p className="text-senior-sm text-senior-muted">{t('userId')}</p>
                <p className="text-senior-sm font-mono text-senior-muted break-all">
                  {userId || '—'}
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* Language Switcher Card */}
        <section aria-labelledby="language-heading">
          <Card>
            <h2 id="language-heading" className="text-senior-lg font-bold text-senior-text mb-3">
              🌐 {t('language')}
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={isThai ? 'primary' : 'secondary'}
                onClick={() => switchLanguage('th')}
                aria-pressed={isThai}
                className="w-full text-senior-base justify-center py-3"
              >
                {t('thai')}
              </Button>
              <Button
                type="button"
                variant={!isThai ? 'primary' : 'secondary'}
                onClick={() => switchLanguage('en')}
                aria-pressed={!isThai}
                className="w-full text-senior-base justify-center py-3"
              >
                {t('english')}
              </Button>
            </div>
          </Card>
        </section>

        {/* App Info Card */}
        <section aria-labelledby="app-info-heading">
          <Card>
            <h2 id="app-info-heading" className="text-senior-lg font-bold text-senior-text mb-3">
              📱 {t('appInfo')}
            </h2>
            <p className="text-senior-base text-senior-text mb-3">{t('appDescription')}</p>
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-line-green rounded-full text-senior-sm font-semibold">
                <span aria-hidden="true">🎙️</span>
                <span>{t('voiceAssistantBadge')}</span>
              </span>
              <span className="text-senior-sm text-senior-muted font-medium ml-auto">
                {t('version')} 1.24.0
              </span>
            </div>
          </Card>
        </section>
      </div>
    </PageWrapper>
  );
}
