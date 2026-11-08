import type { messagingApi } from '@line/bot-sdk';
import { getBangkokComponents } from '@/lib/utils/recurrence';
import { resolvePersonaParticles, type PersonaUserInput } from '@/lib/ai/persona';

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
 * Options for building a timer confirmation flex message.
 */
export interface BuildTimerConfirmationCardOptions {
  durationText: string;
  fireAt: Date;
  timerId: string;
  label?: string;
}

/**
 * Builds an interactive Flex Message bubble notifying the user that a timer has started,
 * displaying duration, target trigger time, and an optional deletion button.
 */
export function buildTimerConfirmationCard({
  durationText,
  fireAt,
  timerId,
  label,
}: BuildTimerConfirmationCardOptions): messagingApi.FlexMessage {
  const bkk = getBangkokComponents(fireAt);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const formattedTime = `${pad(bkk.hours)}:${pad(bkk.minutes)} น.`;

  const bodyContents: messagingApi.FlexComponent[] = [
    {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: 'ระยะเวลา:',
          size: 'sm',
          color: '#7D84A3',
        },
        {
          type: 'text',
          text: durationText,
          size: 'xxl',
          weight: 'bold',
          color: '#21215C',
        },
      ],
    },
  ];

  if (label && label.trim()) {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      contents: [
        {
          type: 'text',
          text: 'สิ่งที่จับเวลา:',
          size: 'sm',
          color: '#7D84A3',
        },
        {
          type: 'text',
          text: label.trim(),
          size: 'lg',
          weight: 'bold',
          color: '#21215C',
          wrap: true,
        },
      ],
    });
  }

  bodyContents.push(
    {
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      contents: [
        {
          type: 'text',
          text: 'จะเตือนเวลา:',
          size: 'sm',
          color: '#7D84A3',
        },
        {
          type: 'text',
          text: formattedTime,
          size: 'lg',
          weight: 'bold',
          color: '#7A4E00',
        },
      ],
    },
    {
      type: 'text',
      text: 'เริ่มนับถอยหลังแล้วค่ะ หนูจะเตือนเมื่อครบเวลานะคะ ⏱️',
      size: 'sm',
      color: '#4B4F72',
      margin: 'lg',
      wrap: true,
    },
  );

  const bubble: messagingApi.FlexBubble = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'horizontal',
      paddingAll: 'lg',
      backgroundColor: '#FBEFD8',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: '⏱️',
          size: 'xl',
          flex: 0,
        },
        {
          type: 'text',
          text: 'เริ่มจับเวลาแล้วค่ะ',
          weight: 'bold',
          size: 'xl',
          color: '#7A4E00',
          gravity: 'center',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      contents: bodyContents,
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      contents: [
        {
          type: 'button',
          style: 'secondary',
          height: 'md',
          action: {
            type: 'postback',
            label: '🗑️ ลบตัวจับเวลา',
            data: `action=delete_timer&id=${timerId}`,
            displayText: 'ลบตัวจับเวลา',
          },
        },
      ],
    },
  };

  const labelSuffix = label?.trim() ? ` (${label.trim()})` : '';

  return {
    type: 'flex',
    altText: `⏱️ เริ่มจับเวลา: ${durationText}${labelSuffix}`,
    contents: bubble,
  };
}

/**
 * Builds an interactive Flex Message bubble for timer notification with snooze (+15m) and dismiss buttons.
 */
