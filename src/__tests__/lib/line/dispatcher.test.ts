import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { webhook, messagingApi } from '@line/bot-sdk';
import {
  handleTextMessage,
  handleAudioMessage,
  handleWebhookEvent,
  processWebhookEvents,
  resolveErrorStage,
} from '@/lib/line/dispatcher';
import { lineClient } from '@/lib/line/client';
import { AppError } from '@/lib/utils/errors';
import { getOrCreateUser, saveMessages } from '@/lib/firebase/collections';
import { loadMemoryContext, updateUserProfile } from '@/lib/ai/memory';
import { generateResponse } from '@/lib/ai/gemini';
import { classifyIntent } from '@/lib/ai/jev';
import {
  executeTool,
  handleSnooze,
  handleDismiss,
  handleConfirmNote,
  handleCancelAction,
} from '@/lib/tools';

vi.mock('@/lib/line/client', () => ({
  lineClient: {
    replyMessage: vi.fn().mockResolvedValue({}),
    getProfile: vi.fn().mockResolvedValue({
      displayName: 'คุณยายสมศรี',
      userId: 'user-123',
    }),
  },
}));

vi.mock('@/lib/speech/handler', () => ({
  processAudioMessage: vi.fn(),
  getUserProfile: vi.fn().mockResolvedValue({
    lineUserId: 'user-123',
    displayName: 'คุณยายสมศรี',
    language: 'th',
    timezone: 'Asia/Bangkok',
  }),
}));

vi.mock('@/lib/firebase/collections', () => ({
  getOrCreateUser: vi.fn().mockResolvedValue({
    lineUserId: 'user-123',
    displayName: 'คุณยายสมศรี',
    language: 'th',
    timezone: 'Asia/Bangkok',
    firebaseUid: '',
    profile: { facts: [] },
  }),
  saveMessages: vi.fn().mockResolvedValue(undefined),
  messagesRef: vi.fn(),
  userRef: vi.fn(),
}));

vi.mock('@/lib/ai/memory', () => ({
  loadMemoryContext: vi.fn().mockResolvedValue({
    user: {
      lineUserId: 'user-123',
      displayName: 'คุณยายสมศรี',
      language: 'th',
      timezone: 'Asia/Bangkok',
      profile: { facts: [] },
    },
    recentMessages: [],
    userFacts: [],
  }),
  updateUserProfile: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/ai/gemini', () => ({
  generateResponse: vi.fn().mockResolvedValue({
    responseText: 'สวัสดีค่ะคุณยาย วันนี้สบายดีไหมคะ',
  }),
}));

vi.mock('@/lib/ai/jev', () => ({
  classifyIntent: vi.fn().mockResolvedValue({
    intent: 'general_chat',
    confidence: 0.95,
    isAmbiguous: false,
  }),
}));

vi.mock('@/lib/tools', () => ({
  executeTool: vi.fn().mockResolvedValue({
    success: true,
    message: 'สวัสดีค่ะคุณยาย วันนี้สบายดีไหมคะ',
  }),
  handleSnooze: vi.fn().mockResolvedValue({
    success: true,
    message: 'เลื่อนปลุกไปอีก 5 นาทีค่ะ ⏰',
  }),
  handleDismiss: vi.fn().mockResolvedValue({
    success: true,
    message: 'ปิดเสียงปลุกแล้วค่ะ ✓',
  }),
  handleConfirmNote: vi.fn().mockResolvedValue({
    success: true,
    message: 'บันทึกโน้ตเรียบร้อยแล้วค่ะ คุณตาคุณยาย',
  }),
  handleCancelAction: vi.fn().mockResolvedValue({
    success: true,
    message: 'ยกเลิกการบันทึกเรียบร้อยแล้วค่ะ',
  }),
}));

