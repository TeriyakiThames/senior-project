'use client';

import { useState } from 'react';

export interface TimePickerModalProps {
  isOpen: boolean;
  initialTime?: string;
  placeName?: string;
  dayText?: string;
  onConfirm: (selectedTime: string) => void;
  onClose: () => void;
}

export function TimePickerModal({
  isOpen,
  initialTime = '17:30 น.',
  placeName = 'สวนชุมชนร่มไทร',
  dayText = 'วันนี้',
  onConfirm,
  onClose,
}: TimePickerModalProps) {
  // Parse initial hours and minutes from "HH:MM" or "HH:MM น."
  const [totalMinutes, setTotalMinutes] = useState(() => {
    const clean = initialTime.replace(/[^0-9:]/g, '');
    const [hhStr, mmStr] = clean.split(':');
    const hh = parseInt(hhStr || '17', 10);
    const mm = parseInt(mmStr || '30', 10);
    return hh * 60 + mm;
  });

  if (!isOpen) return null;

  const handleAdjustMinutes = (delta: number) => {
    setTotalMinutes((prev) => {
      let next = prev + delta;
      if (next < 0) next += 24 * 60;
      if (next >= 24 * 60) next -= 24 * 60;
      return next;
    });
  };

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} น.`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="timepicker-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#21215C]/40 backdrop-blur-xs animate-in fade-in"
    >
      <div className="w-full max-w-[360px] bg-white rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Top Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 id="timepicker-title" className="text-2xl font-extrabold text-[#21215C]">
              จะไปกี่โมงดีคะ
            </h2>
            <p className="text-sm font-medium text-[#7D84A3] mt-1">
              เดินเล่นที่{placeName} • {dayText}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-[#7D84A3] hover:text-[#21215C] rounded-full active:scale-95 transition-all"
            aria-label="ปิด"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Big Time Display Card */}
        <div className="bg-[#F2F7FA] rounded-3xl p-6 text-center border border-[#E1E8F8]">
          <div className="text-5xl font-extrabold text-[#21215C] tracking-tight">
            {formattedTime}
          </div>

          {/* Stepper Buttons (-30 min / +30 min) */}
          <div className="grid grid-cols-2 gap-3 mt-6">
            <button
              type="button"
              onClick={() => handleAdjustMinutes(-30)}
              className="h-[52px] rounded-2xl bg-white border-2 border-[#7D84A3] text-[#21215C] font-bold text-base flex items-center justify-center gap-1.5 active:scale-95 hover:bg-[#F0F4F9] transition-all focus:outline-none focus:ring-2 focus:ring-[#3E81F7]"
            >
              <span>—</span>
              <span>30 นาที</span>
            </button>
            <button
              type="button"
              onClick={() => handleAdjustMinutes(30)}
              className="h-[52px] rounded-2xl bg-white border-2 border-[#7D84A3] text-[#21215C] font-bold text-base flex items-center justify-center gap-1.5 active:scale-95 hover:bg-[#F0F4F9] transition-all focus:outline-none focus:ring-2 focus:ring-[#3E81F7]"
            >
              <span>+</span>
              <span>30 นาที</span>
            </button>
          </div>

          <p className="text-xs text-[#7D84A3] font-medium mt-3">กดเพื่อเลื่อนครั้งละ 30 นาที</p>
        </div>

        {/* CTA Button */}
        <button
          type="button"
          onClick={() => {
            onConfirm(formattedTime);
            onClose();
          }}
          className="w-full h-[54px] rounded-2xl bg-[#3E81F7] text-white font-bold text-lg active:scale-98 hover:bg-[#2F6CD9] transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3E81F7]"
        >
          ตั้งเวลานี้
        </button>
      </div>
    </div>
  );
}
