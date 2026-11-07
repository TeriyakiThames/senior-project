'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { ActivityPlace } from '@/types/activity';

export interface PlaceCardProps {
  place: ActivityPlace;
  href: string;
}

export function PlaceCard({ place, href }: PlaceCardProps) {
  return (
    <Link
      href={href}
      className="block bg-white rounded-3xl overflow-hidden shadow-[0_2px_6px_rgba(33,33,92,0.06),0_8px_24px_rgba(33,33,92,0.08)] active:scale-[0.99] transition-all focus:outline-none focus:ring-2 focus:ring-[#3E81F7]"
    >
      {/* Thumbnail */}
      <div className="relative w-full h-[150px] bg-[#EAF0F6]">
        <Image
          src={place.imageUrl}
          alt={place.name}
          fill
          sizes="(max-width: 440px) 100vw, 400px"
          className="object-cover"
          unoptimized
        />
      </div>

      {/* Content */}
      <div className="p-4 space-y-1.5">
        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#E2F5E9] text-[#2D6A4F]">
            {place.tag}
          </span>
        </div>

        <h3 className="text-xl font-extrabold text-[#21215C] leading-snug">{place.name}</h3>

        <div className="flex items-center gap-2 text-sm font-semibold text-[#4B4F72]">
          <span>{place.distanceText}</span>
          <span>•</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
            {place.isOpen ? 'เปิดอยู่' : 'ปิดอยู่'}
          </span>
        </div>

        {place.matchingReason && (
          <p className="text-xs sm:text-sm text-[#7D84A3] font-medium pt-1">
            {place.matchingReason}
          </p>
        )}
      </div>
    </Link>
  );
}
