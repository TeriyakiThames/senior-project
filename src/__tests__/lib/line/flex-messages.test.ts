import { describe, it, expect } from 'vitest';
import {
  buildNoteConfirmation,
  buildReminderConfirmation,
  buildAlarmNotification,
  buildReminderNotification,
} from '@/lib/line/flex-messages';
import type { messagingApi } from '@line/bot-sdk';

describe('Flex Message Builders (LINE-04, LINE-07)', () => {
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

  describe('buildReminderConfirmation (LINE-07)', () => {
    it('generates a valid Reminder Confirmation Flex message with datetimepicker', () => {
      const message = 'กินยาลดความดัน';
      const timeStr = '19:00 น.';
      const initialDatetime = '2026-10-26T19:00';
      const flex = buildReminderConfirmation(message, timeStr, initialDatetime);

      expect(flex.type).toBe('flex');
      expect(flex.altText).toBe(`⏰ ยืนยันเตือน: ${message} เวลา ${timeStr}`);

      const bubble = flex.contents as messagingApi.FlexBubble;
      expect(bubble.type).toBe('bubble');
      expect(bubble.size).toBe('kilo');

      // Header check
      const headerBox = bubble.header as messagingApi.FlexBox;
      const headerText = headerBox.contents[0] as messagingApi.FlexText;
      expect(headerText.text).toBe('⏰ ยืนยันการแจ้งเตือน');

      // Body check
      const bodyBox = bubble.body as messagingApi.FlexBox;
      expect(bodyBox.contents).toHaveLength(3);

      // Footer check (Confirm button, Datetimepicker button, Cancel button)
      const footerBox = bubble.footer as messagingApi.FlexBox;
      expect(footerBox.contents).toHaveLength(3);

      const confirmBtn = footerBox.contents[0] as messagingApi.FlexButton;
      expect(confirmBtn.type).toBe('button');
      expect(confirmBtn.style).toBe('primary');
      expect(confirmBtn.color).toBe('#06C755');
      expect((confirmBtn.action as messagingApi.MessageAction).label).toBe('✓ ยืนยัน');
      expect((confirmBtn.action as messagingApi.MessageAction).text).toBe('ยืนยันเตือน');

      const datePickerBtn = footerBox.contents[1] as messagingApi.FlexButton;
      expect(datePickerBtn.type).toBe('button');
      expect(datePickerBtn.style).toBe('secondary');
      const dateAction = datePickerBtn.action as messagingApi.DatetimePickerAction;
      expect(dateAction.type).toBe('datetimepicker');
      expect(dateAction.label).toBe('✏️ เปลี่ยนเวลา');
      expect(dateAction.data).toBe('action=change_reminder_time');
      expect(dateAction.mode).toBe('datetime');
      expect(dateAction.initial).toBe(initialDatetime);

      const cancelBtn = footerBox.contents[2] as messagingApi.FlexButton;
      expect(cancelBtn.type).toBe('button');
      expect(cancelBtn.style).toBe('secondary');
      expect((cancelBtn.action as messagingApi.MessageAction).label).toBe('✕ ยกเลิก');
      expect((cancelBtn.action as messagingApi.MessageAction).text).toBe('ยกเลิก');
    });
  });

  describe('buildAlarmNotification', () => {
    it('generates a valid Alarm notification Flex message with 5m snooze and dismiss buttons', () => {
      const alarmLabel = 'กินยาลดความดัน';
      const alarmId = 'alarm-test-123';
      const flex = buildAlarmNotification(alarmLabel, alarmId);

      expect(flex.type).toBe('flex');
      expect(flex.altText).toBe(`⏰ นาฬิกาปลุก: ${alarmLabel}`);

      const bubble = flex.contents as messagingApi.FlexBubble;
      expect(bubble.type).toBe('bubble');
      expect(bubble.size).toBe('kilo');

      // Header check
      const headerBox = bubble.header as messagingApi.FlexBox;
      const headerIcon = headerBox.contents[0] as messagingApi.FlexText;
      expect(headerIcon.text).toBe('⏰');

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
      expect((dismissButton.action as messagingApi.MessageAction).label).toBe('✓ ปิดการปลุก');
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
      const headerIcon = headerBox.contents[0] as messagingApi.FlexText;
      expect(headerIcon.text).toBe('📋');

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
