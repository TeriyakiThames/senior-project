import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../../../../messages/th.json';
import enMessages from '../../../../messages/en.json';
import { RepeatCapSlider, RepeatCapCounter } from '@/components/settings/RepeatCapSlider';

function renderSlider(ui: React.ReactElement, locale: 'th' | 'en' = 'th') {
  const messages = locale === 'th' ? thMessages : enMessages;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Bangkok">
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('RepeatCapSlider / RepeatCapCounter (Senior-Friendly Counter)', () => {
  it('renders default value 3 without duplicate numbers or recommended badge', () => {
    const handleChange = vi.fn();
    const html = renderSlider(<RepeatCapSlider value={3} onChange={handleChange} />, 'th');

    // Number display
    expect(html).toContain('3');
    expect(html).toContain('ครั้ง');
    expect(html).toContain('(15 นาที)');

    // Ensure no duplicate number bugs (e.g. "3 3 ครั้ง" or "15 15 นาที")
    expect(html).not.toContain('3 3');
    expect(html).not.toContain('15 15');

    // Ensure recommended badge and saved message are removed
    expect(html).not.toContain('ค่าแนะนำ');
    expect(html).not.toContain('⭐');

    // Stepper buttons
    expect(html).toContain('−');
    expect(html).toContain('+');

    // Ensure range input and circle track are removed
    expect(html).not.toContain('type="range"');
    expect(html).not.toContain('role="radiogroup"');

    // Ensure rigid layout classes exist
    expect(html).toContain('tabular-nums');
  });

  it('renders custom value 10 without layout shifting elements', () => {
    const handleChange = vi.fn();
    const html = renderSlider(<RepeatCapCounter value={10} onChange={handleChange} />, 'th');

    expect(html).toContain('10');
    expect(html).toContain('ครั้ง');
    expect(html).toContain('(50 นาที)');
    expect(html).toContain('tabular-nums');
  });

  it('renders English units cleanly for value 8', () => {
    const handleChange = vi.fn();
    const html = renderSlider(<RepeatCapSlider value={8} onChange={handleChange} />, 'en');

    expect(html).toContain('8');
    expect(html).toContain('times');
    expect(html).toContain('(40 mins)');
    expect(html).not.toContain('Recommended');
  });

  it('disables decrement button when value is 1', () => {
    const handleChange = vi.fn();
    const html = renderSlider(<RepeatCapSlider value={1} onChange={handleChange} />, 'th');

    // The decrement button should have disabled attribute
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="ลดจำนวนครั้ง"/);
  });

  it('disables increment button when value is 12', () => {
    const handleChange = vi.fn();
    const html = renderSlider(<RepeatCapSlider value={12} onChange={handleChange} />, 'th');

    // The increment button should have disabled attribute
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="เพิ่มจำนวนครั้ง"/);
  });

  it('disables all buttons when disabled prop is true', () => {
    const handleChange = vi.fn();
    const html = renderSlider(
      <RepeatCapSlider value={5} onChange={handleChange} disabled={true} />,
      'th',
    );

    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="ลดจำนวนครั้ง"/);
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="เพิ่มจำนวนครั้ง"/);
  });
});