describe('LINE Webhook Dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleTextMessage', () => {
    it('dispatches conversational reply when text message and replyToken are present', async () => {
      const event = {
        type: 'message' as const,
        replyToken: 'token-123',
        source: { userId: 'user-123' },
        message: {
          id: 'msg-1',
          type: 'text' as const,
          text: 'สวัสดีตอนเช้า',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(getOrCreateUser).toHaveBeenCalledWith('user-123', 'คุณยายสมศรี');
      expect(generateResponse).toHaveBeenCalledTimes(1);
      expect(classifyIntent).toHaveBeenCalledWith('สวัสดีตอนเช้า', undefined, {
        fallbackOnFailure: true,
      });
      expect(executeTool).toHaveBeenCalledTimes(1);
      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-123',
        messages: [
          {
            type: 'text',
            text: 'สวัสดีค่ะคุณยาย วันนี้สบายดีไหมคะ',
          },
        ],
      });
      expect(saveMessages).toHaveBeenCalledWith(
        'user-123',
        'สวัสดีตอนเช้า',
        'สวัสดีค่ะคุณยาย วันนี้สบายดีไหมคะ',
      );
      expect(updateUserProfile).toHaveBeenCalledTimes(1);
    });

    it('does not send reply if replyToken is missing', async () => {
      const event = {
        type: 'message' as const,
        source: { userId: 'user-123' },
        message: {
          id: 'msg-1',
          type: 'text' as const,
          text: 'สวัสดี',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(lineClient.replyMessage).not.toHaveBeenCalled();
      expect(generateResponse).not.toHaveBeenCalled();
    });

    it('does not send reply if userText is empty', async () => {
      const event = {
        type: 'message' as const,
        replyToken: 'token-empty',
        source: { userId: 'user-123' },
        message: {
          id: 'msg-empty',
          type: 'text' as const,
          text: '   ',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(lineClient.replyMessage).not.toHaveBeenCalled();
    });

    it('dispatches reply with transcribedText when provided', async () => {
      const event = {
        type: 'message' as const,
        replyToken: 'token-transcribe-123',
        source: { userId: 'user-123' },
        message: {
          id: 'msg-voice-1',
          type: 'text' as const,
          text: '',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event, 'เตือนกินยาบ่ายสอง');

      expect(generateResponse).toHaveBeenCalledWith(
        'เตือนกินยาบ่ายสอง',
        expect.any(Object),
        expect.any(Array),
      );
      expect(classifyIntent).toHaveBeenCalledWith('เตือนกินยาบ่ายสอง', undefined, {
        fallbackOnFailure: true,
      });
      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-transcribe-123',
        messages: [
          {
            type: 'text',
            text: 'สวัสดีค่ะคุณยาย วันนี้สบายดีไหมคะ',
          },
        ],
      });
    });

    it('replies with Flex Message when tool returns flexMessage and records summary in history', async () => {
      const mockFlex: messagingApi.FlexMessage = {
        type: 'flex',
        altText: '📝 สรุปบันทึก: นัดหมอวันจันทร์',
        contents: { type: 'bubble' },
      };

      vi.mocked(executeTool).mockResolvedValueOnce({
        success: true,
        flexMessage: mockFlex,
        data: { summary: 'นัดหมอวันจันทร์' },
      });

      const event = {
        type: 'message' as const,
        replyToken: 'token-note-flex',
        source: { userId: 'user-123' },
        message: {
          id: 'msg-note',
          type: 'text' as const,
          text: 'ช่วยจดว่ามีนัดหมอวันจันทร์',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-note-flex',
        messages: [mockFlex],
      });
      expect(saveMessages).toHaveBeenCalledWith(
        'user-123',
        'ช่วยจดว่ามีนัดหมอวันจันทร์',
        'สรุปบันทึก: นัดหมอวันจันทร์',
      );
    });

    it('short-circuits snooze actions directly without calling Gemini or Jev', async () => {
      const event = {
        type: 'message' as const,
        replyToken: 'token-snooze',
        source: { userId: 'user-123' },
        message: {
          id: 'msg-snooze',
          type: 'text' as const,
          text: 'snooze_alarm:alm-999',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(handleSnooze).toHaveBeenCalledWith('snooze_alarm:alm-999', expect.any(Object));
      expect(generateResponse).not.toHaveBeenCalled();
      expect(classifyIntent).not.toHaveBeenCalled();
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-snooze',
        messages: [{ type: 'text', text: 'เลื่อนปลุกไปอีก 5 นาทีค่ะ ⏰' }],
      });
      expect(saveMessages).toHaveBeenCalledWith(
        'user-123',
        'snooze_alarm:alm-999',
        'เลื่อนปลุกไปอีก 5 นาทีค่ะ ⏰',
      );
    });

    it('short-circuits dismiss actions directly without calling Gemini or Jev', async () => {
      const event = {
        type: 'message' as const,
        replyToken: 'token-dismiss',
        source: { userId: 'user-123' },
        message: {
          id: 'msg-dismiss',
          type: 'text' as const,
          text: 'dismiss_reminder:rem-888',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(handleDismiss).toHaveBeenCalledWith('dismiss_reminder:rem-888', expect.any(Object));
      expect(generateResponse).not.toHaveBeenCalled();
      expect(classifyIntent).not.toHaveBeenCalled();
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-dismiss',
        messages: [{ type: 'text', text: 'ปิดเสียงปลุกแล้วค่ะ ✓' }],
      });
    });

    it('short-circuits note confirmation button "บันทึกเลย" directly to handleConfirmNote', async () => {
      const event = {
        type: 'message' as const,
        replyToken: 'token-confirm',
        source: { userId: 'user-123' },
        message: {
          id: 'msg-conf',
          type: 'text' as const,
          text: 'บันทึกเลย',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(handleConfirmNote).toHaveBeenCalledWith(expect.any(Object));
      expect(generateResponse).not.toHaveBeenCalled();
      expect(classifyIntent).not.toHaveBeenCalled();
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-confirm',
        messages: [{ type: 'text', text: 'บันทึกโน้ตเรียบร้อยแล้วค่ะ คุณตาคุณยาย' }],
      });
    });

    it('short-circuits note cancel button "ยกเลิก" directly to handleCancelAction', async () => {
      const event = {
        type: 'message' as const,
        replyToken: 'token-cancel',
        source: { userId: 'user-123' },
        message: {
          id: 'msg-canc',
          type: 'text' as const,
          text: 'ยกเลิก',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(handleCancelAction).toHaveBeenCalledWith(expect.any(Object));
      expect(generateResponse).not.toHaveBeenCalled();
      expect(classifyIntent).not.toHaveBeenCalled();
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-cancel',
        messages: [{ type: 'text', text: 'ยกเลิกการบันทึกเรียบร้อยแล้วค่ะ' }],
      });
    });

    it('falls back gracefully to default display name when LINE getProfile fails', async () => {
      vi.mocked(lineClient.getProfile).mockRejectedValueOnce(new Error('LINE API 404'));

      const event = {
        type: 'message' as const,
        replyToken: 'token-fallback-profile',
        source: { userId: 'user-new' },
        message: {
          id: 'msg-new',
          type: 'text' as const,
          text: 'สวัสดี',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(getOrCreateUser).toHaveBeenCalledWith('user-new', 'คุณตาคุณยาย');
      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleAudioMessage', () => {
    it('delegates audio event to processAudioMessage and forwards transcript to handleTextMessage', async () => {
      const event = {
        type: 'message' as const,
        replyToken: 'token-voice-456',
        source: { userId: 'user-123' },
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
            text: 'สวัสดีค่ะคุณยาย วันนี้สบายดีไหมคะ',
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
        source: { userId: 'user-123' },
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
        source: { userId: 'user-123' },
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
          source: { userId: 'user-123' },
          message: { id: 'm1', type: 'text' as const, text: 'หนึ่ง' },
        },
        {
          type: 'message' as const,
          replyToken: 'token-2',
          source: { userId: 'user-123' },
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
          source: { userId: 'user-123' },
          message: { id: 'm-fail', type: 'text' as const, text: 'ล้มเหลว' },
        },
        {
          type: 'message' as const,
          replyToken: 'pass-token',
          source: { userId: 'user-123' },
          message: { id: 'm-pass', type: 'text' as const, text: 'สำเร็จ' },
        },
      ] as unknown as webhook.Event[];

      await expect(processWebhookEvents(events)).resolves.not.toThrow();

      expect(lineClient.replyMessage).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('sends polite fallback reply when internal pipeline throws an AI error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(generateResponse).mockRejectedValueOnce(new AppError('Gemini Down', 'AI_FAIL'));

      const textEvent = {
        type: 'message' as const,
        replyToken: 'token-err-ai',
        source: { userId: 'user-123' },
        message: { id: 'm-ai', type: 'text' as const, text: 'ทดสอบล้มเหลว' },
      } as unknown as webhook.Event;

      await processWebhookEvents([textEvent]);

      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-err-ai',
        messages: [
          {
            type: 'text',
            text: expect.stringContaining('ยังไม่ค่อยเข้าใจคำสั่งนี้'),
          },
        ],
      });

      consoleErrorSpy.mockRestore();
    });

    it('sends polite fallback reply when internal pipeline throws an STT error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const audioEvent = {
        type: 'message' as const,
        replyToken: 'token-err-audio',
        source: { userId: 'user-123' },
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

    it('sends polite fallback reply when tool execution throws an error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(executeTool).mockRejectedValueOnce(new AppError('Task queue full', 'TOOL_FAIL'));

      const textEvent = {
        type: 'message' as const,
        replyToken: 'token-err-tool',
        source: { userId: 'user-123' },
        message: { id: 'm-tool', type: 'text' as const, text: 'ตั้งปลุก 8 โมง' },
      } as unknown as webhook.Event;

      await processWebhookEvents([textEvent]);

      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-err-tool',
        messages: [
          {
            type: 'text',
            text: expect.stringContaining('ดำเนินการไม่สำเร็จในตอนนี้'),
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
