import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { webhook, messagingApi } from '@line/bot-sdk';
import {
  handleTextMessage,
  handleAudioMessage,
  handlePostbackEvent,
  handleWebhookEvent,
  processWebhookEvents,
  resolveErrorStage,
  isEventDuplicate,
  markEventProcessed,
  clearProcessedEventCache,
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
  handleConfirmReminder,
  handleCancelAction,
  handleUpdatePendingReminderTime,
} from '@/lib/tools';

const mockPendingGet = vi.fn().mockResolvedValue({ exists: false });
const mockPendingDoc = vi.fn().mockReturnValue({ get: mockPendingGet });
const mockPendingRef = vi.fn().mockReturnValue({ doc: mockPendingDoc });

vi.mock('@/lib/line/client', () => ({
  lineClient: {
    replyMessage: vi.fn().mockResolvedValue({}),
    showLoadingAnimation: vi.fn().mockResolvedValue({}),
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
  pendingActionsRef: (...args: unknown[]) => mockPendingRef(...args),
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
  handleConfirmReminder: vi.fn().mockResolvedValue({
    success: true,
    message: 'ตั้งเตือนเรียบร้อยแล้วค่ะ: กินยา เวลา 19:00 น.',
  }),
  handleCancelAction: vi.fn().mockResolvedValue({
    success: true,
    message: 'ยกเลิกการบันทึกเรียบร้อยแล้วค่ะ',
  }),
  handleUpdatePendingReminderTime: vi.fn().mockResolvedValue({
    success: true,
    message: 'เปลี่ยนเวลาแจ้งเตือนเรียบร้อยแล้วค่ะ',
  }),
}));

describe('LINE Webhook Dispatcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPendingGet.mockResolvedValue({ exists: false });
    clearProcessedEventCache();
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

    it('does not update user profile facts when tool execution fails', async () => {
      vi.mocked(classifyIntent).mockResolvedValueOnce({
        intent: 'set_reminder',
        confidence: 0.95,
        isAmbiguous: false,
      });
      vi.mocked(executeTool).mockResolvedValueOnce({
        success: false,
        message: 'เกิดข้อผิดพลาดในการตั้งเตือน กรุณาลองใหม่อีกครั้งค่ะ',
      });

      const event = {
        type: 'message' as const,
        replyToken: 'token-fail-123',
        source: { type: 'user' as const, userId: 'user-123' },
        message: {
          id: 'msg-fail',
          type: 'text' as const,
          text: 'เตือนกินยาลดความดันตอนบ่ายสอง',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(executeTool).toHaveBeenCalledTimes(1);
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-fail-123',
        messages: [{ type: 'text', text: 'เกิดข้อผิดพลาดในการตั้งเตือน กรุณาลองใหม่อีกครั้งค่ะ' }],
      });
      expect(updateUserProfile).not.toHaveBeenCalled();
    });

    it('does not update user profile facts when tool returns a pending draft confirmation card', async () => {
      vi.mocked(classifyIntent).mockResolvedValueOnce({
        intent: 'set_reminder',
        confidence: 0.95,
        isAmbiguous: false,
      });
      vi.mocked(executeTool).mockResolvedValueOnce({
        success: true,
        flexMessage: { type: 'flex', altText: 'ยืนยันเตือน: กินยา' },
        data: { message: 'กินยา', time: '14:00 น.' },
      });

      const event = {
        type: 'message' as const,
        replyToken: 'token-pending-123',
        source: { type: 'user' as const, userId: 'user-123' },
        message: {
          id: 'msg-pending',
          type: 'text' as const,
          text: 'เตือนกินยาตอนบ่ายสอง',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(executeTool).toHaveBeenCalledTimes(1);
      expect(updateUserProfile).not.toHaveBeenCalled();
    });

    it('updates user profile facts when tool execution succeeds without pending draft', async () => {
      vi.mocked(classifyIntent).mockResolvedValueOnce({
        intent: 'set_alarm',
        confidence: 0.95,
        isAmbiguous: false,
      });
      vi.mocked(executeTool).mockResolvedValueOnce({
        success: true,
        message: 'ตั้งปลุก เวลา 07:00 น. เรียบร้อยแล้วค่ะ',
      });

      const event = {
        type: 'message' as const,
        replyToken: 'token-alarm-123',
        source: { type: 'user' as const, userId: 'user-123' },
        message: {
          id: 'msg-alarm',
          type: 'text' as const,
          text: 'ตั้งปลุก 7 โมงเช้า',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(executeTool).toHaveBeenCalledTimes(1);
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

    it('short-circuits note confirmation button "บันทึกเลย" directly to handleConfirmNote and attaches suggestions', async () => {
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
        messages: [
          { type: 'text', text: 'บันทึกโน้ตเรียบร้อยแล้วค่ะ คุณตาคุณยาย' },
          {
            type: 'text',
            text: 'หากต้องการให้หนูช่วยตั้งเตือนความจำ หรือตั้งนาฬิกาปลุก บอกหนูได้ตลอดเวลาเลยนะคะ',
          },
        ],
      });
    });

    it('short-circuits reminder confirmation "ยืนยัน" to handleConfirmReminder when pending action is confirm_reminder', async () => {
      mockPendingGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ type: 'confirm_reminder' }),
      });

      const event = {
        type: 'message' as const,
        replyToken: 'token-confirm-rem',
        source: { userId: 'user-123' },
        message: {
          id: 'msg-rem-conf',
          type: 'text' as const,
          text: 'ยืนยันเตือน',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(handleConfirmReminder).toHaveBeenCalledWith(expect.any(Object));
      expect(handleConfirmNote).not.toHaveBeenCalled();
      expect(generateResponse).not.toHaveBeenCalled();
      expect(classifyIntent).not.toHaveBeenCalled();
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-confirm-rem',
        messages: [
          { type: 'text', text: 'ตั้งเตือนเรียบร้อยแล้วค่ะ: กินยา เวลา 19:00 น.' },
          {
            type: 'text',
            text: 'หากต้องการให้หนูช่วยจดบันทึกข้อความ หรือตั้งนาฬิกาปลุก บอกหนูได้ตลอดเวลาเลยนะคะ',
          },
        ],
      });
    });

    it('short-circuits note cancel button "ยกเลิก" directly to handleCancelAction and attaches suggestions', async () => {
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
        messages: [
          { type: 'text', text: 'ยกเลิกการบันทึกเรียบร้อยแล้วค่ะ' },
          {
            type: 'text',
            text: 'คุณตาคุณยายสามารถบอกให้หนูช่วยตั้งเตือน ตั้งนาฬิกาปลุก หรือจดบันทึกเรื่องอื่นได้เสมอนะคะ',
          },
        ],
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

  describe('handlePostbackEvent', () => {
    it('handles confirm_reminder postback action with contextual suggestion bubble', async () => {
      const event = {
        type: 'postback' as const,
        replyToken: 'token-pb-confirm',
        source: { userId: 'user-123' },
        postback: {
          data: 'action=confirm_reminder',
        },
      } as unknown as webhook.PostbackEvent;

      await handlePostbackEvent(event);

      expect(handleConfirmReminder).toHaveBeenCalledWith(expect.any(Object));
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-pb-confirm',
        messages: [
          { type: 'text', text: 'ตั้งเตือนเรียบร้อยแล้วค่ะ: กินยา เวลา 19:00 น.' },
          {
            type: 'text',
            text: 'หากต้องการให้หนูช่วยจดบันทึกข้อความ หรือตั้งนาฬิกาปลุก บอกหนูได้ตลอดเวลาเลยนะคะ',
          },
        ],
      });
      expect(saveMessages).toHaveBeenCalledWith(
        'user-123',
        'ยืนยัน',
        'ตั้งเตือนเรียบร้อยแล้วค่ะ: กินยา เวลา 19:00 น.',
      );
    });

    it('handles cancel_reminder postback action with contextual suggestion bubble', async () => {
      const event = {
        type: 'postback' as const,
        replyToken: 'token-pb-cancel',
        source: { userId: 'user-123' },
        postback: {
          data: 'action=cancel_reminder',
        },
      } as unknown as webhook.PostbackEvent;

      await handlePostbackEvent(event);

      expect(handleCancelAction).toHaveBeenCalledWith(expect.any(Object));
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-pb-cancel',
        messages: [
          { type: 'text', text: 'ยกเลิกการบันทึกเรียบร้อยแล้วค่ะ' },
          {
            type: 'text',
            text: 'คุณตาคุณยายสามารถบอกให้หนูช่วยตั้งเตือน ตั้งนาฬิกาปลุก หรือจดบันทึกเรื่องอื่นได้เสมอนะคะ',
          },
        ],
      });
      expect(saveMessages).toHaveBeenCalledWith(
        'user-123',
        'ยกเลิก',
        'ยกเลิกการบันทึกเรียบร้อยแล้วค่ะ',
      );
    });

    it('handles change_reminder_time postback action with datetime parameter', async () => {
      const updatedFlex: messagingApi.FlexMessage = {
        type: 'flex',
        altText: '⏰ ยืนยันเตือน: กินยา เวลา 20:00 น.',
        contents: { type: 'bubble' },
      };
      vi.mocked(handleUpdatePendingReminderTime).mockResolvedValueOnce({
        success: true,
        flexMessage: updatedFlex,
      });

      const event = {
        type: 'postback' as const,
        replyToken: 'token-pb-time',
        source: { userId: 'user-123' },
        postback: {
          data: 'action=change_reminder_time',
          params: { datetime: '2026-10-26T20:00' },
        },
      } as unknown as webhook.PostbackEvent;

      await handlePostbackEvent(event);

      expect(handleUpdatePendingReminderTime).toHaveBeenCalledWith(
        expect.any(Object),
        '2026-10-26T20:00',
      );
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-pb-time',
        messages: [updatedFlex],
      });
      expect(saveMessages).toHaveBeenCalledWith(
        'user-123',
        'เปลี่ยนเวลาเป็น 2026-10-26T20:00',
        '⏰ ยืนยันเตือน: กินยา เวลา 20:00 น.',
      );
    });

    it('does not process if replyToken or userId is missing', async () => {
      const noTokenEvent = {
        type: 'postback' as const,
        source: { userId: 'user-123' },
        postback: { data: 'action=confirm_reminder' },
      } as unknown as webhook.PostbackEvent;

      await handlePostbackEvent(noTokenEvent);
      expect(lineClient.replyMessage).not.toHaveBeenCalled();

      const noUserEvent = {
        type: 'postback' as const,
        replyToken: 'token-no-user',
        postback: { data: 'action=confirm_reminder' },
      } as unknown as webhook.PostbackEvent;

      await handlePostbackEvent(noUserEvent);
      expect(lineClient.replyMessage).not.toHaveBeenCalled();
    });
  });

  describe('Contextual Feature Suggestions Chat Bubble', () => {
    it('attaches complementary suggestions underneath note flex message when saving a note', async () => {
      const mockFlex: messagingApi.FlexMessage = {
        type: 'flex',
        altText: '📝 สรุปบันทึก: ซื้อนม 2 กล่อง',
        contents: { type: 'bubble' },
      };

      vi.mocked(classifyIntent).mockResolvedValueOnce({
        intent: 'save_note',
        confidence: 0.98,
        isAmbiguous: false,
      });

      vi.mocked(executeTool).mockResolvedValueOnce({
        success: true,
        flexMessage: mockFlex,
        data: { summary: 'ซื้อนม 2 กล่อง' },
      });

      const event = {
        type: 'message' as const,
        replyToken: 'token-note-suggest',
        source: { userId: 'user-123' },
        message: {
          id: 'msg-note-sug',
          type: 'text' as const,
          text: 'ช่วยจดว่าซื้อนม 2 กล่อง',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-note-suggest',
        messages: [
          mockFlex,
          {
            type: 'text',
            text: 'หนูยังช่วยตั้งเตือนความจำ (เช่น เตือนกินยา) หรือตั้งนาฬิกาปลุกให้ได้ด้วยนะคะ อยากให้หนูช่วยตั้งเตือนหรือตั้งนาฬิกาปลุกเรื่องนี้ด้วยไหมคะ',
          },
        ],
      });
    });

    it('attaches complementary suggestions underneath text reply when setting an alarm', async () => {
      vi.mocked(classifyIntent).mockResolvedValueOnce({
        intent: 'set_alarm',
        confidence: 0.99,
        isAmbiguous: false,
      });

      vi.mocked(executeTool).mockResolvedValueOnce({
        success: true,
        message: 'ตั้งนาฬิกาปลุกเวลา 06:00 น. เรียบร้อยแล้วค่ะ ⏰',
      });

      const event = {
        type: 'message' as const,
        replyToken: 'token-alarm-suggest',
        source: { userId: 'user-123' },
        message: {
          id: 'msg-alarm-sug',
          type: 'text' as const,
          text: 'ปลุก 6 โมงเช้า',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-alarm-suggest',
        messages: [
          { type: 'text', text: 'ตั้งนาฬิกาปลุกเวลา 06:00 น. เรียบร้อยแล้วค่ะ ⏰' },
          {
            type: 'text',
            text: 'นอกจากนี้ หนูยังช่วยตั้งเตือนความจำ (เช่น เตือนกินยา) หรือช่วยจดบันทึกข้อความให้ได้ด้วยนะคะ บอกหนูได้ตลอดเวลาเลยนะคะ',
          },
        ],
      });
    });

    it('attaches complementary suggestions underneath text reply when setting a reminder', async () => {
      vi.mocked(classifyIntent).mockResolvedValueOnce({
        intent: 'set_reminder',
        confidence: 0.99,
        isAmbiguous: false,
      });

      vi.mocked(executeTool).mockResolvedValueOnce({
        success: true,
        message: 'ตั้งเตือนเรียบร้อยแล้วค่ะ: กินยาตอนสองทุ่ม 🔔',
      });

      const event = {
        type: 'message' as const,
        replyToken: 'token-rem-suggest',
        source: { userId: 'user-123' },
        message: {
          id: 'msg-rem-sug',
          type: 'text' as const,
          text: 'เตือนกินยาตอนสองทุ่ม',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-rem-suggest',
        messages: [
          { type: 'text', text: 'ตั้งเตือนเรียบร้อยแล้วค่ะ: กินยาตอนสองทุ่ม 🔔' },
          {
            type: 'text',
            text: 'นอกจากนี้ หนูยังช่วยจดบันทึกข้อความ (เช่น จดเรื่องสำคัญ) หรือตั้งนาฬิกาปลุกให้ได้ด้วยนะคะ บอกหนูได้ตลอดเวลาเลยนะคะ',
          },
        ],
      });
    });

    it('attaches full capabilities chat bubble when user asks "ทำอะไรได้บ้าง"', async () => {
      vi.mocked(classifyIntent).mockResolvedValueOnce({
        intent: 'general_chat',
        confidence: 0.95,
        isAmbiguous: false,
      });

      vi.mocked(executeTool).mockResolvedValueOnce({
        success: true,
        message: 'ยินดีค่ะคุณยาย',
      });

      const event = {
        type: 'message' as const,
        replyToken: 'token-capabilities-suggest',
        source: { userId: 'user-123' },
        message: {
          id: 'msg-cap-sug',
          type: 'text' as const,
          text: 'หนูทำอะไรได้บ้างคะ',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-capabilities-suggest',
        messages: [
          { type: 'text', text: 'ยินดีค่ะคุณยาย' },
          {
            type: 'text',
            text: expect.stringContaining('• ตั้งเตือนความจำ'),
          },
        ],
      });
    });

    it('suppresses suggestion bubble when disableSuggestions option is true', async () => {
      vi.mocked(classifyIntent).mockResolvedValueOnce({
        intent: 'set_alarm',
        confidence: 0.99,
        isAmbiguous: false,
      });

      vi.mocked(executeTool).mockResolvedValueOnce({
        success: true,
        message: 'ตั้งนาฬิกาปลุกเวลา 06:00 น. เรียบร้อยแล้วค่ะ ⏰',
      });

      const event = {
        type: 'message' as const,
        replyToken: 'token-alarm-no-suggest',
        source: { userId: 'user-123' },
        message: {
          id: 'msg-alarm-no-sug',
          type: 'text' as const,
          text: 'ปลุก 6 โมงเช้า',
        },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event, undefined, { disableSuggestions: true });

      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'token-alarm-no-suggest',
        messages: [{ type: 'text', text: 'ตั้งนาฬิกาปลุกเวลา 06:00 น. เรียบร้อยแล้วค่ะ ⏰' }],
      });
    });
  });

  describe('handleWebhookEvent', () => {
    it('routes postback event to postback handler', async () => {
      const event = {
        type: 'postback' as const,
        replyToken: 'token-pb-route',
        source: { userId: 'user-123' },
        postback: {
          data: 'action=confirm_reminder',
        },
      } as unknown as webhook.Event;

      await handleWebhookEvent(event);

      expect(handleConfirmReminder).toHaveBeenCalledTimes(1);
      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
    });

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

  describe('Loading Animation Integration', () => {
    it('triggers loading animation before heavy AI pipeline in 1-on-1 text message', async () => {
      const event = {
        type: 'message',
        source: { type: 'user', userId: 'user-123' },
        replyToken: 'token-load-1',
        message: { id: 'msg-load-1', type: 'text', text: 'เตือนกินยาตอนบ่าย 3 โมง' },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(lineClient.showLoadingAnimation).toHaveBeenCalledWith({
        chatId: 'user-123',
        loadingSeconds: 60,
      });
      expect(lineClient.replyMessage).toHaveBeenCalled();
    });

    it('does not trigger loading animation if event source is not a 1-on-1 user chat', async () => {
      const event = {
        type: 'message',
        source: { type: 'group', groupId: 'group-123', userId: 'user-123' },
        replyToken: 'token-load-group',
        message: { id: 'msg-load-group', type: 'text', text: 'เตือนกินยา' },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(lineClient.showLoadingAnimation).not.toHaveBeenCalled();
      expect(lineClient.replyMessage).toHaveBeenCalled();
    });

    it('does not trigger loading animation if loadingAlreadyStarted option is true', async () => {
      const event = {
        type: 'message',
        source: { type: 'user', userId: 'user-123' },
        replyToken: 'token-load-already',
        message: { id: 'msg-load-already', type: 'text', text: 'สวัสดีค่ะ' },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event, undefined, { loadingAlreadyStarted: true });

      expect(lineClient.showLoadingAnimation).not.toHaveBeenCalled();
      expect(lineClient.replyMessage).toHaveBeenCalled();
    });

    it('does not trigger loading animation for deterministic short-circuits like snooze', async () => {
      const event = {
        type: 'message',
        source: { type: 'user', userId: 'user-123' },
        replyToken: 'token-load-snooze',
        message: { id: 'msg-load-snooze', type: 'text', text: 'snooze_reminder:item-1' },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(lineClient.showLoadingAnimation).not.toHaveBeenCalled();
      expect(lineClient.replyMessage).toHaveBeenCalled();
    });

    it('continues processing and successfully replies even if showLoadingAnimation fails', async () => {
      vi.mocked(lineClient.showLoadingAnimation).mockRejectedValueOnce(
        new Error('LINE API 500 error'),
      );

      const event = {
        type: 'message',
        source: { type: 'user', userId: 'user-123' },
        replyToken: 'token-load-fail',
        message: { id: 'msg-load-fail', type: 'text', text: 'บันทึกว่าวันนี้ไปซื้อของ' },
      } as unknown as webhook.MessageEvent & { message: webhook.TextMessageContent };

      await handleTextMessage(event);

      expect(lineClient.showLoadingAnimation).toHaveBeenCalledWith({
        chatId: 'user-123',
        loadingSeconds: 60,
      });
      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
    });

    it('triggers loading animation at the start of handleAudioMessage before STT', async () => {
      const { processAudioMessage } = await import('@/lib/speech/handler');
      vi.mocked(processAudioMessage).mockImplementationOnce(async (evt, callback) => {
        if (callback) {
          await callback('สวัสดีจ้า');
        }
        return 'สวัสดีจ้า';
      });

      const audioEvent = {
        type: 'message',
        source: { type: 'user', userId: 'user-123' },
        replyToken: 'token-load-audio',
        message: {
          id: 'audio-load-1',
          type: 'audio',
          duration: 3000,
          contentProvider: { type: 'line' },
        },
      } as unknown as webhook.MessageEvent & { message: webhook.AudioMessageContent };

      await handleAudioMessage(audioEvent);

      expect(lineClient.showLoadingAnimation).toHaveBeenCalledTimes(1);
      expect(lineClient.showLoadingAnimation).toHaveBeenCalledWith({
        chatId: 'user-123',
        loadingSeconds: 60,
      });
      expect(lineClient.replyMessage).toHaveBeenCalled();
    });

    it('triggers loading animation in handlePostbackEvent for 1-on-1 user postback', async () => {
      const postbackEvent = {
        type: 'postback',
        source: { type: 'user', userId: 'user-123' },
        replyToken: 'token-load-postback',
        postback: { data: 'action=confirm_note' },
      } as unknown as webhook.PostbackEvent;

      await handlePostbackEvent(postbackEvent);

      expect(lineClient.showLoadingAnimation).toHaveBeenCalledWith({
        chatId: 'user-123',
        loadingSeconds: 20,
      });
      expect(lineClient.replyMessage).toHaveBeenCalled();
    });
  });
});
