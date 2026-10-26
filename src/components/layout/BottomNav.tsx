'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const navItems = [
  { href: '/liff', icon: '🏠', labelKey: 'todaySchedule' as const },
  { href: '/liff/alarms', icon: '⏰', labelKey: 'alarms' as const },
  { href: '/liff/reminders', icon: '📋', labelKey: 'reminders' as const },
  { href: '/liff/notes', icon: '📝', labelKey: 'notes' as const },
  { href: '/liff/settings', icon: '⚙️', labelKey: 'settings' as const },
];

export function BottomNav() {
  const pathname = usePathname() || '';
  const t = useTranslations('dashboard');

  const locale = pathname.startsWith('/en') ? 'en' : 'th';
  const cleanPath = pathname.replace(/^\/(th|en)/, '') || '/liff';

  // In the SVG-based design, the dashboard page (/liff) functions as an integrated hub without floating bottom nav.
  if (cleanPath === '/liff') {
    return null;
  }

  return (
    <nav
      aria-label="Bottom Navigation"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] bg-white border-t border-x border-gray-200 shadow-lg z-50"
    >
      <div className="w-full flex justify-around py-2">
        {navItems.map((item) => {
          const fullHref = `/${locale}${item.href}`;
          const isActive =
            cleanPath === item.href || (item.href !== '/liff' && cleanPath.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={fullHref}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center min-w-[60px] min-h-touch justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-line-green rounded-lg ${
                isActive
                  ? 'text-line-green font-semibold'
                  : 'text-senior-muted hover:text-senior-text'
              }`}
            >
              <span className="text-2xl" aria-hidden="true">
                {item.icon}
              </span>
              <span className="text-xs mt-1 font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
