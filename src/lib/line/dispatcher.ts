import { webhook } from '@line/bot-sdk';
import { lineClient } from './client';
import { processAudioMessage } from '@/lib/speech/handler';

/**
 * Handles incoming text messages by replying with an echo / acknowledgement.
 * Accepts optional transcribedText to process recognized audio input.
 */
export async function handleTextMessage(
  event: webhook.MessageEvent & { message: webhook.TextMessageContent },
  transcribedText?: string,
): Promise<void> {
  const replyToken = event.replyToken;
  if (!replyToken) {
    return;
  }

  const rawText = transcribedText ?? event.message.text;
  const userText = rawText.trim();
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
 * Handles incoming audio messages by processing voice download, STT transcription,
 * and forwarding recognized text to the conversational text pipeline.
 */
export async function handleAudioMessage(
  event: webhook.MessageEvent & { message: webhook.AudioMessageContent },
): Promise<void> {
  await processAudioMessage(event, async (transcribedText) => {
    await handleTextMessage(
      event as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent },
      transcribedText,
    );
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
