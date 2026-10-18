import { describe, it, expect } from 'vitest';
import {
  buildNoteConfirmation,
  buildAlarmNotification,
  buildReminderNotification,
} from '@/lib/line/flex-messages';
import type { messagingApi } from '@line/bot-sdk';

describe('Flex Message Builders (LINE-04)', () => {
  describe('buildNoteConfirmation', () => {
    it('generates a valid Note Confirmation Flex message with accessible layout', () => {
      const summary = 'ไปพบแพทย์ที่โรงพยาบาลศิริราช เวลา 10:00 น.';
      const flex = buildNoteConfirmation(summary);

      expect(flex.type).toBe('flex');
      expect(flex.altText).toBe(`📝 สรุปบันทึก: ${summary}`);

      const bubble = flex.contents as messagingApi.FlexBubble;
      expect(bubble.type).toBe('bubble');
      expect(bubble.size).toBe('kilo');

      // Header check
      const headerBox = bubble.header as messagingApi.FlexBox;
      expect(headerBox.layout).toBe('vertical');
      const headerText = headerBox.contents[0] as messagingApi.FlexText;
      expect(headerText.text).toBe('📝 สรุปบันทึก');
      expect(headerText.size).toBe('xl');
      expect(headerText.color).toBe('#6A1B9A');

      // Body check
      const bodyBox = bubble.body as messagingApi.FlexBox;
      expect(bodyBox.layout).toBe('vertical');
      const summaryText = bodyBox.contents[0] as messagingApi.FlexText;
      expect(summaryText.text).toBe(summary);
      expect(summaryText.size).toBe('lg');
      expect(summaryText.color).toBe('#2D2D2D');

      const promptText = bodyBox.contents[1] as messagingApi.FlexText;
      expect(promptText.text).toBe('ต้องการบันทึกไหมคะ?');
      expect(promptText.size).toBe('md');
      expect(promptText.color).toBe('#4A4A4A');

      // Footer check (vertical layout with >= 48px buttons)
      const footerBox = bubble.footer as messagingApi.FlexBox;
      expect(footerBox.layout).toBe('vertical');
      expect(footerBox.spacing).toBe('md');
      expect(footerBox.contents).toHaveLength(2);

      const saveButton = footerBox.contents[0] as messagingApi.FlexButton;
      expect(saveButton.type).toBe('button');
      expect(saveButton.style).toBe('primary');
      expect(saveButton.color).toBe('#06C755');
      expect(saveButton.height).toBe('md');
      expect((saveButton.action as messagingApi.MessageAction).label).toBe('✓ บันทึกเลย');
      expect((saveButton.action as messagingApi.MessageAction).text).toBe('บันทึกเลย');

      const cancelButton = footerBox.contents[1] as messagingApi.FlexButton;
      expect(cancelButton.type).toBe('button');
      expect(cancelButton.style).toBe('secondary');
      expect(cancelButton.height).toBe('md');
      expect((cancelButton.action as messagingApi.MessageAction).label).toBe('✕ ยกเลิก');
      expect((cancelButton.action as messagingApi.MessageAction).text).toBe('ยกเลิก');
    });
  });

  describe('buildAlarmNotification', () => {
    it('generates a valid Alarm notification Flex message with 5m snooze and dismiss buttons', () => {
      const alarmLabel = 'กินยาลดความดัน';
      const alarmId = 'alarm-test-123';
      const flex = buildAlarmNotification(alarmLabel, alarmId);

      expect(flex.type).toBe('flex');
      expect(flex.altText).toBe(`⏰ ถึงเวลาแล้ว: ${alarmLabel}`);

      const bubble = flex.contents as messagingApi.FlexBubble;
      expect(bubble.type).toBe('bubble');
      expect(bubble.size).toBe('kilo');

      // Header check
      const headerBox = bubble.header as messagingApi.FlexBox;
      const headerTitle = headerBox.contents[1] as messagingApi.FlexText;
      expect(headerTitle.text).toBe('ถึงเวลาแล้วค่ะ!');
      expect(headerTitle.size).toBe('xl');
      expect(headerTitle.color).toBe('#E65100');

      // Body check
      const bodyBox = bubble.body as messagingApi.FlexBox;
      const labelText = bodyBox.contents[0] as messagingApi.FlexText;
      expect(labelText.text).toBe(alarmLabel);
      expect(labelText.size).toBe('xl');
      expect(labelText.weight).toBe('bold');
      expect(labelText.color).toBe('#2D2D2D');

      // Footer check
      const footerBox = bubble.footer as messagingApi.FlexBox;
      expect(footerBox.layout).toBe('vertical');
      expect(footerBox.spacing).toBe('md');
      expect(footerBox.contents).toHaveLength(2);

      const snoozeButton = footerBox.contents[0] as messagingApi.FlexButton;
      expect(snoozeButton.type).toBe('button');
      expect(snoozeButton.style).toBe('secondary');
      expect(snoozeButton.height).toBe('md');
      expect((snoozeButton.action as messagingApi.MessageAction).label).toBe('⏸ เลื่อน 5 นาที');
      expect((snoozeButton.action as messagingApi.MessageAction).text).toBe(
        `snooze_alarm:${alarmId}`,
      );

      const dismissButton = footerBox.contents[1] as messagingApi.FlexButton;
      expect(dismissButton.type).toBe('button');
      expect(dismissButton.style).toBe('primary');
      expect(dismissButton.color).toBe('#06C755');
      expect(dismissButton.height).toBe('md');
      expect((dismissButton.action as messagingApi.MessageAction).label).toBe('✓ ปิดปลุก');
      expect((dismissButton.action as messagingApi.MessageAction).text).toBe(
        `dismiss_alarm:${alarmId}`,
      );
    });
  });

  describe('buildReminderNotification', () => {
    it('generates a valid Reminder notification Flex message with 15m snooze and done buttons', () => {
      const reminderMsg = 'รดน้ำต้นไม้หน้าบ้าน';
      const reminderId = 'rem-test-456';
      const flex = buildReminderNotification(reminderMsg, reminderId);

      expect(flex.type).toBe('flex');
      expect(flex.altText).toBe(`📋 แจ้งเตือน: ${reminderMsg}`);

      const bubble = flex.contents as messagingApi.FlexBubble;
      expect(bubble.type).toBe('bubble');
      expect(bubble.size).toBe('kilo');

      // Header check
      const headerBox = bubble.header as messagingApi.FlexBox;
      const headerTitle = headerBox.contents[1] as messagingApi.FlexText;
      expect(headerTitle.text).toBe('แจ้งเตือน');
      expect(headerTitle.size).toBe('xl');
      expect(headerTitle.color).toBe('#1565C0');

      // Body check
      const bodyBox = bubble.body as messagingApi.FlexBox;
      const msgText = bodyBox.contents[0] as messagingApi.FlexText;
      expect(msgText.text).toBe(reminderMsg);
      expect(msgText.size).toBe('xl');
      expect(msgText.weight).toBe('bold');
      expect(msgText.color).toBe('#2D2D2D');

      // Footer check
      const footerBox = bubble.footer as messagingApi.FlexBox;
      expect(footerBox.layout).toBe('vertical');
      expect(footerBox.spacing).toBe('md');
      expect(footerBox.contents).toHaveLength(2);

      const snoozeButton = footerBox.contents[0] as messagingApi.FlexButton;
      expect(snoozeButton.type).toBe('button');
      expect(snoozeButton.style).toBe('secondary');
      expect(snoozeButton.height).toBe('md');
      expect((snoozeButton.action as messagingApi.MessageAction).label).toBe('⏸ เลื่อน 15 นาที');
      expect((snoozeButton.action as messagingApi.MessageAction).text).toBe(
        `snooze_reminder:${reminderId}`,
      );

      const dismissButton = footerBox.contents[1] as messagingApi.FlexButton;
      expect(dismissButton.type).toBe('button');
      expect(dismissButton.style).toBe('primary');
      expect(dismissButton.color).toBe('#06C755');
      expect(dismissButton.height).toBe('md');
      expect((dismissButton.action as messagingApi.MessageAction).label).toBe('✓ เรียบร้อย');
      expect((dismissButton.action as messagingApi.MessageAction).text).toBe(
        `dismiss_reminder:${reminderId}`,
      );
    });
  });
});
