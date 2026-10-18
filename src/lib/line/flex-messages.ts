import type { messagingApi } from '@line/bot-sdk';

/**
 * Builds an interactive Flex Message bubble asking the elderly user to confirm or cancel
 * saving a voice note summary.
 */
export function buildNoteConfirmation(summary: string): messagingApi.FlexMessage {
  const bubble: messagingApi.FlexBubble = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      backgroundColor: '#F3E5F5',
      contents: [
        {
          type: 'text',
          text: '📝 สรุปบันทึก',
          weight: 'bold',
          size: 'lg',
          color: '#6A1B9A',
          align: 'center',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      contents: [
        {
          type: 'text',
          text: summary,
          size: 'md',
          wrap: true,
          color: '#333333',
        },
        {
          type: 'text',
          text: 'ต้องการบันทึกไหมคะ?',
          size: 'sm',
          color: '#888888',
          margin: 'lg',
          align: 'center',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      spacing: 'md',
      paddingAll: 'lg',
      contents: [
        {
          type: 'button',
          style: 'secondary',
          height: 'md',
          flex: 1,
          action: {
            type: 'message',
            label: '✕ ยกเลิก',
            text: 'ยกเลิก',
          },
        },
        {
          type: 'button',
          style: 'primary',
          color: '#06C755',
          height: 'md',
          flex: 1,
          action: {
            type: 'message',
            label: '✓ บันทึกเลย',
            text: 'บันทึกเลย',
          },
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `📝 สรุปบันทึก: ${summary}`,
    contents: bubble,
  };
}

/**
 * Builds an interactive Flex Message bubble for alarm notification with snooze (+5m) and dismiss buttons.
 */
export function buildAlarmNotification(label: string, alarmId: string): messagingApi.FlexMessage {
  const bubble: messagingApi.FlexBubble = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      backgroundColor: '#FFF3E0',
      contents: [
        { type: 'text', text: '⏰', size: '3xl', align: 'center' },
        {
          type: 'text',
          text: 'ถึงเวลาแล้วค่ะ!',
          weight: 'bold',
          size: 'xl',
          align: 'center',
          color: '#E65100',
          margin: 'sm',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      contents: [
        {
          type: 'text',
          text: label,
          size: 'lg',
          wrap: true,
          align: 'center',
          weight: 'bold',
          color: '#2D2D2D',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      spacing: 'md',
      paddingAll: 'lg',
      contents: [
        {
          type: 'button',
          style: 'secondary',
          height: 'md',
          flex: 1,
          action: {
            type: 'message',
            label: '⏸ เลื่อน 5 นาที',
            text: `snooze_alarm:${alarmId}`,
          },
        },
        {
          type: 'button',
          style: 'primary',
          color: '#06C755',
          height: 'md',
          flex: 1,
          action: {
            type: 'message',
            label: '✓ ปิดปลุก',
            text: `dismiss_alarm:${alarmId}`,
          },
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `⏰ ถึงเวลาแล้ว: ${label}`,
    contents: bubble,
  };
}

/**
 * Builds an interactive Flex Message bubble for reminder notification with snooze (+15m) and dismiss buttons.
 */
export function buildReminderNotification(
  message: string,
  reminderId: string,
): messagingApi.FlexMessage {
  const bubble: messagingApi.FlexBubble = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      backgroundColor: '#E3F2FD',
      contents: [
        { type: 'text', text: '📋', size: '3xl', align: 'center' },
        {
          type: 'text',
          text: 'แจ้งเตือน',
          weight: 'bold',
          size: 'xl',
          align: 'center',
          color: '#1565C0',
          margin: 'sm',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      contents: [
        {
          type: 'text',
          text: message,
          size: 'lg',
          wrap: true,
          weight: 'bold',
          color: '#2D2D2D',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'horizontal',
      spacing: 'md',
      paddingAll: 'lg',
      contents: [
        {
          type: 'button',
          style: 'secondary',
          height: 'md',
          flex: 1,
          action: {
            type: 'message',
            label: '⏸ เลื่อน 15 นาที',
            text: `snooze_reminder:${reminderId}`,
          },
        },
        {
          type: 'button',
          style: 'primary',
          color: '#06C755',
          height: 'md',
          flex: 1,
          action: {
            type: 'message',
            label: '✓ เรียบร้อย',
            text: `dismiss_reminder:${reminderId}`,
          },
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `📋 แจ้งเตือน: ${message}`,
    contents: bubble,
  };
}
