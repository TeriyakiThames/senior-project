import { useTranslations } from 'next-intl';

export default function LocaleHomePage() {
  const t = useTranslations('dashboard');

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-senior-2xl font-bold text-senior-text mb-4">{t('todaySchedule')}</h1>
      <p className="text-senior-base text-senior-muted">{t('loading')}</p>
    </main>
  );
}
