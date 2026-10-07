import { webhook } from '@line/bot-sdk';
import { lineClient } from './client';

/**
 * Handles incoming text messages by replying with an echo / acknowledgement.
 */
export async function handleTextMessage(
  event: webhook.MessageEvent & { message: webhook.TextMessageContent },
): Promise<void> {
  const replyToken = event.replyToken;
  if (!replyToken) {
    return;
  }

  const userText = event.message.text.trim();
  const replyText = `ได้รับข้อความแล้ว: "${userText}"`;

  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: 'text',
        text: replyText,
      },
    ],
  });
}

/**
 * Handles incoming audio messages with a polite placeholder acknowledgement until STT is integrated.
 */
export async function handleAudioMessage(
  event: webhook.MessageEvent & { message: webhook.AudioMessageContent },
): Promise<void> {
  const replyToken = event.replyToken;
  if (!replyToken) {
    return;
  }

  const replyText =
    'ได้รับข้อความเสียงแล้วค่ะ ระบบกำลังพัฒนาการรับฟังเสียง กรุณาส่งเป็นข้อความก่อนนะคะ 🙏';

  await lineClient.replyMessage({
    replyToken,
    messages: [
      {
        type: 'text',
        text: replyText,
      },
    ],
  });
}

/**
 * Routes a single webhook event to the appropriate message handler.
 * Ignores unsupported message types and non-message events safely.
 */
export async function handleWebhookEvent(event: webhook.Event): Promise<void> {
  if (event.type !== 'message') {
    return;
  }

  const messageEvent = event as webhook.MessageEvent;
  if (messageEvent.message.type === 'text') {
    await handleTextMessage(
      messageEvent as webhook.MessageEvent & { message: webhook.TextMessageContent },
    );
  } else if (messageEvent.message.type === 'audio') {
    await handleAudioMessage(
      messageEvent as webhook.MessageEvent & { message: webhook.AudioMessageContent },
    );
  }
}

/**
 * Iterates through webhook events and processes each event safely.
 * Catches per-event errors so one failed event does not crash or abort processing for others.
 */
export async function processWebhookEvents(events: webhook.Event[]): Promise<void> {
  for (const event of events) {
    try {
      await handleWebhookEvent(event);
    } catch (error) {
      console.error('Error processing LINE webhook event:', error);
    }
  }
}
