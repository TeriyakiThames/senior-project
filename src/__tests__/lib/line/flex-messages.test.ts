import { describe, it, expect } from 'vitest';
import {
  buildNoteConfirmation,
  buildReminderConfirmation,
  buildAlarmNotification,
  buildTimerNotification,
  buildTimerConfirmationCard,
  buildReminderNotification,
} from '@/lib/line/flex-messages';
import type { messagingApi } from '@line/bot-sdk';

describe('Flex Message Builders (LINE-04, LINE-07)', () => {
  describe('buildNoteConfirmation', () => {
    it('generates a valid Note Confirmation Flex message with voice tagging by default', () => {
      const summary = 'ไปพบแพทย์ที่โรงพยาบาลศิริราช เวลา 10:00 น.';
      const flex = buildNoteConfirmation(summary);

      expect(flex.type).toBe('flex');
      expect(flex.altText).toBe(`📝 สรุปบันทึก: ${summary}`);

      const bubble = flex.contents as messagingApi.FlexBubble;
      expect(bubble.type).toBe('bubble');
      expect(bubble.size).toBe('kilo');

      // Header check (horizontal layout with note icon and title)
      const headerBox = bubble.header as messagingApi.FlexBox;
      expect(headerBox.layout).toBe('horizontal');
      expect(headerBox.backgroundColor).toBe('#EEE1FA');
      const headerIcon = headerBox.contents[0] as messagingApi.FlexText;
      expect(headerIcon.text).toBe('📝');
      const headerText = headerBox.contents[1] as messagingApi.FlexText;
      expect(headerText.text).toBe('บันทึกโน้ตนี้ไหมคะ');
      expect(headerText.size).toBe('xl');
      expect(headerText.color).toBe('#21215C');

      // Body check (tag pill, summary text, subtext)
      const bodyBox = bubble.body as messagingApi.FlexBox;
      expect(bodyBox.layout).toBe('vertical');
      expect(bodyBox.contents).toHaveLength(3);

      const tagContainer = bodyBox.contents[0] as messagingApi.FlexBox;
      const tagPill = tagContainer.contents[0] as messagingApi.FlexBox;
      expect(tagPill.backgroundColor).toBe('#EAF0F6');
      const tagText = tagPill.contents[0] as messagingApi.FlexText;
      expect(tagText.text).toBe('🎤 เสียง');
      expect(tagText.color).toBe('#21215C');

      const summaryText = bodyBox.contents[1] as messagingApi.FlexText;
      expect(summaryText.text).toBe(summary);
      expect(summaryText.size).toBe('xl');
      expect(summaryText.color).toBe('#21215C');

      const promptText = bodyBox.contents[2] as messagingApi.FlexText;
      expect(promptText.text).toBe('ถ้าไม่กดภายใน 5 นาที\nจะยังไม่บันทึกนะคะ');
      expect(promptText.size).toBe('md');
      expect(promptText.color).toBe('#7D84A3');

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

    it('generates a valid Note Confirmation Flex message with typing tag when source is text', () => {
      const summary = 'ซื้อขนมเปี๊ยว';
      const flex = buildNoteConfirmation(summary, 'text');

      const bubble = flex.contents as messagingApi.FlexBubble;
      const bodyBox = bubble.body as messagingApi.FlexBox;
      const tagContainer = bodyBox.contents[0] as messagingApi.FlexBox;
      const tagPill = tagContainer.contents[0] as messagingApi.FlexBox;
      expect(tagPill.backgroundColor).toBe('#EAF0F6');
      const tagText = tagPill.contents[0] as messagingApi.FlexText;
      expect(tagText.text).toBe('⌨️ พิมพ์');
      expect(tagText.color).toBe('#21215C');
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
      expect(headerBox.backgroundColor).toBe('#E1E8F8');
      const headerText = headerBox.contents[0] as messagingApi.FlexText;
      expect(headerText.text).toBe('⏰ ยืนยันการแจ้งเตือน');
      expect(headerText.color).toBe('#385289');

      // Body check
      const bodyBox = bubble.body as messagingApi.FlexBox;
      expect(bodyBox.contents).toHaveLength(3);
      const itemBox = bodyBox.contents[0] as messagingApi.FlexBox;
      const msgText = itemBox.contents[1] as messagingApi.FlexText;
      expect(msgText.color).toBe('#21215C');

      const timeBox = bodyBox.contents[1] as messagingApi.FlexBox;
      const timeText = timeBox.contents[1] as messagingApi.FlexText;
      expect(timeText.color).toBe('#385289');

      const promptText = bodyBox.contents[2] as messagingApi.FlexText;
      expect(promptText.color).toBe('#4B4F72');

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
      expect(headerBox.backgroundColor).toBe('#FBEFD8');
      const headerIcon = headerBox.contents[0] as messagingApi.FlexText;
      expect(headerIcon.text).toBe('⏰');

      // Body check
      const bodyBox = bubble.body as messagingApi.FlexBox;
      const labelText = bodyBox.contents[0] as messagingApi.FlexText;
      expect(labelText.text).toBe(alarmLabel);
      expect(labelText.size).toBe('xl');
      expect(labelText.weight).toBe('bold');
      expect(labelText.color).toBe('#21215C');

      // Footer check
      const footerBox = bubble.footer as messagingApi.FlexBox;
      expect(footerBox.layout).toBe('vertical');
      expect(footerBox.spacing).toBe('md');
      expect(footerBox.contents).toHaveLength(2);

      const snoozeButton = footerBox.contents[0] as messagingApi.FlexButton;
      expect(snoozeButton.type).toBe('button');
      expect(snoozeButton.style).toBe('secondary');
      expect(snoozeButton.height).toBe('md');
      expect((snoozeButton.action as messagingApi.PostbackAction).type).toBe('postback');
      expect((snoozeButton.action as messagingApi.PostbackAction).label).toBe('⏸ เลื่อน 5 นาที');
      expect((snoozeButton.action as messagingApi.PostbackAction).data).toBe(
        `action=snooze_alarm&id=${alarmId}`,
      );
      expect((snoozeButton.action as messagingApi.PostbackAction).displayText).toBe(
        'เลื่อน 5 นาที',
      );

      const dismissButton = footerBox.contents[1] as messagingApi.FlexButton;
      expect(dismissButton.type).toBe('button');
      expect(dismissButton.style).toBe('primary');
      expect(dismissButton.color).toBe('#06C755');
      expect(dismissButton.height).toBe('md');
      expect((dismissButton.action as messagingApi.PostbackAction).type).toBe('postback');
      expect((dismissButton.action as messagingApi.PostbackAction).label).toBe('✓ ปิดการปลุก');
      expect((dismissButton.action as messagingApi.PostbackAction).data).toBe(
        `action=dismiss_alarm&id=${alarmId}`,
      );
      expect((dismissButton.action as messagingApi.PostbackAction).displayText).toBe('ปิดการปลุก');
    });
  });

  describe('buildTimerNotification', () => {
    it('generates a valid Timer notification Flex message with 15m snooze and dismiss buttons', () => {
      const timerLabel = 'ต้มไข่';
      const timerId = 'timer-test-123';
      const flex = buildTimerNotification(timerLabel, timerId, 'nid-1');

      expect(flex.type).toBe('flex');
      expect(flex.altText).toBe(`⏱️ ตัวจับเวลา: ${timerLabel}`);

      const bubble = flex.contents as messagingApi.FlexBubble;
      expect(bubble.type).toBe('bubble');
      expect(bubble.size).toBe('kilo');

      // Header check
      const headerBox = bubble.header as messagingApi.FlexBox;
      expect(headerBox.backgroundColor).toBe('#FBEFD8');
      const headerIcon = headerBox.contents[0] as messagingApi.FlexText;
      expect(headerIcon.text).toBe('⏱️');

      // Body check
      const bodyBox = bubble.body as messagingApi.FlexBox;
      const labelText = bodyBox.contents[0] as messagingApi.FlexText;
      expect(labelText.text).toBe(timerLabel);
      expect(labelText.size).toBe('xl');

      // Footer check
      const footerBox = bubble.footer as messagingApi.FlexBox;
      const snoozeButton = footerBox.contents[0] as messagingApi.FlexButton;
      expect((snoozeButton.action as messagingApi.PostbackAction).label).toBe('⏸ เลื่อน 15 นาที');
      expect((snoozeButton.action as messagingApi.PostbackAction).data).toBe(
        `action=snooze_timer&id=${timerId}&nid=nid-1`,
      );

      const dismissButton = footerBox.contents[1] as messagingApi.FlexButton;
      expect((dismissButton.action as messagingApi.PostbackAction).label).toBe('✓ ปิดตัวจับเวลา');
      expect((dismissButton.action as messagingApi.PostbackAction).data).toBe(
        `action=dismiss_timer&id=${timerId}&nid=nid-1`,
      );
    });
  });

  describe('buildTimerConfirmationCard', () => {
    it('generates a valid Timer confirmation Flex message with duration, trigger time, and delete button', () => {
      const durationText = '15 นาที';
      const timerId = 'timer-conf-123';
      const fireAt = new Date('2026-11-04T07:45:00.000Z'); // 14:45 Bangkok
      const flex = buildTimerConfirmationCard({
        durationText,
        fireAt,
        timerId,
      });

      expect(flex.type).toBe('flex');
      expect(flex.altText).toBe(`⏱️ เริ่มจับเวลา: ${durationText}`);

      const bubble = flex.contents as messagingApi.FlexBubble;
      expect(bubble.type).toBe('bubble');
      expect(bubble.size).toBe('kilo');

      // Header check
      const headerBox = bubble.header as messagingApi.FlexBox;
      expect(headerBox.backgroundColor).toBe('#FBEFD8');
      const headerIcon = headerBox.contents[0] as messagingApi.FlexText;
      expect(headerIcon.text).toBe('⏱️');
      const headerTitle = headerBox.contents[1] as messagingApi.FlexText;
      expect(headerTitle.text).toBe('เริ่มจับเวลาแล้วค่ะ');
      expect(headerTitle.color).toBe('#7A4E00');

      // Body check
      const bodyBox = bubble.body as messagingApi.FlexBox;
      const durationBox = bodyBox.contents[0] as messagingApi.FlexBox;
      const durationVal = durationBox.contents[1] as messagingApi.FlexText;
      expect(durationVal.text).toBe('15 นาที');

      const fireBox = bodyBox.contents[1] as messagingApi.FlexBox;
      const fireVal = fireBox.contents[1] as messagingApi.FlexText;
      expect(fireVal.text).toBe('14:45 น.');

      const promptText = bodyBox.contents[2] as messagingApi.FlexText;
      expect(promptText.text).toBe('เริ่มนับถอยหลังแล้วค่ะ หนูจะเตือนเมื่อครบเวลานะคะ ⏱️');

      // Footer check
      const footerBox = bubble.footer as messagingApi.FlexBox;
      expect(footerBox.contents).toHaveLength(1);
      const deleteButton = footerBox.contents[0] as messagingApi.FlexButton;
      expect(deleteButton.type).toBe('button');
      expect(deleteButton.style).toBe('secondary');
      expect((deleteButton.action as messagingApi.PostbackAction).type).toBe('postback');
      expect((deleteButton.action as messagingApi.PostbackAction).label).toBe('🗑️ ลบตัวจับเวลา');
      expect((deleteButton.action as messagingApi.PostbackAction).data).toBe(
        `action=delete_timer&id=${timerId}`,
      );
      expect((deleteButton.action as messagingApi.PostbackAction).displayText).toBe('ลบตัวจับเวลา');
    });

    it('includes label in body and altText when label is provided', () => {
      const durationText = '7 นาที';
      const timerId = 'timer-conf-456';
      const fireAt = new Date('2026-11-04T07:37:00.000Z');
      const flex = buildTimerConfirmationCard({
        durationText,
        fireAt,
        timerId,
        label: 'ต้มไข่',
      });

      expect(flex.altText).toBe('⏱️ เริ่มจับเวลา: 7 นาที (ต้มไข่)');

      const bubble = flex.contents as messagingApi.FlexBubble;
      const bodyBox = bubble.body as messagingApi.FlexBox;
      expect(bodyBox.contents).toHaveLength(4);

      const labelBox = bodyBox.contents[1] as messagingApi.FlexBox;
      const labelVal = labelBox.contents[1] as messagingApi.FlexText;
      expect(labelVal.text).toBe('ต้มไข่');
    });

    it('handles duration with hours and minutes properly', () => {
      const durationText = '1 ชั่วโมง 30 นาที';
      const timerId = 'timer-conf-hours';
      const fireAt = new Date('2026-11-04T09:00:00.000Z');
      const flex = buildTimerConfirmationCard({
        durationText,
        fireAt,
        timerId,
      });

      expect(flex.altText).toBe('⏱️ เริ่มจับเวลา: 1 ชั่วโมง 30 นาที');
      const bubble = flex.contents as messagingApi.FlexBubble;
      const bodyBox = bubble.body as messagingApi.FlexBox;
      const durationBox = bodyBox.contents[0] as messagingApi.FlexBox;
      const durationVal = durationBox.contents[1] as messagingApi.FlexText;
      expect(durationVal.text).toBe('1 ชั่วโมง 30 นาที');
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
      expect(headerBox.backgroundColor).toBe('#E1E8F8');
      const headerIcon = headerBox.contents[0] as messagingApi.FlexText;
      expect(headerIcon.text).toBe('📋');

      // Body check
      const bodyBox = bubble.body as messagingApi.FlexBox;
      const msgText = bodyBox.contents[0] as messagingApi.FlexText;
      expect(msgText.text).toBe(reminderMsg);
      expect(msgText.size).toBe('xl');
      expect(msgText.weight).toBe('bold');
      expect(msgText.color).toBe('#21215C');

      // Footer check
      const footerBox = bubble.footer as messagingApi.FlexBox;
      expect(footerBox.layout).toBe('vertical');
      expect(footerBox.spacing).toBe('md');
      expect(footerBox.contents).toHaveLength(2);

      const snoozeButton = footerBox.contents[0] as messagingApi.FlexButton;
      expect(snoozeButton.type).toBe('button');
      expect(snoozeButton.style).toBe('secondary');
      expect(snoozeButton.height).toBe('md');
      expect((snoozeButton.action as messagingApi.PostbackAction).type).toBe('postback');
      expect((snoozeButton.action as messagingApi.PostbackAction).label).toBe('⏸ เลื่อน 15 นาที');
      expect((snoozeButton.action as messagingApi.PostbackAction).data).toBe(
        `action=snooze_reminder&id=${reminderId}`,
      );
      expect((snoozeButton.action as messagingApi.PostbackAction).displayText).toBe(
        'เลื่อน 15 นาที',
      );

      const dismissButton = footerBox.contents[1] as messagingApi.FlexButton;
      expect(dismissButton.type).toBe('button');
      expect(dismissButton.style).toBe('primary');
      expect(dismissButton.color).toBe('#06C755');
      expect(dismissButton.height).toBe('md');
      expect((dismissButton.action as messagingApi.PostbackAction).type).toBe('postback');
      expect((dismissButton.action as messagingApi.PostbackAction).label).toBe('✓ เรียบร้อย');
      expect((dismissButton.action as messagingApi.PostbackAction).data).toBe(
        `action=dismiss_reminder&id=${reminderId}`,
      );
      expect((dismissButton.action as messagingApi.PostbackAction).displayText).toBe('เรียบร้อย');
    });

    it('embeds notificationId into action postback data when provided', () => {
      const flex = buildReminderNotification('กินยา', 'rem-123', 'notif-456');
      const bubble = flex.contents as messagingApi.FlexBubble;
      const footer = bubble.footer as messagingApi.FlexBox;

      const snoozeBtn = footer.contents[0] as messagingApi.FlexButton;
      expect((snoozeBtn.action as messagingApi.PostbackAction).data).toBe(
        'action=snooze_reminder&id=rem-123&nid=notif-456',
      );

      const dismissBtn = footer.contents[1] as messagingApi.FlexButton;
      expect((dismissBtn.action as messagingApi.PostbackAction).data).toBe(
        'action=dismiss_reminder&id=rem-123&nid=notif-456',
      );
    });
  });
});
