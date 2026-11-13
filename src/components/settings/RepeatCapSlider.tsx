'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export interface RepeatCapSliderProps {
  value: number;
  onChange: (newValue: number) => void;
  disabled?: boolean;
  isSaving?: boolean;
}

const STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const DEFAULT_VALUE = 3;

export function RepeatCapSlider({
  value,
  onChange,
  disabled = false,
  isSaving = false,
}: RepeatCapSliderProps) {
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

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 12 && !disabled) {
      onChange(val);
    }
  };

  const totalMinutes = value * 5;

  return (
    <div className="space-y-4">
      {/* Current Value Display & Stepper */}
      <div className="flex items-center justify-between gap-3 bg-[#F2F7FA] p-3.5 rounded-2xl">
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= 1}
          aria-label="ลดจำนวนครั้ง"
          className="w-12 h-12 rounded-2xl bg-white text-[#21215C] font-extrabold text-2xl border-2 border-[#7D84A3]/30 flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none hover:border-[#21215C] focus:outline-none focus:ring-2 focus:ring-[#21215C]"
        >
          −
        </button>

        <div className="text-center flex-1">
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl font-black text-[#21215C]">{value}</span>
            <span className="text-lg font-bold text-[#4B4F72]">
              {t('repeatTimes', { count: value })}
            </span>
            {value === DEFAULT_VALUE && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-[#FBEFD8] text-[#7A4E00] border border-[#FCCE57]">
                ⭐ {t('repeatCapRecommended')}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm font-medium text-[#7D84A3] mt-0.5">
            ({totalMinutes} {t('repeatMinutesTotal', { minutes: totalMinutes })})
          </p>
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || value >= 12}
          aria-label="เพิ่มจำนวนครั้ง"
          className="w-12 h-12 rounded-2xl bg-white text-[#21215C] font-extrabold text-2xl border-2 border-[#7D84A3]/30 flex items-center justify-center transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none hover:border-[#21215C] focus:outline-none focus:ring-2 focus:ring-[#21215C]"
        >
          +
        </button>
      </div>

      {/* Accessible native range input */}
      <div className="px-1">
        <label htmlFor="repeat-cap-range" className="sr-only">
          {t('notificationRepeatCap')}
        </label>
        <input
          id="repeat-cap-range"
          type="range"
          min={1}
          max={12}
          step={1}
          value={value}
          onChange={handleSliderChange}
          disabled={disabled}
          aria-valuemin={1}
          aria-valuemax={12}
          aria-valuenow={value}
          aria-valuetext={`${value} ครั้ง รวม ${totalMinutes} นาที`}
          className="w-full h-3 bg-[#EAF0F6] rounded-lg appearance-none cursor-pointer accent-[#21215C] focus:outline-none focus:ring-2 focus:ring-[#21215C]"
        />
      </div>

      {/* Stepped "O-O-O-O-..." Node Track with numbers */}
      <div className="pt-1">
        <div
          role="radiogroup"
          aria-label={t('notificationRepeatCap')}
          className="relative flex items-center justify-between"
        >
          {/* Connecting track line behind nodes */}
          <div
            className="absolute left-3 right-3 top-4 h-1 bg-[#EAF0F6] -translate-y-1/2 rounded-full -z-0"
            aria-hidden="true"
          />

          {STEPS.map((step) => {
            const isSelected = step === value;
            const isPassed = step < value;

            return (
              <div key={step} className="flex flex-col items-center z-10">
                <button
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${step} ครั้ง`}
                  disabled={disabled}
                  onClick={() => onChange(step)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#21215C] ${
                    isSelected
                      ? 'bg-[#21215C] text-white shadow-md scale-110 ring-4 ring-[#21215C]/20'
                      : isPassed
                        ? 'bg-[#E1E8F8] text-[#385289] border border-[#3E81F7]/40 hover:bg-[#d4e0f7]'
                        : 'bg-white text-[#7D84A3] border border-[#7D84A3]/30 hover:border-[#21215C] hover:text-[#21215C]'
                  }`}
                >
                  {isSelected ? '✓' : step}
                </button>
                <span
                  className={`text-[10px] sm:text-xs font-medium mt-1 select-none transition-colors ${
                    isSelected ? 'font-bold text-[#21215C]' : 'text-[#7D84A3]'
                  }`}
                >
                  {step}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Explanation Banner matching Senior Project Style */}
      <div className="rounded-2xl bg-[#FBEFD8] p-4 border border-[#FCCE57]/40 flex items-start gap-3">
        <span className="text-2xl flex-shrink-0" aria-hidden="true">
          ⏱️
        </span>
        <div className="space-y-1">
          <p className="text-sm font-bold text-[#7A4E00]">
            {t('repeatTotalSummary', { count: value, minutes: totalMinutes })}
          </p>
          <p className="text-xs sm:text-sm text-[#7A4E00]/90 leading-relaxed">
            {t('repeatAutoDismissDesc', { count: value })}
          </p>
        </div>
      </div>

      {/* Saving status indicator */}
      {isSaving && (
        <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#7D84A3] pt-1">
          <div
            className="w-3.5 h-3.5 border-2 border-[#21215C] border-t-transparent rounded-full animate-spin"
            aria-hidden="true"
          />
          <span>{t('savingSettings')}</span>
        </div>
      )}
    </div>
  );
}
