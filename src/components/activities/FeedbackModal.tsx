'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';

export interface FeedbackModalProps {
  isOpen: boolean;
  placeName?: string;
  onSelectReason: (reason: string) => void;
  onClose: () => void;
}

export function FeedbackModal({ isOpen, onSelectReason, onClose }: FeedbackModalProps) {
  const locale = useLocale();

  if (!isOpen) return null;

  const reasons = [
    {
      id: 'seating',
      label: 'อยากได้ ที่มีที่นั่งพัก',
      icon: '💺',
      bgColor: 'bg-[#E1E8F8]',
    },
    {
      id: 'friends',
      label: 'มีเพื่อนทำด้วย',
      icon: '👥',
      bgColor: 'bg-[#FDE5F0]',
    },
    {
      id: 'indoor',
      label: 'ทำในบ้าน',
      icon: '🏠',
      bgColor: 'bg-[#EEE1FA]',
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-[#21215C]/40 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-[440px] bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-5 animate-in slide-in-from-bottom duration-200">
        {/* Handle Bar */}
        <div
          className="w-12 h-1.5 rounded-full bg-[#CBD5E1] mx-auto -mt-1 mb-2"
          aria-hidden="true"
        />

        {/* Title & Subtitle */}
        <div>
          <h2 id="feedback-title" className="text-2xl font-extrabold text-[#21215C]">
            อยากให้ทำยังไงดีคะ
          </h2>
          <p className="text-senior-base text-[#7D84A3] font-medium mt-1">บอกเหตุผลได้ค่ะ</p>
        </div>

        {/* Reason Buttons */}
        <div className="space-y-2.5">
          {reasons.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectReason(item.label)}
              className="w-full h-[54px] rounded-2xl bg-white border border-[#EAF0F6] px-4 flex items-center justify-between hover:bg-[#F2F7FA] active:scale-98 transition-all focus:outline-none focus:ring-2 focus:ring-[#3E81F7]"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl ${item.bgColor} flex items-center justify-center text-lg`}
                >
                  {item.icon}
                </div>
                <span className="font-bold text-senior-base text-[#21215C]">{item.label}</span>
              </div>
              <span className="text-[#7D84A3] text-xl font-bold">›</span>
            </button>
          ))}

          <div className="pt-2 border-t border-[#F2F7FA]" />

          {/* Dismiss Category Option */}
          <div className="rounded-2xl bg-white border border-[#EAF0F6] p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#F2F7FA] flex items-center justify-center text-lg shrink-0 mt-0.5">
              🚫
            </div>
            <div className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => onSelectReason('ไม่ต้องชวนเรื่องเดินเล่นอีก')}
                className="text-left font-bold text-senior-base text-[#21215C] hover:text-[#942626] transition-colors focus:outline-none"
              >
                ไม่ต้องชวนเรื่องเดินเล่นอีก
              </button>
              <p className="text-xs sm:text-sm text-[#7D84A3] mt-1 font-medium">
                เปลี่ยนใจได้ที่{' '}
                <Link
                  href={`/${locale}/liff/settings`}
                  className="text-[#3E81F7] underline font-bold hover:text-[#21215C]"
                >
                  ตั้งค่า
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full h-[52px] rounded-2xl bg-white border-2 border-[#7D84A3] text-[#21215C] font-bold text-base active:scale-98 hover:bg-[#F0F4F9] transition-all focus:outline-none focus:ring-2 focus:ring-[#21215C]"
        >
          ปิด
        </button>
      </div>
    </div>
  );
}
