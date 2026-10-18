import { describe, it, expect } from 'vitest';
import { formatDashboardDate } from '@/lib/utils/date';

describe('formatDashboardDate (FE-03)', () => {
  it('formats dates in Thai using Buddhist Era', () => {
    // 2026-10-18
    const testDate = new Date(2026, 9, 18);
    const formatted = formatDashboardDate(testDate, 'th');

    expect(formatted).toContain('2569');
    expect(formatted).toContain('ตุลาคม');
  });

  it('formats dates in English using Gregorian calendar', () => {
    // 2026-10-18
    const testDate = new Date(2026, 9, 18);
    const formatted = formatDashboardDate(testDate, 'en');

    expect(formatted).toContain('2026');
    expect(formatted).toContain('October');
    expect(formatted).toContain('Sunday');
  });

  it('handles locale variants gracefully', () => {
    const testDate = new Date(2026, 9, 18);
    const formattedTh = formatDashboardDate(testDate, 'th-TH');
    expect(formattedTh).toContain('2569');

    const formattedOther = formatDashboardDate(testDate, 'fr');
    expect(formattedOther).toContain('2026');
  });
});
