import { describe, it, expect } from 'vitest';
import thMessages from '../../../../messages/th.json';
import enMessages from '../../../../messages/en.json';
import { locales, defaultLocale } from '@/lib/i18n/config';

describe('i18n Message Catalogs & Config', () => {
  it('should define supported locales and default locale', () => {
    expect(locales).toContain('th');
    expect(locales).toContain('en');
    expect(defaultLocale).toBe('th');
  });

  it('should have identical namespaces in Thai and English dictionaries', () => {
    const thNamespaces = Object.keys(thMessages).sort();
    const enNamespaces = Object.keys(enMessages).sort();
    expect(thNamespaces).toEqual(enNamespaces);
  });

  it('should have 100% key parity in dashboard messages', () => {
    const thKeys = Object.keys(thMessages.dashboard).sort();
    const enKeys = Object.keys(enMessages.dashboard).sort();
    expect(thKeys).toEqual(enKeys);
  });

  it('should have 100% key parity in errors messages', () => {
    const thKeys = Object.keys(thMessages.errors).sort();
    const enKeys = Object.keys(enMessages.errors).sort();
    expect(thKeys).toEqual(enKeys);
  });

  it('should include all required keys for Notes and Settings pages', () => {
    const requiredDashboardKeys = [
      'notes',
      'emptyNotesTitle',
      'emptyNotesHint',
      'voiceSource',
      'textSource',
      'tip',
      'settings',
      'profile',
      'name',
      'userId',
      'language',
      'thai',
      'english',
      'appInfo',
      'version',
      'appDescription',
      'voiceAssistantBadge',
      'back',
      'delete',
      'confirmDeleteTitle',
      'confirmDeleteMessage',
      'cancel',
      'loading',
    ];

    for (const key of requiredDashboardKeys) {
      expect(thMessages.dashboard).toHaveProperty(key);
      expect(enMessages.dashboard).toHaveProperty(key);
      expect((thMessages.dashboard as Record<string, string>)[key]).toBeTruthy();
      expect((enMessages.dashboard as Record<string, string>)[key]).toBeTruthy();
    }
  });

  it('should include all required keys for Alarms page', () => {
    const requiredAlarmKeys = [
      'alarms',
      'alarmsSubtitle',
      'emptyAlarmsTitle',
      'emptyAlarmsHintLine1',
      'emptyAlarmsHintLine2',
      'alarmEnabled',
      'alarmDisabled',
      'nextAlarm',
      'confirmDeleteAlarmTitle',
      'deleteAlarm',
      'alarmDeletedToast',
      'tipAlarmTitle',
      'tipAlarmHint',
      'weekdays',
      'weekends',
      'dayOfMonth',
    ];

    for (const key of requiredAlarmKeys) {
      expect(thMessages.dashboard).toHaveProperty(key);
      expect(enMessages.dashboard).toHaveProperty(key);
      expect((thMessages.dashboard as Record<string, string>)[key]).toBeTruthy();
      expect((enMessages.dashboard as Record<string, string>)[key]).toBeTruthy();
    }
  });

  it('should include all required keys for Reminders page', () => {
    const requiredReminderKeys = [
      'reminders',
      'remindersSubtitle',
      'emptyRemindersTitle',
      'emptyRemindersHintLine1',
      'emptyRemindersHintLine2',
      'confirmDeleteReminderTitle',
      'deleteReminder',
      'reminderDeletedToast',
      'completedRemindersHidden',
      'willRemindAgain',
      'later',
    ];

    for (const key of requiredReminderKeys) {
      expect(thMessages.dashboard).toHaveProperty(key);
      expect(enMessages.dashboard).toHaveProperty(key);
      expect((thMessages.dashboard as Record<string, string>)[key]).toBeTruthy();
      expect((enMessages.dashboard as Record<string, string>)[key]).toBeTruthy();
    }
  });
});
