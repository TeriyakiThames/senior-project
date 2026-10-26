import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { webhook } from '@line/bot-sdk';
import {
  handleTextMessage,
  handleAudioMessage,
  handleWebhookEvent,
  processWebhookEvents,
  resolveErrorStage,
  isEventDuplicate,
  markEventProcessed,
  clearProcessedEventCache,
} from '@/lib/line/dispatcher';
import { lineClient } from '@/lib/line/client';
import { AppError } from '@/lib/utils/errors';

vi.mock('@/lib/line/client', () => ({
  lineClient: {
    replyMessage: vi.fn(),
  },
}));

vi.mock('@/lib/speech/handler', () => ({
  processAudioMessage: vi.fn(),
  getUserProfile: vi.fn().mockResolvedValue(null),
}));

describe('LINE Webhook Dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearProcessedEventCache();
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

  describe('Event Deduplication (R5)', () => {
    it('detects duplicate events by webhookEventId', () => {
      const event1 = {
        type: 'message' as const,
        webhookEventId: '01FZ74A0TDDPYRVKNK77XKC3ZR',
        replyToken: 'token-1',
        message: { id: 'm1', type: 'text' as const, text: 'เตือนกินยา' },
      } as unknown as webhook.Event;

      expect(isEventDuplicate(event1)).toBe(false);
      markEventProcessed(event1);
      expect(isEventDuplicate(event1)).toBe(true);
    });

    it('detects duplicate events by message id when webhookEventId is absent', () => {
      const event1 = {
        type: 'message' as const,
        replyToken: 'token-2',
        message: { id: 'unique-msg-id-100', type: 'text' as const, text: 'ปลุก 7 โมง' },
      } as unknown as webhook.Event;

      expect(isEventDuplicate(event1)).toBe(false);
      markEventProcessed(event1);
      expect(isEventDuplicate(event1)).toBe(true);
    });

    it('drops redelivered events with duplicate webhookEventId in processWebhookEvents', async () => {
      const event = {
        type: 'message' as const,
        webhookEventId: '01FZ74A0REDELIVERY12345678',
        replyToken: 'token-redelivery',
        message: { id: 'm-redelivery', type: 'text' as const, text: 'ตั้งปลุก 8 โมง' },
      } as unknown as webhook.Event;

      // First delivery: processes normally
      await processWebhookEvents([event]);
      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);

      // Redelivery of the exact same event: dropped by deduplication
      await processWebhookEvents([event]);
      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
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

    it('sends polite fallback reply when internal pipeline throws an error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const audioEvent = {
        type: 'message' as const,
        replyToken: 'token-err-audio',
        source: { userId: 'u-123' },
        message: { id: 'm-aud', type: 'audio' as const },
      } as unknown as webhook.Event;

      const { processAudioMessage } = await import('@/lib/speech/handler');
      vi.mocked(processAudioMessage).mockRejectedValueOnce(
        new AppError('STT crashed', 'STT_ENGINE_FAIL'),
      );

      await processWebhookEvents([audioEvent]);

      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-err-audio',
        messages: [
          {
            type: 'text',
            text: expect.stringContaining('ฟังเสียงไม่ชัดเจน'),
          },
        ],
      });

      consoleErrorSpy.mockRestore();
    });

    it('times out long-running event processing gracefully and sends network fallback reply (R2)', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const audioEvent = {
        type: 'message' as const,
        replyToken: 'token-timeout',
        source: { userId: 'u-slow' },
        message: { id: 'm-slow', type: 'audio' as const },
      } as unknown as webhook.Event;

      const { processAudioMessage } = await import('@/lib/speech/handler');
      vi.mocked(processAudioMessage).mockImplementationOnce(
        () => new Promise((resolve) => setTimeout(resolve, 80)),
      );

      await processWebhookEvents([audioEvent], { timeoutMs: 10 });

      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-timeout',
        messages: [
          {
            type: 'text',
            text: expect.stringContaining('สัญญาณเชื่อมต่อติดขัดชั่วคราว'),
          },
        ],
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('resolveErrorStage', () => {
    it('identifies stages based on AppError codes and event metadata', () => {
      const dummyEvent = { type: 'message', message: { type: 'text' } } as webhook.Event;
      const audioEvent = { type: 'message', message: { type: 'audio' } } as webhook.Event;

      expect(resolveErrorStage(dummyEvent, new AppError('fail', 'STT_FAIL'))).toBe('stt');
      expect(resolveErrorStage(dummyEvent, new AppError('fail', 'AI_PARSE_ERROR'))).toBe('ai');
      expect(resolveErrorStage(dummyEvent, new AppError('fail', 'TOOL_ERROR'))).toBe('tool');
      expect(resolveErrorStage(dummyEvent, new AppError('fail', 'NET_TIMEOUT'))).toBe('network');
      expect(resolveErrorStage(audioEvent, new Error('generic error'))).toBe('stt');
      expect(resolveErrorStage(dummyEvent, new Error('ECONNRESET from server'))).toBe('network');
      expect(resolveErrorStage(dummyEvent, new Error('something else'))).toBe('default');
    });
  });
});
