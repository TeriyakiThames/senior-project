import type { messagingApi } from '@line/bot-sdk';

/**
 * Builds an interactive Flex Message bubble asking the elderly user to confirm or cancel
 * saving a voice or typed note summary, styled with an input method source badge (🎤 เสียง / ⌨️ พิมพ์).
 */
export function buildNoteConfirmation(
  summary: string,
  source: 'voice' | 'text' = 'voice',
): messagingApi.FlexMessage {
  const isVoice = source === 'voice';

  const bubble: messagingApi.FlexBubble = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'horizontal',
      paddingAll: 'lg',
      backgroundColor: '#EEE1FA',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: '📝',
          size: 'xl',
          flex: 0,
        },
        {
          type: 'text',
          text: 'บันทึกโน้ตนี้ไหมคะ',
          weight: 'bold',
          size: 'xl',
          color: '#21215C',
          gravity: 'center',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              backgroundColor: '#EAF0F6',
              cornerRadius: 'xxl',
              paddingTop: 'sm',
              paddingBottom: 'sm',
              paddingStart: 'md',
              paddingEnd: 'md',
              flex: 0,
              contents: [
                {
                  type: 'text',
                  text: isVoice ? '🎤 เสียง' : '⌨️ พิมพ์',
                  size: 'sm',
                  weight: 'bold',
                  color: '#21215C',
                  flex: 0,
                },
              ],
            },
          ],
        },
        {
          type: 'text',
          text: summary,
          size: 'xl',
          wrap: true,
          color: '#21215C',
          weight: 'bold',
          margin: 'md',
        },
        {
          type: 'text',
          text: 'ถ้าไม่กดภายใน 5 นาที\nจะยังไม่บันทึกนะคะ',
          size: 'md',
          color: '#7D84A3',
          margin: 'lg',
          wrap: true,
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
      backgroundColor: '#E1E8F8',
      contents: [
        {
          type: 'text',
          text: '⏰ ยืนยันการแจ้งเตือน',
          weight: 'bold',
          size: 'xl',
          color: '#385289',
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
              color: '#7D84A3',
            },
            {
              type: 'text',
              text: message,
              size: 'lg',
              weight: 'bold',
              wrap: true,
              color: '#21215C',
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
              color: '#7D84A3',
            },
            {
              type: 'text',
              text: formattedTime,
              size: 'lg',
              weight: 'bold',
              color: '#385289',
            },
          ],
        },
        {
          type: 'text',
          text: 'ต้องการตั้งเตือนเวลานี้ไหมคะ?',
          size: 'md',
          color: '#4B4F72',
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
export function buildAlarmNotification(
  label: string,
  alarmId: string,
  notificationId?: string,
): messagingApi.FlexMessage {
  const snoozeData = notificationId
    ? `action=snooze_alarm&id=${alarmId}&nid=${notificationId}`
    : `action=snooze_alarm&id=${alarmId}`;
  const dismissData = notificationId
    ? `action=dismiss_alarm&id=${alarmId}&nid=${notificationId}`
    : `action=dismiss_alarm&id=${alarmId}`;

  const bubble: messagingApi.FlexBubble = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      backgroundColor: '#FBEFD8',
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
          color: '#21215C',
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
            type: 'postback',
            label: '⏸ เลื่อน 5 นาที',
            data: snoozeData,
            displayText: 'เลื่อน 5 นาที',
          },
        },
        {
          type: 'button',
          style: 'primary',
          color: '#06C755',
          height: 'md',
          action: {
            type: 'postback',
            label: '✓ ปิดการปลุก',
            data: dismissData,
            displayText: 'ปิดการปลุก',
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
  notificationId?: string,
): messagingApi.FlexMessage {
  const snoozeData = notificationId
    ? `action=snooze_reminder&id=${reminderId}&nid=${notificationId}`
    : `action=snooze_reminder&id=${reminderId}`;
  const dismissData = notificationId
    ? `action=dismiss_reminder&id=${reminderId}&nid=${notificationId}`
    : `action=dismiss_reminder&id=${reminderId}`;

  const bubble: messagingApi.FlexBubble = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      backgroundColor: '#E1E8F8',
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
          color: '#21215C',
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
            type: 'postback',
            label: '⏸ เลื่อน 15 นาที',
            data: snoozeData,
            displayText: 'เลื่อน 15 นาที',
          },
        },
        {
          type: 'button',
          style: 'primary',
          color: '#06C755',
          height: 'md',
          action: {
            type: 'postback',
            label: '✓ เรียบร้อย',
            data: dismissData,
            displayText: 'เรียบร้อย',
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
