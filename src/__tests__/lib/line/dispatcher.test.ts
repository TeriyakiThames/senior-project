import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { webhook } from '@line/bot-sdk';
import {
  handleTextMessage,
  handleAudioMessage,
  handleWebhookEvent,
  processWebhookEvents,
} from '@/lib/line/dispatcher';
import { lineClient } from '@/lib/line/client';

vi.mock('@/lib/line/client', () => ({
  lineClient: {
    replyMessage: vi.fn(),
  },
}));

vi.mock('@/lib/speech/handler', () => ({
  processAudioMessage: vi.fn(),
}));

describe('LINE Webhook Dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleTextMessage', () => {
    it('dispatches echo reply when text message and replyToken are present', async () => {
      const event = {
        type: 'message' as const,
        replyToken: 'token-123',
        message: {
          id: 'msg-1',
          type: 'text' as const,
          text: 'สวัสดีตอนเช้า',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-123',
        messages: [
          {
            type: 'text',
            text: 'ได้รับข้อความแล้ว: "สวัสดีตอนเช้า"',
          },
        ],
      });
    });

    it('does not send reply if replyToken is missing', async () => {
      const event = {
        type: 'message' as const,
        message: {
          id: 'msg-1',
          type: 'text' as const,
          text: 'สวัสดี',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(lineClient.replyMessage).not.toHaveBeenCalled();
    });

    it('dispatches reply with transcribedText when provided', async () => {
      const event = {
        type: 'message' as const,
        replyToken: 'token-transcribe-123',
        message: {
          id: 'msg-voice-1',
          type: 'text' as const,
          text: '',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event, 'เตือนกินยาบ่ายสอง');

      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-transcribe-123',
        messages: [
          {
            type: 'text',
            text: 'ได้รับข้อความแล้ว: "เตือนกินยาบ่ายสอง"',
          },
        ],
      });
    });
  });

  describe('handleAudioMessage', () => {
    it('delegates audio event to processAudioMessage and forwards transcript to handleTextMessage', async () => {
      const event = {
        type: 'message' as const,
        replyToken: 'token-voice-456',
        message: {
          id: 'audio-msg-1',
          type: 'audio' as const,
        },
      } as unknown as webhook.MessageEvent & { message: webhook.AudioMessageContent };

      const { processAudioMessage } = await import('@/lib/speech/handler');
      vi.mocked(processAudioMessage).mockImplementation(async (evt, callback) => {
        if (callback) {
          await callback('ถอดรหัสเสียงสำเร็จ');
        }
        return 'ถอดรหัสเสียงสำเร็จ';
      });

      await handleAudioMessage(event);

      expect(processAudioMessage).toHaveBeenCalledWith(event, expect.any(Function));
      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-voice-456',
        messages: [
          {
            type: 'text',
            text: 'ได้รับข้อความแล้ว: "ถอดรหัสเสียงสำเร็จ"',
          },
        ],
      });
    });
  });

  describe('handleWebhookEvent', () => {
    it('routes text message event to text handler', async () => {
      const event = {
        type: 'message' as const,
        replyToken: 'token-text',
        message: {
          id: 'msg-text',
          type: 'text' as const,
          text: 'เตือนกินยา',
        },
      } as unknown as webhook.Event;

      await handleWebhookEvent(event);

      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
    });

    it('routes audio message event to audio handler', async () => {
      const event = {
        type: 'message' as const,
        replyToken: 'token-audio',
        message: {
          id: 'msg-audio',
          type: 'audio' as const,
        },
      } as unknown as webhook.Event;

      await handleWebhookEvent(event);

      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
    });

    it('ignores unsupported message types (e.g. image) safely', async () => {
      const event = {
        type: 'message' as const,
        replyToken: 'token-image',
        message: {
          id: 'msg-image',
          type: 'image' as const,
        },
      } as unknown as webhook.Event;

      await handleWebhookEvent(event);

      expect(lineClient.replyMessage).not.toHaveBeenCalled();
    });

    it('ignores non-message events (e.g. follow) safely', async () => {
      const event = {
        type: 'follow' as const,
        replyToken: 'token-follow',
      } as unknown as webhook.Event;

      await handleWebhookEvent(event);

      expect(lineClient.replyMessage).not.toHaveBeenCalled();
    });
  });

  describe('processWebhookEvents', () => {
    it('processes multiple events in batch', async () => {
      const events = [
        {
          type: 'message' as const,
          replyToken: 'token-1',
          message: { id: 'm1', type: 'text' as const, text: 'หนึ่ง' },
        },
        {
          type: 'message' as const,
          replyToken: 'token-2',
          message: { id: 'm2', type: 'text' as const, text: 'สอง' },
        },
      ] as unknown as webhook.Event[];

      await processWebhookEvents(events);

      expect(lineClient.replyMessage).toHaveBeenCalledTimes(2);
    });

    it('isolates errors so failure in one event does not crash processing of others', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(lineClient.replyMessage)
        .mockRejectedValueOnce(new Error('LINE API Down'))
        .mockResolvedValueOnce({} as never);

      const events = [
        {
          type: 'message' as const,
          replyToken: 'fail-token',
          message: { id: 'm-fail', type: 'text' as const, text: 'ล้มเหลว' },
        },
        {
          type: 'message' as const,
          replyToken: 'pass-token',
          message: { id: 'm-pass', type: 'text' as const, text: 'สำเร็จ' },
        },
      ] as unknown as webhook.Event[];

      await expect(processWebhookEvents(events)).resolves.not.toThrow();

      expect(lineClient.replyMessage).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
