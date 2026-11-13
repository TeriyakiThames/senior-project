'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export interface RepeatCapSliderProps {
  value: number;
  onChange: (newValue: number) => void;
  disabled?: boolean;
  isSaving?: boolean;
}

export function RepeatCapSlider({ value, onChange, disabled = false }: RepeatCapSliderProps) {
  const t = useTranslations('dashboard');

  const handleDecrement = () => {
    if (value > 1 && !disabled) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < 12 && !disabled) {
      onChange(value + 1);
    }
  };

  const totalMinutes = value * 5;

  return (
    <div className="space-y-3 select-none">
      {/* Counter Stepper with rigid fixed columns to prevent any UI movement */}
      <div className="grid grid-cols-[56px_1fr_56px] items-center bg-[#F2F7FA] p-3 rounded-2xl h-20">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= 1}
          aria-label="ลดจำนวนครั้ง"
          className="w-14 h-14 rounded-2xl bg-white text-[#21215C] font-extrabold text-2xl border-2 border-[#7D84A3]/30 flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none hover:border-[#21215C] focus:outline-none focus:ring-2 focus:ring-[#21215C]"
        >
          −
        </button>

        {/* Center fixed-width number & unit container with tabular numerals */}
        <div className="flex flex-col items-center justify-center text-center overflow-hidden">
          <div className="flex items-baseline justify-center gap-1.5 tabular-nums">
            <span className="text-4xl font-black text-[#21215C] tabular-nums tracking-tight min-w-[2.5rem] text-right">
              {value}
            </span>
            <span className="text-xl font-bold text-[#4B4F72] text-left">
              {t('repeatTimesUnit')}
            </span>
          </div>
          <p className="text-sm font-medium text-[#7D84A3] mt-0.5 tabular-nums">
            ({totalMinutes} {t('repeatMinutesUnit')})
          </p>
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || value >= 12}
          aria-label="เพิ่มจำนวนครั้ง"
          className="w-14 h-14 rounded-2xl bg-white text-[#21215C] font-extrabold text-2xl border-2 border-[#7D84A3]/30 flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none hover:border-[#21215C] focus:outline-none focus:ring-2 focus:ring-[#21215C]"
        >
          +
        </button>
      </div>

      {/* Explanation Banner with fixed min-height to guarantee zero layout shift */}
      <div className="rounded-2xl bg-[#FBEFD8] p-4 border border-[#FCCE57]/40 flex items-start gap-3 min-h-[116px]">
        <span className="text-2xl flex-shrink-0" aria-hidden="true">
          ⏱️
        </span>
        <div className="space-y-1 flex-1">
          <p className="text-sm font-bold text-[#7A4E00] tabular-nums">
            {t('repeatTotalSummary', { count: value, minutes: totalMinutes })}
          </p>
          <p className="text-xs sm:text-sm text-[#7A4E00]/90 leading-relaxed">
            {t('repeatAutoDismissDesc', { count: value })}
          </p>
        </div>
      </div>
    </div>
  );
}

// Export alias for semantic naming
export const RepeatCapCounter = RepeatCapSlider;
