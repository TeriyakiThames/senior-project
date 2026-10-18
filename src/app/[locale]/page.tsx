import { useTranslations } from 'next-intl';
import { PageWrapper } from '@/components/layout/PageWrapper';
import { Loading } from '@/components/ui/Loading';

export default function LocaleHomePage() {
  const t = useTranslations('dashboard');

  return (
    <PageWrapper className="flex flex-col items-center justify-center text-center">
      <h1 className="text-senior-2xl font-bold text-senior-text mb-4">{t('todaySchedule')}</h1>
      <Loading message={t('loading')} />
    </PageWrapper>
  );
}
