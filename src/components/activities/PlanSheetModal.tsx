'use client';

import { useState } from 'react';
import { TimePickerModal } from '@/components/activities/TimePickerModal';

export interface PlanSheetModalProps {
  isOpen: boolean;
  placeName: string;
  onClose: () => void;
  onSavePlan: (plan: {
    placeName: string;
    dayText: string;
    timeText: string;
    reminderEnabled: boolean;
    familyInvited: boolean;
  }) => void;
}

export function PlanSheetModal({ isOpen, placeName, onClose, onSavePlan }: PlanSheetModalProps) {
  const [selectedDay, setSelectedDay] = useState<'วันนี้' | 'พรุ่งนี้' | 'วันอื่น'>('วันนี้');
  const [selectedTime, setSelectedTime] = useState<string>('16:30 น.');
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [familyInvited, setFamilyInvited] = useState(false);

  if (!isOpen) return null;

  const standardTimes = ['16:00 น.', '16:30 น.', '17:00 น.'];
  const isCustomTime = !standardTimes.includes(selectedTime);

  const handleTimeConfirm = (customTime: string) => {
    setSelectedTime(customTime);
  };

  const handleSave = () => {
    onSavePlan({
      placeName,
      dayText: selectedDay,
      timeText: selectedTime,
      reminderEnabled,
      familyInvited,
    });
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-sheet-title"
        className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-[#21215C]/40 backdrop-blur-xs animate-in fade-in"
      >
        <div className="w-full max-w-[440px] bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-5 animate-in slide-in-from-bottom duration-200 max-h-[90vh] overflow-y-auto">
          {/* Sheet Handle */}
          <div
            className="w-12 h-1.5 rounded-full bg-[#CBD5E1] mx-auto -mt-1 mb-2"
            aria-hidden="true"
          />

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 id="plan-sheet-title" className="text-2xl font-extrabold text-[#21215C]">
                จะไปเดินเล่นตอนไหนดีคะ
              </h2>
              <p className="text-senior-base font-semibold text-[#4B4F72] mt-0.5">{placeName}</p>
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

          {/* Section: วัน */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-[#7D84A3]">วัน</label>
            <div className="grid grid-cols-3 gap-2">
              {(['วันนี้', 'พรุ่งนี้', 'วันอื่น'] as const).map((day) => {
                const isSelected = selectedDay === day;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`h-[48px] rounded-2xl font-bold text-base transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#3E81F7] ${
                      isSelected
                        ? 'bg-[#E1E8F8] border-2 border-[#3E81F7] text-[#21215C]'
                        : 'bg-white border-2 border-[#EAF0F6] text-[#4B4F72] hover:border-[#CBD5E1]'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: เวลา */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-[#7D84A3]">เวลา</label>
            <div className="grid grid-cols-2 gap-2">
              {standardTimes.map((time) => {
                const isSelected = selectedTime === time;
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setSelectedTime(time)}
                    className={`h-[48px] rounded-2xl font-bold text-base flex items-center justify-center gap-1.5 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#3E81F7] ${
                      isSelected
                        ? 'bg-[#E1E8F8] border-2 border-[#3E81F7] text-[#21215C]'
                        : 'bg-white border-2 border-[#EAF0F6] text-[#4B4F72] hover:border-[#CBD5E1]'
                    }`}
                  >
                    {isSelected && <span>✓</span>}
                    <span>{time}</span>
                  </button>
                );
              })}

              {/* เวลาอื่น */}
              <button
                type="button"
                onClick={() => setIsTimePickerOpen(true)}
                className={`h-[48px] rounded-2xl font-bold text-base flex items-center justify-center gap-1.5 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#3E81F7] ${
                  isCustomTime
                    ? 'bg-[#E1E8F8] border-2 border-[#3E81F7] text-[#21215C]'
                    : 'bg-white border-2 border-[#EAF0F6] text-[#4B4F72] hover:border-[#CBD5E1]'
                }`}
              >
                {isCustomTime && <span>✓</span>}
                <span>{isCustomTime ? selectedTime : 'เวลาอื่น'}</span>
              </button>
            </div>
          </div>

          {/* Reminder Toggle */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-base font-bold text-[#21215C]">เตือนในแชตเมื่อถึงเวลา</p>
              <p className="text-xs text-[#7D84A3] font-medium">ส่งข้อความเตือน 1 ครั้ง</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={reminderEnabled}
              onClick={() => setReminderEnabled(!reminderEnabled)}
              className={`w-14 h-8 rounded-full p-1 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#3E81F7] ${
                reminderEnabled ? 'bg-[#3E81F7]' : 'bg-[#CBD5E1]'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                  reminderEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Invite Family Button (Pink Card) */}
          <button
            type="button"
            onClick={() => setFamilyInvited(!familyInvited)}
            className={`w-full h-[52px] rounded-2xl px-4 flex items-center justify-between transition-all active:scale-98 border focus:outline-none focus:ring-2 focus:ring-[#B4225A] ${
              familyInvited
                ? 'bg-[#FDE5F0] border-[#B4225A] text-[#B4225A]'
                : 'bg-[#FDE5F0]/70 border-transparent text-[#B4225A] hover:bg-[#FDE5F0]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden="true">
                👥
              </span>
              <span className="font-bold text-base">
                {familyInvited ? 'ชวนครอบครัวไปด้วยแล้ว ✓' : 'ชวนครอบครัวไปด้วย'}
              </span>
            </div>
            <span className="text-[#B4225A] font-bold text-lg">›</span>
          </button>

          {/* CTA Submit Button */}
          <button
            type="button"
            onClick={handleSave}
            className="w-full h-[54px] rounded-2xl bg-[#3E81F7] text-white font-bold text-lg active:scale-98 hover:bg-[#2F6CD9] transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3E81F7]"
          >
            ตั้งแผนนี้
          </button>
        </div>
      </div>

      {/* Embedded Time Picker for "เวลาอื่น" */}
      <TimePickerModal
        isOpen={isTimePickerOpen}
        initialTime={selectedTime}
        placeName={placeName}
        dayText={selectedDay}
        onConfirm={handleTimeConfirm}
        onClose={() => setIsTimePickerOpen(false)}
      />
    </>
  );
}
