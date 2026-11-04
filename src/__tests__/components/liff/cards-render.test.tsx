import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../../../../messages/th.json';
import enMessages from '../../../../messages/en.json';

import { AlarmCard, type AlarmItem } from '@/components/liff/AlarmCard';
import { ReminderCard, type ReminderItem } from '@/components/liff/ReminderCard';
import { NoteCard, type NoteItem } from '@/components/liff/NoteCard';
import { DetailHeader } from '@/components/layout/DetailHeader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { TipBanner } from '@/components/ui/TipBanner';
import { Toast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { PageWrapper } from '@/components/layout/PageWrapper';

function renderWithIntl(ui: React.ReactElement, locale: 'th' | 'en' = 'th') {
  const messages = locale === 'th' ? thMessages : enMessages;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Bangkok">
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('LIFF Card & UI Components Robustness & Render Tests', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const baseNow = new Date('2026-10-22T10:00:00.000Z');

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('AlarmCard (Regression for commit 2a51318 & Edge Cases)', () => {
    it('renders a standard alarm with time and label without errors', () => {
      const alarm: AlarmItem = {
        id: 'alarm-1',
        time: '07:30',
        label: 'ตื่นนอนตอนเช้า',
        recurrence: 'daily',
        enabled: true,
      };

      const html = renderWithIntl(
        <AlarmCard alarm={alarm} onDelete={vi.fn()} baseNow={baseNow} />,
        'th',
      );
      expect(html).toContain('07:30');
      expect(html).toContain('น.');
      expect(html).toContain('ตื่นนอนตอนเช้า');
      expect(html).toContain('ทุกวัน');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders a TimerDoc (time is undefined, durationMinutes is provided) without crashing', () => {
      const nextFireAt = new Date('2026-10-22T10:15:00.000Z');
      const timerAlarm: AlarmItem = {
        id: 'timer-1',
        time: undefined,
        durationMinutes: 15,
        enabled: true,
        nextFireAt,
      };

      const expectedHours = String(nextFireAt.getHours()).padStart(2, '0');
      const expectedMinutes = String(nextFireAt.getMinutes()).padStart(2, '0');
      const expectedTime = `${expectedHours}:${expectedMinutes}`;

      // In Thai
      const thHtml = renderWithIntl(
        <AlarmCard alarm={timerAlarm} onDelete={vi.fn()} baseNow={baseNow} />,
        'th',
      );
      expect(thHtml).toContain(expectedTime);
      expect(thHtml).toContain('น.');
      expect(thHtml).toContain(`aria-label="ลบ ${expectedTime}"`);

      // In English
      const enHtml = renderWithIntl(
        <AlarmCard alarm={timerAlarm} onDelete={vi.fn()} baseNow={baseNow} />,
        'en',
      );
      expect(enHtml).toContain(expectedTime);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders a TimerDoc with custom label and without nextFireAt displaying raw durationMinutes with unit', () => {
      const timerWithoutNextFire: AlarmItem = {
        id: 'timer-2',
        time: undefined,
        durationMinutes: 45,
        label: 'ต้มไข่',
        enabled: true,
        nextFireAt: null,
      };

      const thHtml = renderWithIntl(
        <AlarmCard alarm={timerWithoutNextFire} onDelete={vi.fn()} baseNow={baseNow} />,
        'th',
      );
      expect(thHtml).toContain('45');
      expect(thHtml).toContain('นาที');
      expect(thHtml).toContain('ต้มไข่');
      expect(thHtml).toContain('aria-label="ลบ ต้มไข่"');

      const enHtml = renderWithIntl(
        <AlarmCard alarm={timerWithoutNextFire} onDelete={vi.fn()} baseNow={baseNow} />,
        'en',
      );
      expect(enHtml).toContain('45');
      expect(enHtml).toContain('min');
      expect(enHtml).toContain('ต้มไข่');

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders fallback --:-- when both time and durationMinutes are missing', () => {
      const malformedAlarm: AlarmItem = {
        id: 'malformed-1',
        time: undefined,
        durationMinutes: undefined,
        enabled: true,
      };

      const html = renderWithIntl(
        <AlarmCard alarm={malformedAlarm} onDelete={vi.fn()} baseNow={baseNow} />,
        'th',
      );
      expect(html).toContain('--:--');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('correctly handles all Firestore timestamp representations in nextFireAt', () => {
      const testCases = [
        { desc: 'Firestore _seconds object', nextFireAt: { _seconds: 1729591200 } },
        { desc: 'Firestore seconds object', nextFireAt: { seconds: 1729591200 } },
        {
          desc: 'Firestore toDate() function',
          nextFireAt: { toDate: () => new Date('2026-10-22T10:00:00.000Z') },
        },
        { desc: 'ISO Date string', nextFireAt: '2026-10-22T10:00:00.000Z' },
        { desc: 'JavaScript Date object', nextFireAt: new Date('2026-10-22T10:00:00.000Z') },
        { desc: 'null timestamp', nextFireAt: null },
      ];

      for (const tc of testCases) {
        const alarm: AlarmItem = {
          id: `alarm-${tc.desc}`,
          time: '08:00',
          nextFireAt: tc.nextFireAt,
          enabled: true,
        };

        expect(() => {
          renderWithIntl(<AlarmCard alarm={alarm} onDelete={vi.fn()} baseNow={baseNow} />, 'th');
        }).not.toThrow();
      }

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders days of week recurrence and monthly recurrence correctly', () => {
      const weeklyAlarm: AlarmItem = {
        id: 'weekly-1',
        time: '06:00',
        recurrence: 'weekly',
        daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
        enabled: true,
      };

      const thHtml = renderWithIntl(
        <AlarmCard alarm={weeklyAlarm} onDelete={vi.fn()} baseNow={baseNow} />,
        'th',
      );
      expect(thHtml).toContain('จ.-ศ.');

      const customDaysAlarm: AlarmItem = {
        id: 'custom-1',
        time: '06:00',
        recurrence: 'weekly',
        daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
        enabled: true,
      };

      const customHtml = renderWithIntl(
        <AlarmCard alarm={customDaysAlarm} onDelete={vi.fn()} baseNow={baseNow} />,
        'th',
      );
      expect(customHtml).toContain('จ., พ., ศ.');

      const monthlyAlarm: AlarmItem = {
        id: 'monthly-1',
        time: '09:00',
        recurrence: 'monthly',
        dayOfMonth: 15,
        enabled: true,
      };

      const monthlyHtml = renderWithIntl(
        <AlarmCard alarm={monthlyAlarm} onDelete={vi.fn()} baseNow={baseNow} />,
        'th',
      );
      expect(monthlyHtml).toContain('วันที่ 15');

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('ReminderCard Robustness', () => {
    it('renders normal pending reminder with scheduled time and message', () => {
      const scheduledAt = new Date('2026-10-22T13:00:00.000Z');
      const reminder: ReminderItem = {
        id: 'rem-1',
        message: 'ทานยาลดความดัน',
        status: 'pending',
        scheduledAt,
        nextFireAt: scheduledAt,
        recurrence: 'once',
      };

      const expectedHours = String(scheduledAt.getHours()).padStart(2, '0');
      const expectedMinutes = String(scheduledAt.getMinutes()).padStart(2, '0');
      const expectedTime = `${expectedHours}:${expectedMinutes}`;

      const html = renderWithIntl(
        <ReminderCard reminder={reminder} onDelete={vi.fn()} baseNow={baseNow} />,
        'th',
      );
      expect(html).toContain('ทานยาลดความดัน');
      expect(html).toContain(expectedTime);
      expect(html).toContain('ครั้งเดียว');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders snoozed reminder showing snooze badge and willRemindAgain notice', () => {
      const snoozedReminder: ReminderItem = {
        id: 'rem-snooze',
        message: 'นัดพบแพทย์ตรวจเบาหวาน',
        status: 'snoozed',
        scheduledAt: new Date('2026-10-22T08:00:00.000Z'),
        nextFireAt: new Date('2026-10-22T08:15:00.000Z'),
      };

      const html = renderWithIntl(
        <ReminderCard reminder={snoozedReminder} onDelete={vi.fn()} baseNow={baseNow} />,
        'th',
      );
      expect(html).toContain('นัดพบแพทย์ตรวจเบาหวาน');
      expect(html).toContain('เลื่อนเวลา');
      expect(html).toContain('จะเตือนอีกครั้ง');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders recurring reminder with plan recurrence pill', () => {
      const recurringReminder: ReminderItem = {
        id: 'rem-rec',
        message: 'เดินออกกำลังกายรอบหมู่บ้าน',
        status: 'pending',
        scheduledAt: new Date('2026-10-22T10:00:00.000Z'),
        recurrence: 'daily',
      };

      const html = renderWithIntl(
        <ReminderCard reminder={recurringReminder} onDelete={vi.fn()} baseNow={baseNow} />,
        'th',
      );
      expect(html).toContain('เดินออกกำลังกายรอบหมู่บ้าน');
      expect(html).toContain('ทุกวัน');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('safely handles missing or corrupt timestamps without throwing', () => {
      const corruptReminder: ReminderItem = {
        id: 'rem-corrupt',
        message: 'การเตือนไม่มีเวลา',
        status: 'pending',
        scheduledAt: null,
        nextFireAt: undefined,
      };

      expect(() => {
        const html = renderWithIntl(
          <ReminderCard reminder={corruptReminder} onDelete={vi.fn()} baseNow={baseNow} />,
          'th',
        );
        expect(html).toContain('การเตือนไม่มีเวลา');
      }).not.toThrow();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('NoteCard Robustness', () => {
    it('renders a voice-sourced note with microphone icon and Thai label', () => {
      const voiceNote: NoteItem = {
        id: 'note-v1',
        summary: 'ซื้อน้ำตาลทราย 1 ถุง',
        content: 'ซื้อน้ำตาลทราย 1 ถุง และน้ำปลาขวดใหญ่',
        source: 'voice',
        createdAt: new Date('2026-10-22T03:30:00.000Z'),
      };

      const html = renderWithIntl(<NoteCard note={voiceNote} onDelete={vi.fn()} />, 'th');
      expect(html).toContain('ซื้อน้ำตาลทราย 1 ถุง และน้ำปลาขวดใหญ่');
      expect(html).toContain('เสียง');
      expect(html).toContain('/icons/microphone_small.svg');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders a typed note with keyboard icon and label', () => {
      const typedNote: NoteItem = {
        id: 'note-t1',
        summary: 'เบอร์ติดต่อช่างประปา 081-234-5678',
        source: 'text',
        createdAt: new Date('2026-10-21T03:30:00.000Z'),
      };

      const html = renderWithIntl(<NoteCard note={typedNote} onDelete={vi.fn()} />, 'th');
      expect(html).toContain('เบอร์ติดต่อช่างประปา 081-234-5678');
      expect(html).toContain('พิมพ์');
      expect(html).toContain('/icons/keyboard.svg');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('safely handles missing createdAt and missing content', () => {
      const minimalNote: NoteItem = {
        id: 'note-min',
        summary: 'โน้ตสั้นๆ',
      };

      expect(() => {
        const html = renderWithIntl(<NoteCard note={minimalNote} onDelete={vi.fn()} />, 'th');
        expect(html).toContain('โน้ตสั้นๆ');
      }).not.toThrow();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('DetailHeader & Navigation', () => {
    it('renders title, subtitle, back link, and custom badge icon', () => {
      const html = renderWithIntl(
        <DetailHeader
          title="นาฬิกาปลุก"
          subtitle="3 รายการ · ใหม่สุดอยู่บนสุด"
          badgeBgColor="bg-[#FBEFD8]"
          badgeIcon={<span data-testid="badge-icon">⏰</span>}
        />,
        'th',
      );

      expect(html).toContain('นาฬิกาปลุก');
      expect(html).toContain('3 รายการ · ใหม่สุดอยู่บนสุด');
      expect(html).toContain('href="/th/liff"');
      expect(html).toContain('bg-[#FBEFD8]');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders cleanly without subtitle', () => {
      const html = renderWithIntl(
        <DetailHeader
          title="โน้ต"
          badgeBgColor="bg-[#EEE1FA]"
          badgeIcon={<span>📝</span>}
          backHref="/th/custom-back"
        />,
        'th',
      );

      expect(html).toContain('โน้ต');
      expect(html).toContain('href="/th/custom-back"');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('ConfirmDialog Modal', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <ConfirmDialog
          isOpen={false}
          title="ลบโน้ตนี้ไหมคะ"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      expect(html).toBe('');
    });

    it('renders danger confirmation dialog with title, preview box, and warning', () => {
      const html = renderToStaticMarkup(
        <ConfirmDialog
          isOpen={true}
          title="ลบโน้ตนี้ไหมคะ"
          contentPreview="ซื้อน้ำตาลทราย 1 ถุง"
          warningText="ลบแล้วจะเอากลับมาไม่ได้นะคะ"
          confirmLabel="ลบโน้ต"
          cancelLabel="ไม่ลบ"
          confirmVariant="danger"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(html).toContain('ลบโน้ตนี้ไหมคะ');
      expect(html).toContain('ซื้อน้ำตาลทราย 1 ถุง');
      expect(html).toContain('ลบแล้วจะเอากลับมาไม่ได้นะคะ');
      expect(html).toContain('ลบโน้ต');
      expect(html).toContain('ไม่ลบ');
      expect(html).toContain('bg-[#942626]');
    });

    it('renders primary confirmation dialog with primary button style', () => {
      const html = renderToStaticMarkup(
        <ConfirmDialog
          isOpen={true}
          title="ยืนยันการตั้งค่า"
          message="คุณต้องการบันทึกหรือไม่"
          confirmLabel="บันทึก"
          cancelLabel="ยกเลิก"
          confirmVariant="primary"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />,
      );

      expect(html).toContain('ยืนยันการตั้งค่า');
      expect(html).toContain('คุณต้องการบันทึกหรือไม่');
      expect(html).toContain('bg-[#3E81F7]');
    });
  });

  describe('EmptyState Component', () => {
    it('renders with badge, title, description, and action button', () => {
      const html = renderWithIntl(
        <EmptyState
          badgeBgColor="bg-[#EEE1FA]"
          badgeIcon={<span>📝</span>}
          title="ยังไม่มีโน้ตค่ะ"
          description="พูดหรือพิมพ์ในแชตว่า “จดไว้หน่อย...”"
          actionLabel="ไปที่แชต"
          onAction={vi.fn()}
        />,
        'th',
      );

      expect(html).toContain('ยังไม่มีโน้ตค่ะ');
      expect(html).toContain('พูดหรือพิมพ์ในแชตว่า “จดไว้หน่อย...”');
      expect(html).toContain('ไปที่แชต');
      expect(html).toContain('bg-[#EEE1FA]');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('hides action button when showActionButton is false', () => {
      const html = renderWithIntl(
        <EmptyState
          badgeBgColor="bg-[#E1E8F8]"
          badgeIcon={<span>🔔</span>}
          title="ไม่มีรายการ"
          showActionButton={false}
        />,
        'th',
      );

      expect(html).toContain('ไม่มีรายการ');
      expect(html).not.toContain('<button');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('TipBanner Component', () => {
    it('renders guidance title and speech example description', () => {
      const html = renderToStaticMarkup(
        <TipBanner
          title="อยากจดโน้ตหรือตั้งเตือน พูดหรือพิมพ์ในแชตได้เลยค่ะ"
          description="เช่น “เตือนกินยาสองทุ่ม”"
        />,
      );

      expect(html).toContain('อยากจดโน้ตหรือตั้งเตือน พูดหรือพิมพ์ในแชตได้เลยค่ะ');
      expect(html).toContain('เช่น “เตือนกินยาสองทุ่ม”');
      expect(html).toContain('/icons/microphone_big.svg');
    });
  });

  describe('Toast Component', () => {
    it('returns null when isOpen is false', () => {
      const html = renderToStaticMarkup(
        <Toast isOpen={false} message="ลบโน้ตแล้วค่ะ" onClose={vi.fn()} />,
      );
      expect(html).toBe('');
    });

    it('renders accessible status toast when isOpen is true', () => {
      const html = renderToStaticMarkup(
        <Toast isOpen={true} message="ลบโน้ตแล้วค่ะ" onClose={vi.fn()} />,
      );

      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('ลบโน้ตแล้วค่ะ');
      expect(html).toContain('/icons/confirm_tick.svg');
    });
  });

  describe('Shared UI Primitives (Button, Card, Loading, PageWrapper)', () => {
    it('renders Button with variants and disabled states', () => {
      const primaryHtml = renderToStaticMarkup(<Button variant="primary">กดบันทึก</Button>);
      expect(primaryHtml).toContain('กดบันทึก');
      expect(primaryHtml).toContain('bg-line-green');

      const dangerHtml = renderToStaticMarkup(<Button variant="danger">ลบข้อมูล</Button>);
      expect(dangerHtml).toContain('ลบข้อมูล');
      expect(dangerHtml).toContain('bg-senior-danger');

      const secondaryHtml = renderToStaticMarkup(<Button variant="secondary">ยกเลิก</Button>);
      expect(secondaryHtml).toContain('ยกเลิก');

      const disabledHtml = renderToStaticMarkup(<Button disabled>ปิดใช้งาน</Button>);
      expect(disabledHtml).toContain('disabled');
    });

    it('renders Card with and without onClick action', () => {
      const passiveHtml = renderToStaticMarkup(<Card>เนื้อหาการ์ด</Card>);
      expect(passiveHtml).toContain('เนื้อหาการ์ด');
      expect(passiveHtml).not.toContain('role="button"');

      const clickableHtml = renderToStaticMarkup(<Card onClick={vi.fn()}>คลิกได้</Card>);
      expect(clickableHtml).toContain('คลิกได้');
      expect(clickableHtml).toContain('role="button"');
      expect(clickableHtml).toContain('tabindex="0"');
    });

    it('renders Loading spinner with custom message', () => {
      const html = renderToStaticMarkup(<Loading message="กำลังตรวจสอบข้อมูล..." />);
      expect(html).toContain('กำลังตรวจสอบข้อมูล...');
      expect(html).toContain('role="status"');
    });

    it('renders PageWrapper with children', () => {
      const html = renderToStaticMarkup(
        <PageWrapper>
          <p>เนื้อหาหน้า</p>
        </PageWrapper>,
      );
      expect(html).toContain('เนื้อหาหน้า');
    });
  });
});