export function buildTimerNotification(
  label: string,
  timerId: string,
  notificationId?: string,
): messagingApi.FlexMessage {
  const snoozeData = notificationId
    ? `action=snooze_timer&id=${timerId}&nid=${notificationId}`
    : `action=snooze_timer&id=${timerId}`;
  const dismissData = notificationId
    ? `action=dismiss_timer&id=${timerId}&nid=${notificationId}`
    : `action=dismiss_timer&id=${timerId}`;

  const bubble: messagingApi.FlexBubble = {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      backgroundColor: '#FBEFD8',
      contents: [{ type: 'text', text: '⏱️', size: '3xl', align: 'center' }],
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
            label: '✓ ปิดตัวจับเวลา',
            data: dismissData,
            displayText: 'ปิดตัวจับเวลา',
          },
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `⏱️ ตัวจับเวลา: ${label}`,
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

export interface WelcomeFlexMessageOptions {
  userDoc?: PersonaUserInput | null;
  size?: 'kilo' | 'mega' | 'giga';
  iconUrls?: {
    reminder?: string;
    alarm?: string;
    note?: string;
    list?: string;
    mic?: string;
  };
}

/**
 * Builds an elderly-friendly, stylized Welcome Flex Message bubble introducing the bot's
 * core capabilities matching the design specification:
 * - Header: Royal Blue (#4869EA) banner with polite greeting ("สวัสดีค่ะ ยินดีที่ได้รู้จักนะคะ")
 * - Intro text: "หนูช่วยคุณตาคุณยายได้ตามนี้เลยค่ะ"
 * - 4 Category items with pastel squircles and clear guidance:
 *   1. Reminders (#E1E8F8): "ตั้งเตือนความจำ" - เช่น “เตือนกินยาตอนสองทุ่ม”
 *   2. Alarms (#FBEFD8): "ตั้งนาฬิกาปลุก" - เช่น “ปลุกหกโมงเช้า”
 *   3. Notes (#EEE1FA): "จดบันทึกข้อความ" - เช่น “ช่วยจดว่าต้องซื้อนม”
 *   4. List/Delete (#DAEEE3): "ดูหรือลบรายการที่ตั้งไว้" - เช่น “ดูรายการเตือน”
 * - Bottom Tip Card Banner (#E1E8F8): White circular mic badge + voice prompt guidance.
 */
export function buildWelcomeFlexMessage(
  optionsOrUser?: WelcomeFlexMessageOptions | PersonaUserInput | null,
): messagingApi.FlexMessage {
  const options: WelcomeFlexMessageOptions =
    optionsOrUser && 'profile' in optionsOrUser && !('userDoc' in optionsOrUser)
      ? { userDoc: optionsOrUser as PersonaUserInput }
      : ((optionsOrUser as WelcomeFlexMessageOptions) ?? {});

  const userDoc = options.userDoc;
  const particles = resolvePersonaParticles(userDoc);
  const titlePart = particles.title ? `คุณ${particles.title}` : 'คุณตาคุณยาย';

  const greetingParticle =
    particles.affirmative === 'จ้ะ'
      ? 'จ้ะ ยินดีที่ได้รู้จักนะจ้ะ'
      : particles.affirmative === 'ครับ'
        ? 'ครับ ยินดีที่ได้รู้จักนะครับ'
        : 'ค่ะ ยินดีที่ได้รู้จักนะคะ';

  const introEnding = particles.affirmative; // 'ค่ะ', 'ครับ', 'จ้ะ'

  const voiceEnding =
    particles.affirmative === 'จ้ะ'
      ? 'ได้ตลอดเลยนะจ้ะ'
      : particles.affirmative === 'ครับ'
        ? 'ได้ตลอดเลยนะครับ'
        : 'ได้ตลอดเลยนะคะ';

  const headerText = `สวัสดี${greetingParticle}`;
  const introText = `หนูช่วย${titlePart}ได้ตามนี้เลย${introEnding}`;
  const voiceTipText = `ส่งข้อความเสียงคุยกับหนูแทนการพิมพ์${voiceEnding}`;

  const iconUrls = options.iconUrls;

  const buildIcon = (emoji: string, url?: string): messagingApi.FlexComponent => {
    if (url) {
      return {
        type: 'image',
        url,
        size: 'xxs',
        aspectRatio: '1:1',
        aspectMode: 'fit',
        align: 'center',
        gravity: 'center',
      };
    }
    return {
      type: 'text',
      text: emoji,
      size: 'xl',
      align: 'center',
      gravity: 'center',
    };
  };

  const bubble: messagingApi.FlexBubble = {
    type: 'bubble',
    size: options.size ?? 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#4869EA',
      paddingAll: 'lg',
      paddingTop: 'xl',
      paddingBottom: 'xl',
      contents: [
        {
          type: 'text',
          text: headerText,
          weight: 'bold',
          size: 'lg',
          color: '#FFFFFF',
          wrap: true,
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'xl',
      backgroundColor: '#FFFFFF',
      contents: [
        {
          type: 'text',
          text: introText,
          weight: 'bold',
          size: 'xl',
          color: '#21215C',
          wrap: true,
        },
        // Row 1: Reminders
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'md',
          alignItems: 'center',
          margin: 'xl',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              width: '48px',
              height: '48px',
              cornerRadius: 'xl',
              backgroundColor: '#E1E8F8',
              justifyContent: 'center',
              alignItems: 'center',
              flex: 0,
              contents: [buildIcon('🔔', iconUrls?.reminder)],
            },
            {
              type: 'box',
              layout: 'vertical',
              flex: 1,
              contents: [
                {
                  type: 'text',
                  text: 'ตั้งเตือนความจำ',
                  weight: 'bold',
                  size: 'lg',
                  color: '#21215C',
                  wrap: true,
                },
                {
                  type: 'text',
                  text: 'เช่น “เตือนกินยาตอนสองทุ่ม”',
                  size: 'md',
                  color: '#7D84A3',
                  wrap: true,
                  margin: 'xs',
                },
              ],
            },
          ],
        },
        // Divider 1
        {
          type: 'separator',
          color: '#EAF0F6',
          margin: 'md',
        },
        // Row 2: Alarms
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'md',
          alignItems: 'center',
          margin: 'md',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              width: '48px',
              height: '48px',
              cornerRadius: 'xl',
              backgroundColor: '#FBEFD8',
              justifyContent: 'center',
              alignItems: 'center',
              flex: 0,
              contents: [buildIcon('⏰', iconUrls?.alarm)],
            },
            {
              type: 'box',
              layout: 'vertical',
              flex: 1,
              contents: [
                {
                  type: 'text',
                  text: 'ตั้งนาฬิกาปลุก',
                  weight: 'bold',
                  size: 'lg',
                  color: '#21215C',
                  wrap: true,
                },
                {
                  type: 'text',
                  text: 'เช่น “ปลุกหกโมงเช้า”',
                  size: 'md',
                  color: '#7D84A3',
                  wrap: true,
                  margin: 'xs',
                },
              ],
            },
          ],
        },
        // Divider 2
        {
          type: 'separator',
          color: '#EAF0F6',
          margin: 'md',
        },
        // Row 3: Notes
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'md',
          alignItems: 'center',
          margin: 'md',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              width: '48px',
              height: '48px',
              cornerRadius: 'xl',
              backgroundColor: '#EEE1FA',
              justifyContent: 'center',
              alignItems: 'center',
              flex: 0,
              contents: [buildIcon('📝', iconUrls?.note)],
            },
            {
              type: 'box',
              layout: 'vertical',
              flex: 1,
              contents: [
                {
                  type: 'text',
                  text: 'จดบันทึกข้อความ',
                  weight: 'bold',
                  size: 'lg',
                  color: '#21215C',
                  wrap: true,
                },
                {
                  type: 'text',
                  text: 'เช่น “ช่วยจดว่าต้องซื้อนม”',
                  size: 'md',
                  color: '#7D84A3',
                  wrap: true,
                  margin: 'xs',
                },
              ],
            },
          ],
        },
        // Divider 3
        {
          type: 'separator',
          color: '#EAF0F6',
          margin: 'md',
        },
        // Row 4: View / Delete
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'md',
          alignItems: 'center',
          margin: 'md',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              width: '48px',
              height: '48px',
              cornerRadius: 'xl',
              backgroundColor: '#DAEEE3',
              justifyContent: 'center',
              alignItems: 'center',
              flex: 0,
              contents: [buildIcon('📋', iconUrls?.list)],
            },
            {
              type: 'box',
              layout: 'vertical',
              flex: 1,
              contents: [
                {
                  type: 'text',
                  text: 'ดูหรือลบรายการที่ตั้งไว้',
                  weight: 'bold',
                  size: 'lg',
                  color: '#21215C',
                  wrap: true,
                },
                {
                  type: 'text',
                  text: 'เช่น “ดูรายการเตือน”',
                  size: 'md',
                  color: '#7D84A3',
                  wrap: true,
                  margin: 'xs',
                },
              ],
            },
          ],
        },
        // Tip Card Banner
        {
          type: 'box',
          layout: 'horizontal',
          backgroundColor: '#E1E8F8',
          cornerRadius: 'xxl',
          paddingAll: 'lg',
          margin: 'xl',
          spacing: 'md',
          alignItems: 'center',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              width: '44px',
              height: '44px',
              cornerRadius: 'xxl',
              backgroundColor: '#FFFFFF',
              justifyContent: 'center',
              alignItems: 'center',
              flex: 0,
              contents: [
                iconUrls?.mic
                  ? {
                      type: 'image',
                      url: iconUrls.mic,
                      size: 'xxs',
                      aspectRatio: '1:1',
                      aspectMode: 'fit',
                      align: 'center',
                      gravity: 'center',
                    }
                  : {
                      type: 'text',
                      text: '🎙️',
                      size: 'lg',
                      align: 'center',
                      gravity: 'center',
                    },
              ],
            },
            {
              type: 'text',
              text: voiceTipText,
              weight: 'bold',
              size: 'md',
              color: '#21215C',
              wrap: true,
              flex: 1,
            },
          ],
        },
      ],
    },
  };

  return {
    type: 'flex',
    altText: `${headerText} ${introText}: ตั้งเตือนความจำ, ตั้งนาฬิกาปลุก, จดบันทึกข้อความ, ดูหรือลบรายการที่ตั้งไว้ และ${voiceTipText}`,
    contents: bubble,
  };
}
