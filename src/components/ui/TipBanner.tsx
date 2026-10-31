'use client';

import { type ReactNode } from 'react';
import Image from 'next/image';

export interface TipBannerProps {
  /** Main guidance prompt / title */
  title: ReactNode;
  /** Sub-guidance or speech examples */
  description: ReactNode;
  /** Custom icon inside the rounded badge (defaults to Royal Blue mic icon) */
  icon?: ReactNode;
  /** Additional container class names */
  className?: string;
}

export function TipBanner({ title, description, icon, className = '' }: TipBannerProps) {
  return (
    <div
      className={`bg-[#EAF0F6] rounded-3xl p-4 sm:p-5 flex items-center gap-4 border border-[#E1E8F8]/80 ${className}`}
    >
      {/* Round Icon Badge matching SVG Design Language */}
      <div className="w-12 h-12 rounded-full bg-[#E1E8F8] flex items-center justify-center shrink-0 shadow-xs">
        {icon || (
          <Image
            src="/icons/microphone_big.svg"
            alt=""
            width={24}
            height={24}
            unoptimized
            aria-hidden="true"
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[#21215C] font-bold text-base leading-snug">{title}</p>
        <p className="text-[#4B4F72] text-sm sm:text-base mt-0.5 font-normal leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}
