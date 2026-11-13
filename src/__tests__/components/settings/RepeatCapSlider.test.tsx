import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../../../../messages/th.json';
import enMessages from '../../../../messages/en.json';
import { RepeatCapSlider } from '@/components/settings/RepeatCapSlider';

function renderSlider(ui: React.ReactElement, locale: 'th' | 'en' = 'th') {
  const messages = locale === 'th' ? thMessages : enMessages;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Bangkok">
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('RepeatCapSlider (Notification Repeat Cap Stepped Slider)', () => {
  it('renders default value 3 with 15 minutes total and recommended badge', () => {
    const handleChange = vi.fn();
    const html = renderSlider(<RepeatCapSlider value={3} onChange={handleChange} />, 'th');

    // Prominent number display
    expect(html).toContain('3');
    expect(html).toContain('3 ครั้ง');
    expect(html).toContain('15 นาที');
    expect(html).toContain('ค่าแนะนำ');

    // Stepper buttons
    expect(html).toContain('−');
    expect(html).toContain('+');

    // Range input accessibility
    expect(html).toContain('type="range"');
    expect(html).toContain('min="1"');
    expect(html).toContain('max="12"');
    expect(html).toContain('aria-valuenow="3"');

    // All 12 step numbers rendered
    for (let i = 1; i <= 12; i++) {
      expect(html).toContain(`>${i}</span>`);
    }
  });

  it('renders custom value 8 with 40 minutes total in English', () => {
    const handleChange = vi.fn();
    const html = renderSlider(<RepeatCapSlider value={8} onChange={handleChange} />, 'en');

    expect(html).toContain('8');
    expect(html).toContain('8 times');
    expect(html).toContain('40 mins');
    expect(html).toContain('aria-valuenow="8"');
    // Does not show recommended badge for 8
    expect(html).not.toContain('Recommended');
  });

  it('renders saving indicator when isSaving is true', () => {
    const handleChange = vi.fn();
    const html = renderSlider(
      <RepeatCapSlider value={4} onChange={handleChange} isSaving={true} />,
      'th',
    );

    expect(html).toContain('กำลังบันทึก...');
    expect(html).toContain('animate-spin');
  });

  it('renders disabled state on buttons and input when disabled is true', () => {
    const handleChange = vi.fn();
    const html = renderSlider(
      <RepeatCapSlider value={1} onChange={handleChange} disabled={true} />,
      'th',
    );

    expect(html).toContain('disabled=""');
  });
});
