import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import thMessages from '../../../../messages/th.json';
import enMessages from '../../../../messages/en.json';

// Mocks for hooks & navigation
const mockUseLiff = vi.fn();
const mockUseLiffData = vi.fn();
const mockPush = vi.fn();
const mockPathname = vi.fn(() => '/th/liff');

vi.mock('@/components/liff/LiffProvider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/liff/LiffProvider')>();
  return {
    ...actual,
    useLiff: () => mockUseLiff(),
  };
});

vi.mock('@/hooks/useLiffData', () => ({
  useLiffData: (type: string) => mockUseLiffData(type),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => mockPathname(),
}));

// Import LIFF Pages
import DashboardPage from '@/app/[locale]/liff/page';
import TimerPage from '@/app/[locale]/liff/timer/page';
import RemindersPage from '@/app/[locale]/liff/reminders/page';
import NotesPage from '@/app/[locale]/liff/notes/page';
import SettingsPage from '@/app/[locale]/liff/settings/page';
import LiffLayout from '@/app/[locale]/liff/layout';
import LocaleHomePage from '@/app/[locale]/page';

// Helper to render with NextIntlClientProvider
function renderWithIntl(ui: React.ReactElement, locale: 'th' | 'en' = 'th') {
  const messages = locale === 'th' ? thMessages : enMessages;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Bangkok">
      {ui}
    </NextIntlClientProvider>,
  );
}

