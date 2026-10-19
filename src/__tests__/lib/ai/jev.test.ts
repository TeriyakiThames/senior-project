import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import { jevClient, classifyIntent, INTENT_CRITERIA } from '@/lib/ai/jev';
import type { IntentType } from '@/types/jev';
import { createMockJevClient } from '@/__tests__/mocks';

describe('TypeSafe AI Jev Intent Classifier (AI-03)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe('Singleton Client and Intent Criteria', () => {
    it('exports jevClient singleton and all 11 intent criteria', () => {
      expect(jevClient).toBeDefined();

      const expectedIntents: IntentType[] = [
        'set_alarm',
        'set_reminder',
        'save_note',
        'list_items',
        'delete_item',
        'update_item',
        'confirm_action',
        'cancel_action',
        'snooze',
        'dismiss',
        'general_chat',
      ];

      expectedIntents.forEach((intent) => {
        expect(INTENT_CRITERIA[intent]).toBeDefined();
        expect(typeof INTENT_CRITERIA[intent]).toBe('string');
      });
    });
  });

  describe('classifyIntent', () => {
    it('maps user input and classifies clear intent with confidence and probabilities', async () => {
      const mockSystemOne = vi.fn().mockResolvedValue({
        model: 'jev-latest',
        answers: {
          intent: {
            type: 'choice',
            choice: 'set_alarm',
            confidence: 0.96,
            probabilities: {
              set_alarm: 0.96,
              set_reminder: 0.02,
              general_chat: 0.02,
            },
          },
          is_ambiguous: {
            type: 'noul',
            noul: 0.1,
          },
        },
        usage: { input_tokens: 15, output_tokens: 10 },
      });

      const mockClient = { systemOne: mockSystemOne } as unknown as TypeSafeClient;

      const result = await classifyIntent('ปลุก 7 โมงเช้าด้วยนะ', undefined, {
        client: mockClient,
      });

      expect(mockSystemOne).toHaveBeenCalledTimes(1);
      const callArg = mockSystemOne.mock.calls[0][0];
      expect(callArg.state).toBe('User: ปลุก 7 โมงเช้าด้วยนะ');
      expect(callArg.questions.intent.type).toBe('choice');
      expect(callArg.questions.is_ambiguous.type).toBe('noul');

      expect(result).toEqual({
        intent: 'set_alarm',
        confidence: 0.96,
        isAmbiguous: false,
        probabilities: {
          set_alarm: 0.96,
          set_reminder: 0.02,
          general_chat: 0.02,
        },
      });
    });

    it('formats state with assistant response when provided', async () => {
      const mockSystemOne = vi.fn().mockResolvedValue({
        model: 'jev-latest',
        answers: {
          intent: {
            type: 'choice',
            choice: 'confirm_action',
            confidence: 0.92,
            probabilities: { confirm_action: 0.92 },
          },
          is_ambiguous: {
            type: 'noul',
            noul: 0.05,
          },
        },
        usage: { input_tokens: 20, output_tokens: 8 },
      });

      const mockClient = { systemOne: mockSystemOne } as unknown as TypeSafeClient;

      const result = await classifyIntent('ตกลงจ้ะ', 'ต้องการให้ตั้งปลุกตอน 7 โมงเช้าใช่ไหมคะ', {
        client: mockClient,
      });

      const callArg = mockSystemOne.mock.calls[0][0];
      expect(callArg.state).toBe(
        'User: ตกลงจ้ะ\nAssistant: ต้องการให้ตั้งปลุกตอน 7 โมงเช้าใช่ไหมคะ',
      );
      expect(result.intent).toBe('confirm_action');
      expect(result.isAmbiguous).toBe(false);
    });

    it('flags ambiguous input when noul ambiguity score meets or exceeds default threshold (0.5)', async () => {
      const mockSystemOne = vi.fn().mockResolvedValue({
        model: 'jev-latest',
        answers: {
          intent: {
            type: 'choice',
            choice: 'set_reminder',
            confidence: 0.88,
            probabilities: { set_reminder: 0.88 },
          },
          is_ambiguous: {
            type: 'noul',
            noul: 0.75, // Missing time/scheduledAt
          },
        },
        usage: { input_tokens: 12, output_tokens: 6 },
      });

      const mockClient = { systemOne: mockSystemOne } as unknown as TypeSafeClient;

      const result = await classifyIntent('เตือนกินยาให้ด้วย', undefined, {
        client: mockClient,
      });

      expect(result.intent).toBe('set_reminder');
      expect(result.confidence).toBe(0.88);
      expect(result.isAmbiguous).toBe(true);
    });

    it('respects custom ambiguity threshold in options', async () => {
      const mockSystemOne = vi.fn().mockResolvedValue({
        model: 'jev-latest',
        answers: {
          intent: {
            type: 'choice',
            choice: 'save_note',
            confidence: 0.85,
            probabilities: { save_note: 0.85 },
          },
          is_ambiguous: {
            type: 'noul',
            noul: 0.6,
          },
        },
        usage: { input_tokens: 14, output_tokens: 6 },
      });

      const mockClient = { systemOne: mockSystemOne } as unknown as TypeSafeClient;

      // With default threshold (0.5), noul 0.6 is ambiguous
      const resDefault = await classifyIntent('จดไว้หน่อย', undefined, {
        client: mockClient,
      });
      expect(resDefault.isAmbiguous).toBe(true);

      // With custom threshold 0.7, noul 0.6 is NOT ambiguous
      const resCustom = await classifyIntent('จดไว้หน่อย', undefined, {
        client: mockClient,
        ambiguityThreshold: 0.7,
      });
      expect(resCustom.isAmbiguous).toBe(false);
    });

    it('handles fallback on failure when fallbackOnFailure is enabled', async () => {
      const mockSystemOne = vi.fn().mockRejectedValue(new Error('TypeSafe API timeout'));
      const mockClient = { systemOne: mockSystemOne } as unknown as TypeSafeClient;

      const result = await classifyIntent('สวัสดีหลาน', undefined, {
        client: mockClient,
        fallbackOnFailure: true,
      });

      expect(result).toEqual({
        intent: 'general_chat',
        confidence: 0,
        isAmbiguous: true,
      });
    });

    it('re-throws error when fallbackOnFailure is false or omitted', async () => {
      const mockSystemOne = vi.fn().mockRejectedValue(new Error('Network error'));
      const mockClient = { systemOne: mockSystemOne } as unknown as TypeSafeClient;

      await expect(classifyIntent('สวัสดี', undefined, { client: mockClient })).rejects.toThrow(
        'Network error',
      );
    });

    describe('System Intent Routing Matrix (11 intents & unclear detection)', () => {
      const systemIntents: { intent: IntentType; sampleQuery: string }[] = [
        { intent: 'set_alarm', sampleQuery: 'ปลุก 6 โมงเช้า' },
        { intent: 'set_reminder', sampleQuery: 'เตือนกินยาวันพรุ่งนี้บ่ายสอง' },
        { intent: 'save_note', sampleQuery: 'จดบันทึกผลความดัน 120 80' },
        { intent: 'list_items', sampleQuery: 'ดูรายการเตือนความจำทั้งหมด' },
        { intent: 'delete_item', sampleQuery: 'ลบนาฬิกาปลุก 7 โมง' },
        { intent: 'update_item', sampleQuery: 'เปลี่ยนเวลาปลุกเป็น 8 โมง' },
        { intent: 'confirm_action', sampleQuery: 'ตกลง ใช่แล้ว บันทึกเลย' },
        { intent: 'cancel_action', sampleQuery: 'ยกเลิก ไม่เอาแล้ว' },
        { intent: 'snooze', sampleQuery: 'ขอเลื่อนไปอีก 10 นาที' },
        { intent: 'dismiss', sampleQuery: 'ปิดเสียง ทราบแล้วจ้า' },
        { intent: 'general_chat', sampleQuery: 'วันนี้อากาศดีจังเลยนะ' },
      ];

      it.each(systemIntents)(
        'accurately routes $intent intent for query "$sampleQuery"',
        async ({ intent, sampleQuery }) => {
          const mockClient = createMockJevClient(intent, 0.05, {
            [intent]: 0.94,
          }) as unknown as TypeSafeClient;
          const result = await classifyIntent(sampleQuery, undefined, { client: mockClient });

          expect(result.intent).toBe(intent);
          expect(result.confidence).toBe(0.94);
          expect(result.isAmbiguous).toBe(false);
          expect(mockClient.systemOne).toHaveBeenCalled();
        },
      );

      it('correctly flags unclear and ambiguous queries when confidence is low and ambiguity score is elevated', async () => {
        const mockClient = createMockJevClient('general_chat', 0.85, {
          general_chat: 0.35,
          save_note: 0.35,
        }) as unknown as TypeSafeClient;
        const result = await classifyIntent('เอ่อ คือว่า...', undefined, { client: mockClient });

        expect(result.isAmbiguous).toBe(true);
        expect(result.confidence).toBe(0.35);
      });
    });
  });
});
