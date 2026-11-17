'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { PlanSheetModal } from '@/components/activities/PlanSheetModal';
import { ConfirmationModal } from '@/components/activities/ConfirmationModal';
import { FeedbackModal } from '@/components/activities/FeedbackModal';
import { Toast } from '@/components/ui/Toast';
import { MOCK_PLACES } from '@/lib/mock/activities';

export default function PlaceDetailPage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const placeId = (params?.id as string) || 'rom-sai';

  const place = useMemo(() => {
    return MOCK_PLACES[placeId] || MOCK_PLACES['rom-sai'];
  }, [placeId]);

  // Modal and Interactive states
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isPlanSheetOpen, setIsPlanSheetOpen] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Saved plan state
  const [savedPlan, setSavedPlan] = useState<{
    placeName: string;
    dayText: string;
    timeText: string;
    reminderEnabled: boolean;
    familyInvited: boolean;
  }>({
    placeName: place.name,
    dayText: 'วันนี้',
    timeText: '16:30 น.',
    reminderEnabled: true,
    familyInvited: false,
  });

  const handleToggleWishlist = () => {
    const next = !isWishlisted;
    setIsWishlisted(next);
    setToastMessage(next ? 'เพิ่มลงใน “ที่อยากไป” แล้วค่ะ' : 'นำออกจาก “ที่อยากไป” แล้วค่ะ');
  };

  const handlePlanSaved = (plan: typeof savedPlan) => {
    setSavedPlan(plan);
    setIsPlanSheetOpen(false);
    setIsConfirmationOpen(true);
  };

  const handleFeedbackReason = (reason: string) => {
    setIsFeedbackOpen(false);
    setToastMessage(`บันทึกแล้วค่ะ: ${reason}`);
  };

  return (
    <div className="min-h-screen bg-[#F2F7FA] text-[#21215C] pb-28">
      {/* Hero Image with Back Button Overlay */}
      <div className="relative w-full h-[240px] bg-[#EAF0F6]">
        <Image
          src={place.heroImageUrl || place.imageUrl}
          alt={place.name}
          fill
          priority
          sizes="(max-width: 440px) 100vw, 440px"
          className="object-cover"
          unoptimized
        />
        {/* Floating Back Button */}
        <Link
          href={`/${locale}/liff/activities/category/${place.categoryId}`}
          className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-xs text-[#21215C] font-bold text-sm px-3.5 py-2 rounded-full shadow-md flex items-center gap-1 active:scale-95 transition-all"
        >
          <span>‹</span>
          <span>กลับ</span>
        </Link>
      </div>

      <main className="px-5 -mt-6 relative z-10 max-w-[440px] mx-auto space-y-6">
        {/* Main Place Info Card */}
        <div className="bg-white rounded-3xl p-5 shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)] space-y-4">
          {/* Header Row: Tag & Wishlist Button */}
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#E2F5E9] text-[#2D6A4F]">
              {place.tag}
            </span>

            <button
              type="button"
              onClick={handleToggleWishlist}
              className={`h-[40px] px-3.5 rounded-full font-bold text-sm flex items-center gap-1.5 border transition-all active:scale-95 ${
                isWishlisted
                  ? 'bg-[#FDE5F0] border-[#B4225A] text-[#B4225A]'
                  : 'bg-white border-[#7D84A3] text-[#7D84A3] hover:border-[#21215C] hover:text-[#21215C]'
              }`}
            >
              <span>{isWishlisted ? '❤️' : '♡'}</span>
              <span>{isWishlisted ? 'อยากไปแล้ว' : 'อยากไป'}</span>
            </button>
          </div>

          {/* Place Title */}
          <h1 className="text-3xl font-extrabold text-[#21215C] tracking-tight leading-tight">
            {place.name}
          </h1>

          {/* 4 Stat Boxes (2x2 grid) */}
          <div className="grid grid-cols-2 gap-2.5 bg-[#F0F4F9] p-3.5 rounded-2xl">
            {/* Box 1: Distance & Time */}
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">
                📍
              </span>
              <div>
                <p className="text-sm font-bold text-[#21215C]">{place.distanceText}</p>
                <p className="text-xs text-[#4B4F72] font-medium">{place.walkTimeText}</p>
              </div>
            </div>

            {/* Box 2: Opening Hours */}
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#10B981] shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-[#21215C]">
                  {place.isOpen ? 'เปิดอยู่' : 'ปิดอยู่'}
                </p>
                <p className="text-xs text-[#4B4F72] font-medium">ถึง 20:00 น.</p>
              </div>
            </div>

            {/* Box 3: Price */}
            <div className="flex items-center gap-2 pt-1 border-t border-white/60">
              <span className="text-lg" aria-hidden="true">
                💰
              </span>
              <div>
                <p className="text-sm font-bold text-[#21215C]">ฟรี</p>
                <p className="text-xs text-[#4B4F72] font-medium">ค่าใช้จ่าย</p>
              </div>
            </div>

            {/* Box 4: Terrain */}
            <div className="flex items-center gap-2 pt-1 border-t border-white/60">
              <span className="text-lg" aria-hidden="true">
                🚶
              </span>
              <div>
                <p className="text-sm font-bold text-[#21215C]">เบา</p>
                <p className="text-xs text-[#4B4F72] font-medium">ทางเรียบ</p>
              </div>
            </div>
          </div>

          {/* Why Recommended Quote Box */}
          <div className="bg-[#E1E8F8] rounded-2xl p-4 text-[#21215C] space-y-1.5">
            <h2 className="text-xs font-bold text-[#385289] uppercase tracking-wider">
              {place.whyRecommended.title}
            </h2>
            <p className="text-sm sm:text-base leading-relaxed font-medium">
              {place.whyRecommended.body}
            </p>
            {place.whyRecommended.historyNote && (
              <p className="text-xs sm:text-sm text-[#385289] font-medium pt-1">
                {place.whyRecommended.historyNote}
              </p>
            )}
          </div>
        </div>

        {/* Section: กิจกรรมที่นี่ */}
        <div className="bg-white rounded-3xl p-5 shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)] space-y-3">
          <h2 className="text-xl font-extrabold text-[#21215C]">กิจกรรมที่นี่</h2>
          <div className="divide-y divide-[#F2F7FA]">
            {place.activities.map((act, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between">
                <span className="font-bold text-senior-base text-[#21215C]">{act.title}</span>
                <span className="text-sm font-semibold text-[#7D84A3]">{act.schedule}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section: สะดวกสำหรับผู้สูงอายุ */}
        <div className="bg-white rounded-3xl p-5 shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)] space-y-3">
          <h2 className="text-xl font-extrabold text-[#21215C]">สะดวกสำหรับผู้สูงอายุ</h2>
          <div className="grid grid-cols-2 gap-3">
            {place.facilities.map((fac, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 text-senior-base font-bold text-[#21215C]"
              >
                <span className="text-[#10B981]">✓</span>
                <span>{fac}</span>
              </div>
            ))}
          </div>
          {place.disclaimer && (
            <p className="text-xs text-[#7D84A3] font-medium pt-2 border-t border-[#F2F7FA]">
              {place.disclaimer}
            </p>
          )}
        </div>

        {/* Section: การเดินทาง */}
        <div className="bg-white rounded-3xl p-5 shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)] space-y-3">
          <h2 className="text-xl font-extrabold text-[#21215C]">การเดินทาง</h2>

          {/* Map Graphic Illustration */}
          <div className="relative w-full h-[100px] bg-[#EAF0F6] rounded-2xl flex items-center justify-center overflow-hidden border border-[#E1E8F8]">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 300 100"
              fill="none"
              className="absolute inset-0"
            >
              {/* Road blocks */}
              <rect x="10" y="10" width="80" height="35" rx="6" fill="#F2F7FA" />
              <rect x="110" y="10" width="80" height="35" rx="6" fill="#F2F7FA" />
              <rect x="210" y="10" width="80" height="35" rx="6" fill="#F2F7FA" />
              <rect x="10" y="55" width="80" height="35" rx="6" fill="#F2F7FA" />
              <rect x="110" y="55" width="80" height="35" rx="6" fill="#F2F7FA" />
              <rect x="210" y="55" width="80" height="35" rx="6" fill="#F2F7FA" />
              {/* Route line */}
              <path
                d="M 50 72 C 100 70, 150 30, 250 28"
                stroke="#3E81F7"
                strokeWidth="3.5"
                strokeDasharray="6 6"
                strokeLinecap="round"
              />
              <circle cx="50" cy="72" r="5" fill="#21215C" />
              <circle cx="250" cy="28" r="6" fill="#EF4444" />
            </svg>
          </div>

          <p className="text-sm font-semibold text-[#4B4F72]">
            จากบ้าน {place.navigation.distanceText} • {place.navigation.walkTimeText}
          </p>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setToastMessage('กำลังเปิดแผนที่นำทาง...')}
              className="h-[48px] rounded-2xl bg-white border-2 border-[#7D84A3] text-[#21215C] font-bold text-base active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#3E81F7]"
            >
              ดูทาง
            </button>
            <button
              type="button"
              onClick={() => setToastMessage('ส่งข้อความชวนลูกหลานในแชตแล้วค่ะ')}
              className="h-[48px] rounded-2xl bg-white border-2 border-[#7D84A3] text-[#21215C] font-bold text-base active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-[#3E81F7]"
            >
              ให้ลูกหลานพาไป
            </button>
          </div>
        </div>

        {/* Section: ที่ใกล้ๆ และที่คล้ายกัน */}
        <div className="bg-white rounded-3xl p-5 shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)] space-y-3">
          <h2 className="text-xl font-extrabold text-[#21215C]">ที่ใกล้ๆ และที่คล้ายกัน</h2>

          <div className="space-y-2.5">
            {place.nearbyPlaces.map((near) => (
              <div
                key={near.id}
                className="flex items-center gap-3 p-3 rounded-2xl bg-[#F2F7FA] border border-[#EAF0F6]"
              >
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-xl shrink-0 shadow-xs">
                  {near.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base text-[#21215C] leading-snug">{near.name}</p>
                  <p className="text-xs text-[#7D84A3] font-medium">{near.description}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => router.push(`/${locale}/liff/activities/category/${place.categoryId}`)}
            className="w-full h-[48px] rounded-2xl bg-white border-2 border-[#7D84A3] text-[#21215C] font-bold text-base active:scale-98 transition-all focus:outline-none focus:ring-2 focus:ring-[#3E81F7]"
          >
            ดูทั้งหมด
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              className="text-xs sm:text-sm text-[#7D84A3] underline hover:text-[#21215C] font-medium"
            >
              อยากทำอย่างอื่น หรือไม่ค่อยชอบที่อย่างนี้
            </button>
          </div>
        </div>
      </main>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#EAF0F6] p-4">
        <div className="max-w-[440px] mx-auto grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setIsFeedbackOpen(true)}
            className="h-[52px] rounded-2xl bg-white border-2 border-[#7D84A3] text-[#21215C] font-bold text-base active:scale-98 transition-all focus:outline-none focus:ring-2 focus:ring-[#21215C]"
          >
            ไม่สนใจ
          </button>
          <button
            type="button"
            onClick={() => setIsPlanSheetOpen(true)}
            className="h-[52px] rounded-2xl bg-[#3E81F7] text-white font-bold text-base flex items-center justify-center gap-1.5 active:scale-98 hover:bg-[#2F6CD9] transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3E81F7]"
          >
            <span>📍</span>
            <span>ไปที่นี่</span>
          </button>
        </div>
      </div>

      {/* Screen L4: Plan It Sheet Modal */}
      <PlanSheetModal
        isOpen={isPlanSheetOpen}
        placeName={place.name}
        onClose={() => setIsPlanSheetOpen(false)}
        onSavePlan={handlePlanSaved}
      />

      {/* Screen L5: Saved Confirmation Modal */}
      <ConfirmationModal
        isOpen={isConfirmationOpen}
        placeName={savedPlan.placeName}
        dayText={savedPlan.dayText}
        timeText={savedPlan.timeText}
        reminderEnabled={savedPlan.reminderEnabled}
        familyInvited={savedPlan.familyInvited}
        onViewPlans={() => {
          setIsConfirmationOpen(false);
          router.push(`/${locale}/liff/activities/plans`);
        }}
        onReturnHome={() => {
          setIsConfirmationOpen(false);
          router.push(`/${locale}/liff`);
        }}
      />

      {/* Screen L6: Change or Snooze Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        placeName={place.name}
        onSelectReason={handleFeedbackReason}
        onClose={() => setIsFeedbackOpen(false)}
      />

      {/* Toast Notification */}
      <Toast
        isOpen={toastMessage !== null}
        message={toastMessage || ''}
        onClose={() => setToastMessage(null)}
      />
    </div>
  );
}
