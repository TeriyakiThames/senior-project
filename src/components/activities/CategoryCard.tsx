'use client';

import Link from 'next/link';
import type { ActivityCategory } from '@/types/activity';

export interface CategoryCardProps {
  category: ActivityCategory;
  href: string;
}

export function CategoryCard({ category, href }: CategoryCardProps) {
  return (
    <Link
      href={href}
      className={`${category.bgColor} rounded-3xl p-4 flex flex-col justify-between min-h-[104px] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-offset-2`}
      style={{ outlineColor: category.accentColor }}
    >
      <div className="text-2xl" aria-hidden="true">
        {category.icon}
      </div>
      <div>
        <p className={`${category.textColor} font-bold text-lg leading-tight`}>{category.name}</p>
      </div>
    </Link>
  );
}