describe('LIFF Frontend Pages Smoke & Render Tests', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default healthy LIFF state
    mockUseLiff.mockReturnValue({
      isReady: true,
      userId: 'test-user-001',
      displayName: 'คุณยายสมศรี',
      language: 'th',
      isInClient: true,
      idToken: 'mock-id-token',
      error: null,
    });

    mockPathname.mockReturnValue('/th/liff');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Loading and Unready States', () => {
    it('renders all pages in loading state without errors when data is fetching', () => {
      mockUseLiffData.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refresh: vi.fn(),
        deleteItem: vi.fn(),
      });

      const pages = [
        <DashboardPage key="dashboard" />,
        <TimerPage key="timer" />,
        <RemindersPage key="reminders" />,
        <NotesPage key="notes" />,
      ];

      for (const page of pages) {
        expect(() => {
          const html = renderWithIntl(page, 'th');
          expect(html).toContain('กำลังโหลด...');
        }).not.toThrow();
      }

      // SettingsPage depends directly on isReady
      mockUseLiff.mockReturnValueOnce({ isReady: false });
      expect(() => {
        const html = renderWithIntl(<SettingsPage />, 'th');
        expect(html).toContain('กำลังโหลด...');
      }).not.toThrow();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders all pages in unready state when LIFF is not yet initialized', () => {
      mockUseLiff.mockReturnValue({
        isReady: false,
        userId: null,
        displayName: null,
        language: 'th',
        isInClient: false,
        idToken: null,
        error: null,
      });

      mockUseLiffData.mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refresh: vi.fn(),
        deleteItem: vi.fn(),
      });

      const pages = [
        <DashboardPage key="dashboard" />,
        <TimerPage key="timer" />,
        <RemindersPage key="reminders" />,
        <NotesPage key="notes" />,
        <SettingsPage key="settings" />,
      ];

      for (const page of pages) {
        expect(() => {
          const html = renderWithIntl(page, 'th');
          expect(html).toContain('กำลังโหลด...');
        }).not.toThrow();
      }

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Empty States (Zero Items)', () => {
    beforeEach(() => {
      mockUseLiffData.mockReturnValue({
        data: { alarms: [], reminders: [], notes: [] },
        loading: false,
        error: null,
        refresh: vi.fn(),
        deleteItem: vi.fn(),
      });
    });

    it('renders Dashboard empty state properly in Thai and English', () => {
      // Thai
      const thHtml = renderWithIntl(<DashboardPage />, 'th');
      expect(thHtml).toContain(thMessages.dashboard.mine);
      expect(thHtml).toContain(thMessages.dashboard.upcoming);
      expect(thHtml).toContain(thMessages.dashboard.recentNotes);
      expect(thHtml).toContain(thMessages.dashboard.emptyUpcomingTitle);
      expect(thHtml).toContain('/th/liff/timer');
      expect(thHtml).not.toContain('/th/liff/alarms');

      // English
      const enHtml = renderWithIntl(<DashboardPage />, 'en');
      expect(enHtml).toContain(enMessages.dashboard.mine);
      expect(enHtml).toContain(enMessages.dashboard.upcoming);
      expect(enHtml).toContain(enMessages.dashboard.recentNotes);
      expect(enHtml).toContain(enMessages.dashboard.emptyUpcomingTitle);
      expect(enHtml).toContain('/en/liff/timer');
      expect(enHtml).not.toContain('/en/liff/alarms');

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders Timer empty state properly', () => {
      const html = renderWithIntl(<TimerPage />, 'th');
      expect(html).toContain(thMessages.dashboard.timer);
      expect(html).toContain(thMessages.dashboard.emptyTimersTitle);
      expect(html).toContain('ไปที่แชต');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders Reminders empty state properly', () => {
      const html = renderWithIntl(<RemindersPage />, 'th');
      expect(html).toContain(thMessages.dashboard.reminders);
      expect(html).toContain(thMessages.dashboard.emptyRemindersTitle);
      expect(html).toContain('ไปที่แชต');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders Notes empty state properly', () => {
      const html = renderWithIntl(<NotesPage />, 'th');
      expect(html).toContain(thMessages.dashboard.notes);
      expect(html).toContain(thMessages.dashboard.emptyNotesTitle);
      expect(html).toContain('ไปที่แชต');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders Settings page properly with user profile info', () => {
      const html = renderWithIntl(<SettingsPage />, 'th');
      expect(html).toContain('ตั้งค่า');
      expect(html).toContain('คุณยายสมศรี');
      expect(html).toContain('test-user-001');
      expect(html).toContain('🇹🇭 ภาษาไทย');
      expect(html).toContain('🇬🇧 English');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Populated Normal States', () => {
    const populatedData = {
      alarms: [
        {
          id: 'alarm-1',
          time: '07:00',
          label: 'ตื่นนอน',
          recurrence: 'daily',
          enabled: true,
          nextFireAt: new Date('2026-10-23T00:00:00.000Z'),
        },
        {
          id: 'alarm-2',
          time: '12:30',
          label: 'ทานยาหลังอาหาร',
          recurrence: 'once',
          enabled: true,
          nextFireAt: new Date('2026-10-23T05:30:00.000Z'),
        },
      ],
      reminders: [
        {
          id: 'rem-1',
          message: 'ไปหาหมอที่โรงพยาบาล',
          scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
          nextFireAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
          status: 'pending',
          recurrence: 'once',
        },
        {
          id: 'rem-2',
          message: 'ออกกำลังกายยามเช้า',
          scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          nextFireAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'pending',
          recurrence: 'daily',
        },
      ],
      notes: [
        {
          id: 'note-1',
          content: 'ซื้อนมสดและกล้วยน้ำว้า',
          summary: 'ซื้อนมสดและกล้วยน้ำว้า',
          source: 'voice',
          createdAt: new Date('2026-10-22T08:00:00.000Z'),
        },
        {
          id: 'note-2',
          content: 'นัดช่างมาซ่อมแอร์วันเสาร์',
          summary: 'นัดช่างมาซ่อมแอร์วันเสาร์',
          source: 'text',
          createdAt: new Date('2026-10-21T08:00:00.000Z'),
        },
      ],
    };

    beforeEach(() => {
      mockUseLiffData.mockReturnValue({
        data: populatedData,
        loading: false,
        error: null,
        refresh: vi.fn(),
        deleteItem: vi.fn(),
      });
    });

    it('renders Dashboard with items, categories, and recent notes', () => {
      const html = renderWithIntl(<DashboardPage />, 'th');
      expect(html).toContain('07:00');
      expect(html).toContain('ตื่นนอน');
      expect(html).toContain('ไปหาหมอที่โรงพยาบาล');
      expect(html).toContain('ซื้อนมสดและกล้วยน้ำว้า');
      expect(html).toContain('นัดช่างมาซ่อมแอร์วันเสาร์');
      expect(html).toContain('/th/liff/timer');
      expect(html).not.toContain('/th/liff/alarms');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders TimerPage with all timers', () => {
      const html = renderWithIntl(<TimerPage />, 'th');
      expect(html).toContain('07:00');
      expect(html).toContain('ตื่นนอน');
      expect(html).toContain('12:30');
      expect(html).toContain('ทานยาหลังอาหาร');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders RemindersPage with grouped timeline', () => {
      const html = renderWithIntl(<RemindersPage />, 'th');
      expect(html).toContain('ไปหาหมอที่โรงพยาบาล');
      expect(html).toContain('ออกกำลังกายยามเช้า');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('renders NotesPage with date grouped notes', () => {
      const html = renderWithIntl(<NotesPage />, 'th');
      expect(html).toContain('ซื้อนมสดและกล้วยน้ำว้า');
      expect(html).toContain('นัดช่างมาซ่อมแอร์วันเสาร์');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('Regression: Commit 2a51318 Defect (Timer without alarm.time & Edge Case Data)', () => {
    /**
     * In commit 2a513185e61177ad58df5db993570dad79a573f0:
     * When an alarm had time=undefined (e.g. TimerDoc with durationMinutes: 15),
     * the frontend crashed with:
     * `TypeError: Cannot read properties of undefined (reading 'split')`
     * and console errors appeared.
     */
    it('safely renders DashboardPage and AlarmsPage with timer documents and undefined time', () => {
      const timerDocAlarm = {
        id: 'timer-abc-123',
        time: undefined as unknown as string,
        durationMinutes: 15,
        enabled: true,
        status: 'active',
        nextFireAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      const minimalTimerAlarm = {
        id: 'timer-minimal',
        time: undefined,
        durationMinutes: 5,
        enabled: true,
        nextFireAt: null,
      };

      const alarmWithNoTimeOrDuration = {
        id: 'corrupt-alarm',
        time: undefined,
        durationMinutes: undefined,
        label: 'Alarm without time',
        enabled: true,
      };

      mockUseLiffData.mockReturnValue({
        data: {
          alarms: [timerDocAlarm, minimalTimerAlarm, alarmWithNoTimeOrDuration],
          reminders: [],
          notes: [],
        },
        loading: false,
        error: null,
        refresh: vi.fn(),
        deleteItem: vi.fn(),
      });

      // DashboardPage should NOT throw 'split' of undefined and must include timer item
      expect(() => {
        const dashboardHtml = renderWithIntl(<DashboardPage />, 'th');
        expect(dashboardHtml).toContain('จับเวลา 15 นาที');
      }).not.toThrow();

      // TimerPage should NOT throw and should render timer duration badge
      expect(() => {
        const timerHtml = renderWithIntl(<TimerPage />, 'th');
        expect(timerHtml).toContain('15');
      }).not.toThrow();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('safely handles Firestore timestamps in both _seconds and seconds formats, and corrupt dates', () => {
      const mixedData = {
        alarms: [
          {
            id: 'alarm-underscore-seconds',
            time: '08:00',
            nextFireAt: { _seconds: 1729300000 },
            enabled: true,
          },
          {
            id: 'alarm-regular-seconds',
            time: '09:00',
            nextFireAt: { seconds: 1729300000 },
            enabled: true,
          },
          {
            id: 'alarm-toDate',
            time: '10:00',
            nextFireAt: { toDate: () => new Date('2026-10-22T10:00:00.000Z') },
            enabled: true,
          },
          {
            id: 'alarm-null-date',
            time: '11:00',
            nextFireAt: null,
            enabled: true,
          },
        ],
        reminders: [
          {
            id: 'rem-snoozed',
            message: 'ทานยาน้ำ',
            status: 'snoozed',
            nextFireAt: { _seconds: 1729300000 },
          },
          {
            id: 'rem-corrupt-date',
            message: 'นัดหมาย',
            scheduledAt: 'not-a-valid-date',
            status: 'active',
          },
        ],
        notes: [
          {
            id: 'note-corrupt-time',
            summary: 'โน้ตเวลาแปลก',
            createdAt: 'invalid-date',
          },
        ],
      };

      mockUseLiffData.mockReturnValue({
        data: mixedData,
        loading: false,
        error: null,
        refresh: vi.fn(),
        deleteItem: vi.fn(),
      });

      const pages = [
        <DashboardPage key="dashboard" />,
        <TimerPage key="timer" />,
        <RemindersPage key="reminders" />,
        <NotesPage key="notes" />,
      ];

      for (const page of pages) {
        expect(() => {
          renderWithIntl(page, 'th');
          renderWithIntl(page, 'en');
        }).not.toThrow();
      }

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe('LiffLayout and Locale Root Page', () => {
    it('renders children within LiffLayout cleanly', () => {
      const html = renderToStaticMarkup(
        <LiffLayout>
          <div data-testid="test-child">Layout Child Content</div>
        </LiffLayout>,
      );
      expect(html).toContain('Layout Child Content');
    });

    it('renders LocaleHomePage without errors', () => {
      const html = renderWithIntl(<LocaleHomePage />, 'th');
      expect(html).toContain('หน้าหลัก');
      expect(html).toContain('กำลังโหลด...');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});
