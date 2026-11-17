'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useLiff } from '@/components/liff/LiffProvider';
import { CategoryCard } from '@/components/activities/CategoryCard';
import { MOCK_CATEGORIES, MOCK_HERO_RECOMMENDATION } from '@/lib/mock/activities';

export default function ActivitiesTodayHubPage() {
  const locale = useLocale();
  const { displayName } = useLiff();

  const userGreetingName = displayName ? displayName : 'คุณตา';

  return (
    <div className="min-h-screen bg-[#F2F7FA] text-[#21215C]">
      <main className="px-5 pt-4 pb-12 max-w-[440px] mx-auto space-y-5">
        {/* Header: Back navigation, Date and Weather */}
        <section>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/${locale}/liff`}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center text-[#21215C] hover:opacity-75 active:scale-95 transition-all -ml-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#21215C]"
              aria-label="กลับหน้าหลัก"
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
            <p className="text-sm font-medium text-[#4B4F72]">วันพฤหัสบดี 22 ต.ค. • แดดอ่อน 31°</p>
          </div>
          <h1 className="text-3xl font-extrabold text-[#21215C] tracking-tight">
            สวัสดีค่ะ คุณ{userGreetingName}
          </h1>
        </section>

        {/* Hero Recommended Today Card */}
        <section aria-labelledby="today-recommendation-heading">
          <div className="bg-white rounded-3xl p-5 shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)] space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#E1E8F8] flex items-center justify-center text-2xl shrink-0">
                🚶
              </div>
              <div className="flex-1 min-w-0">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FCCE57] text-[#7A4E00]">
                  {MOCK_HERO_RECOMMENDATION.badge}
                </span>
                <h2
                  id="today-recommendation-heading"
                  className="text-xl font-extrabold text-[#21215C] mt-1 leading-snug"
                >
                  {MOCK_HERO_RECOMMENDATION.title}
                </h2>
                <p className="text-sm font-semibold text-[#4B4F72] mt-0.5">
                  {MOCK_HERO_RECOMMENDATION.timeText} • {MOCK_HERO_RECOMMENDATION.distanceText}{' '}
                  {MOCK_HERO_RECOMMENDATION.walkTimeText}
                </p>
              </div>
            </div>

            {/* Why Quote Box */}
            <div className="bg-[#F0F4F9] rounded-2xl p-3.5 text-sm sm:text-base text-[#21215C] leading-relaxed">
              {MOCK_HERO_RECOMMENDATION.reasonQuote}
            </div>

            {/* View Details Action */}
            <Link
              href={`/${locale}/liff/activities/place/${MOCK_HERO_RECOMMENDATION.placeId}`}
              className="w-full h-[50px] rounded-2xl bg-[#3E81F7] text-white font-bold text-base flex items-center justify-center gap-1.5 active:scale-98 hover:bg-[#2F6CD9] transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3E81F7]"
            >
              <span>ดูรายละเอียด</span>
              <span className="text-lg">›</span>
            </Link>
          </div>
        </section>

        {/* Section: "อยากทำอะไรดีคะ" */}
        <section aria-labelledby="categories-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="categories-heading" className="text-2xl font-extrabold text-[#21215C]">
              อยากทำอะไรดีคะ
            </h2>
            <Link
              href={`/${locale}/liff/activities/plans`}
              className="text-sm font-bold text-[#3E81F7] hover:underline"
            >
              ดูแผนของฉัน ›
            </Link>
          </div>

          {/* 2x3 Grid */}
          <div className="grid grid-cols-2 gap-3">
            {MOCK_CATEGORIES.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                href={`/${locale}/liff/activities/category/${category.id}`}
              />
            ))}
          </div>
        </section>

        {/* My Plans Quick Banner */}
        <section className="pt-2">
          <Link
            href={`/${locale}/liff/activities/plans`}
            className="w-full bg-[#FDE5F0] rounded-3xl p-4 flex items-center justify-between active:scale-98 transition-all border border-[#FDE5F0] hover:border-[#B4225A]"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">
                🗓️
              </span>
              <div>
                <p className="text-[#B4225A] font-bold text-base sm:text-lg">แผนของฉัน</p>
                <p className="text-[#B4225A]/80 text-xs sm:text-sm font-medium">
                  มี 2 แผนที่กำลังจะไป
                </p>
              </div>
            </div>
            <span className="text-[#B4225A] text-xl font-bold">›</span>
          </Link>
        </section>
      </main>
    </div>
  );
}
