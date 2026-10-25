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
          size: 'xl',
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
          size: 'lg',
          wrap: true,
          color: '#2D2D2D',
        },
        {
          type: 'text',
          text: 'ต้องการบันทึกไหมคะ?',
          size: 'md',
          color: '#4A4A4A',
          margin: 'lg',
          align: 'center',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: 'lg',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#06C755',
          height: 'md',
          action: {
            type: 'message',
            label: '✓ บันทึกเลย',
            text: 'บันทึกเลย',
          },
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'md',
          action: {
            type: 'message',
            label: '✕ ยกเลิก',
            text: 'ยกเลิก',
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
 * Builds an interactive Flex Message bubble asking the elderly user to confirm or edit
 * a scheduled reminder, equipped with a native LINE datetime picker.
 */
export function buildReminderConfirmation(
  message: string,
  formattedTime: string,
  initialDatetime: string,
): messagingApi.FlexMessage {
  const bubble: messagingApi.FlexBubble = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      backgroundColor: '#E8F5E9',
      contents: [
        {
          type: 'text',
          text: '⏰ ยืนยันการแจ้งเตือน',
          weight: 'bold',
          size: 'xl',
          color: '#2E7D32',
          align: 'center',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      spacing: 'md',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'สิ่งที่ให้เตือน:',
              size: 'sm',
              color: '#757575',
            },
            {
              type: 'text',
              text: message,
              size: 'lg',
              weight: 'bold',
              wrap: true,
              color: '#2D2D2D',
            },
          ],
        },
        {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'เวลาแจ้งเตือน:',
              size: 'sm',
              color: '#757575',
            },
            {
              type: 'text',
              text: formattedTime,
              size: 'lg',
              weight: 'bold',
              color: '#06C755',
            },
          ],
        },
        {
          type: 'text',
          text: 'ต้องการตั้งเตือนเวลานี้ไหมคะ?',
          size: 'md',
          color: '#4A4A4A',
          margin: 'md',
          align: 'center',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: 'lg',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: '#06C755',
          height: 'md',
          action: {
            type: 'message',
            label: '✓ ยืนยัน',
            text: 'ยืนยันเตือน',
          },
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'md',
          action: {
            type: 'datetimepicker',
            label: '✏️ เปลี่ยนเวลา',
            data: 'action=change_reminder_time',
            mode: 'datetime',
            initial: initialDatetime,
          },
        },
        {
          type: 'button',
          style: 'secondary',
          height: 'md',
          action: {
            type: 'message',
            label: '✕ ยกเลิก',
            text: 'ยกเลิก',
          },
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `⏰ ยืนยันเตือน: ${message} เวลา ${formattedTime}`,
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
      contents: [{ type: 'text', text: '⏰', size: '3xl', align: 'center' }],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      contents: [
        {
          type: 'text',
          text: label,
          size: 'xl',
          wrap: true,
          align: 'center',
          weight: 'bold',
          color: '#2D2D2D',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: 'lg',
      contents: [
        {
          type: 'button',
          style: 'secondary',
          height: 'md',
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
          action: {
            type: 'message',
            label: '✓ ปิดการปลุก',
            text: `dismiss_alarm:${alarmId}`,
          },
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `⏰ นาฬิกาปลุก: ${label}`,
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
      backgroundColor: '#E8F5E9',
      contents: [{ type: 'text', text: '📋', size: '3xl', align: 'center' }],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      contents: [
        {
          type: 'text',
          text: message,
          size: 'xl',
          wrap: true,
          align: 'center',
          weight: 'bold',
          color: '#2D2D2D',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      paddingAll: 'lg',
      contents: [
        {
          type: 'button',
          style: 'secondary',
          height: 'md',
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
