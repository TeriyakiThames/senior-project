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
