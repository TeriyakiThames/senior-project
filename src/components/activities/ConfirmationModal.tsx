'use client';

import { useState } from 'react';

export interface ConfirmationModalProps {
  isOpen: boolean;
  placeName: string;
  dayText: string;
  timeText: string;
  reminderEnabled?: boolean;
  familyInvited?: boolean;
  onViewPlans: () => void;
  onReturnHome: () => void;
}

export function ConfirmationModal({
  isOpen,
  placeName,
  dayText,
  timeText,
  reminderEnabled = true,
  familyInvited: initialFamilyInvited = false,
  onViewPlans,
  onReturnHome,
}: ConfirmationModalProps) {
  const [familyInvited, setFamilyInvited] = useState(initialFamilyInvited);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#21215C]/40 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-[380px] bg-[#F2F7FA] rounded-3xl p-6 shadow-2xl space-y-6 text-center animate-in zoom-in-95 duration-150">
        {/* Large Green Check Circle Badge */}
        <div className="w-16 h-16 rounded-full bg-[#10B981] text-white flex items-center justify-center mx-auto shadow-md">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        {/* Title */}
        <h2 id="confirmation-title" className="text-3xl font-extrabold text-[#21215C]">
          ตั้งแผนแล้วค่ะ
        </h2>

        {/* Summary Card */}
        <div className="bg-white rounded-3xl p-5 text-left shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)] space-y-3">
          <div className="flex items-center gap-2.5 text-[#21215C] font-bold text-base sm:text-lg">
            <span className="text-[#3E81F7] shrink-0" aria-hidden="true">
              📍
            </span>
            <span>เดินเล่นที่{placeName}</span>
          </div>

          <div className="flex items-center gap-2.5 text-[#21215C] font-semibold text-base">
            <span className="text-[#FCCE57] shrink-0" aria-hidden="true">
              🕒
            </span>
            <span>
              {dayText} {timeText}
            </span>
          </div>

          {reminderEnabled && (
            <div className="flex items-start gap-2.5 text-sm text-[#4B4F72] pt-1 border-t border-[#F2F7FA]">
              <span className="text-[#3E81F7] shrink-0 mt-0.5" aria-hidden="true">
                🔔
              </span>
              <span>จะทักไปเตือนในแชตตอน {timeText}</span>
            </div>
          )}
        </div>

        {/* Action Stack */}
        <div className="space-y-3 pt-2">
          {/* ชวนครอบครัวไปด้วย */}
          <button
            type="button"
            onClick={() => setFamilyInvited(!familyInvited)}
            className="w-full h-[52px] rounded-2xl bg-[#FDE5F0] text-[#B4225A] font-bold text-base flex items-center justify-center gap-2 active:scale-98 transition-all focus:outline-none focus:ring-2 focus:ring-[#B4225A]"
          >
            <span aria-hidden="true">👥</span>
            <span>{familyInvited ? 'ชวนครอบครัวแล้วค่ะ ✓' : 'ชวนครอบครัวไปด้วย'}</span>
          </button>

          {/* ดูแผนของฉัน */}
          <button
            type="button"
            onClick={onViewPlans}
            className="w-full h-[52px] rounded-2xl bg-white border-2 border-[#7D84A3] text-[#21215C] font-bold text-base active:scale-98 hover:bg-[#F0F4F9] transition-all focus:outline-none focus:ring-2 focus:ring-[#21215C]"
          >
            ดูแผนของฉัน
          </button>

          {/* กลับไปที่แชต */}
          <button
            type="button"
            onClick={onReturnHome}
            className="w-full h-[54px] rounded-2xl bg-[#3E81F7] text-white font-bold text-lg active:scale-98 hover:bg-[#2F6CD9] transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3E81F7]"
          >
            กลับไปที่แชต
          </button>
        </div>
      </div>
    </div>
  );
}
