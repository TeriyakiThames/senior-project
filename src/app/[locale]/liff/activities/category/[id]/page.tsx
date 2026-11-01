'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { PlaceCard } from '@/components/activities/PlaceCard';
import { MOCK_CATEGORIES, MOCK_PLACES } from '@/lib/mock/activities';

export default function CategoryRecommendationsPage() {
  const locale = useLocale();
  const params = useParams();
  const categoryId = (params?.id as string) || 'walking';

  const category = useMemo(() => {
    return MOCK_CATEGORIES.find((c) => c.id === categoryId) || MOCK_CATEGORIES[0];
  }, [categoryId]);

  const allPlaces = useMemo(() => Object.values(MOCK_PLACES), []);

  // Filter chips state
  const [activeFilters, setActiveFilters] = useState<string[]>(['open']);

  const filterChips = [
    { id: 'open', label: 'เปิดตอนนี้' },
    { id: 'free', label: 'ไม่มีค่าใช้จ่าย' },
    { id: 'benches', label: 'มีที่นั่งพัก' },
    { id: 'flat', label: 'ทางเรียบ' },
  ];

  const toggleFilter = (id: string) => {
    setActiveFilters((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  };

  return (
    <div className="min-h-screen bg-[#F2F7FA] text-[#21215C]">
      <main className="px-5 pt-4 pb-12 max-w-[440px] mx-auto space-y-4">
        {/* Category Header */}
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/liff/activities`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#21215C] hover:opacity-75 active:scale-95 transition-all -ml-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#21215C]"
            aria-label="ย้อนกลับ"
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
          <h1 className="text-3xl font-extrabold text-[#21215C] tracking-tight">{category.name}</h1>
        </div>

        <p className="text-sm font-medium text-[#7D84A3]">
          ที่{category.name}ใกล้บ้าน ไม่เกิน 2 กม. • เจอ {allPlaces.length} ที่
        </p>

        {/* Filter Chips (2x2 grid) */}
        <div className="grid grid-cols-2 gap-2.5">
          {filterChips.map((chip) => {
            const isSelected = activeFilters.includes(chip.id);
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => toggleFilter(chip.id)}
                className={`h-[48px] rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-1.5 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#3E81F7] ${
                  isSelected
                    ? 'bg-[#E1E8F8] border-2 border-[#3E81F7] text-[#21215C]'
                    : 'bg-white border-2 border-[#EAF0F6] text-[#4B4F72] hover:border-[#CBD5E1]'
                }`}
              >
                {isSelected && <span>✓</span>}
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>

        {/* Place List */}
        <div className="space-y-4 pt-2">
          {allPlaces.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              href={`/${locale}/liff/activities/place/${place.id}`}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
