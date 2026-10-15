import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleGenAI } from '@google/genai';
import { TypeSafeClient } from '@typesafe-ai/sdk';
import {
  extractAlarmParams,
  extractReminderParams,
  classifyItemType,
  ITEM_TYPE_CRITERIA,
} from '@/lib/ai/parameter-extractor';

describe('Structured Parameter Extractor (AI-04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractAlarmParams', () => {
    it('parses morning Thai time phrase into canonical 24-hour HH:mm format', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        output_text: JSON.stringify({
          time: '07:00',
          recurrence: 'once',
        }),
      });
      const mockClient = { interactions: { create: mockCreate } } as unknown as GoogleGenAI;

      const result = await extractAlarmParams('ปลุกตอน 7 โมงเช้าด้วยนะ', {
        client: mockClient,
      });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.system_instruction).toContain('Thai time conventions:');
      expect(callArgs.generation_config.temperature).toBe(0.0);
      expect(callArgs.store).toBe(false);

      expect(result).toEqual({
        time: '07:00',
        recurrence: 'once',
      });
    });

    it('parses evening Thai time phrase with recurrence', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        output_text: '```json\n{"time":"19:30","recurrence":"daily"}\n```',
      });
      const mockClient = { interactions: { create: mockCreate } } as unknown as GoogleGenAI;

      const result = await extractAlarmParams('ตั้งปลุกทุ่มครึ่งทุกวัน', {
        client: mockClient,
      });

      expect(result).toEqual({
        time: '19:30',
        recurrence: 'daily',
      });
    });

    it('returns null gracefully when time format is invalid or missing', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        output_text: 'null',
      });
      const mockClient = { interactions: { create: mockCreate } } as unknown as GoogleGenAI;

      const result = await extractAlarmParams('สวัสดีตอนเช้า', {
        client: mockClient,
      });

      expect(result).toBeNull();
    });

    it('returns null immediately for empty or whitespace text without API call', async () => {
      const mockCreate = vi.fn();
      const mockClient = { interactions: { create: mockCreate } } as unknown as GoogleGenAI;

      expect(await extractAlarmParams('', { client: mockClient })).toBeNull();
      expect(await extractAlarmParams('   ', { client: mockClient })).toBeNull();
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('extractReminderParams', () => {
    it('parses reminder message and scheduledAt ISO string in Asia/Bangkok', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        output_text: JSON.stringify({
          message: 'กินยาความดัน',
          scheduledAt: '2026-10-15T18:00:00+07:00',
          recurrence: 'once',
        }),
      });
      const mockClient = { interactions: { create: mockCreate } } as unknown as GoogleGenAI;

      const result = await extractReminderParams('เตือนกินยาความดันตอน 6 โมงเย็น', {
        client: mockClient,
        now: new Date('2026-10-15T08:00:00Z'),
      });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.system_instruction).toContain('Timezone: Asia/Bangkok');
      expect(result).toEqual({
        message: 'กินยาความดัน',
        scheduledAt: '2026-10-15T18:00:00+07:00',
        recurrence: 'once',
      });
    });

    it('returns null gracefully on malformed JSON or unparseable datetime', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        output_text: 'invalid json content',
      });
      const mockClient = { interactions: { create: mockCreate } } as unknown as GoogleGenAI;

      const result = await extractReminderParams('ช่วยเตือนอะไรสักอย่างหน่อย', {
        client: mockClient,
      });

      expect(result).toBeNull();
    });
  });

  describe('classifyItemType', () => {
    it('exports criteria for alarm, reminder, note, and all items', () => {
      expect(ITEM_TYPE_CRITERIA.alarm).toBeDefined();
      expect(ITEM_TYPE_CRITERIA.reminder).toBeDefined();
      expect(ITEM_TYPE_CRITERIA.note).toBeDefined();
      expect(ITEM_TYPE_CRITERIA.all).toBeDefined();
    });

    it('uses Jev to disambiguate target item type for user operations', async () => {
      const mockSystemOne = vi.fn().mockResolvedValue({
        model: 'jev-latest',
        answers: {
          itemType: {
            type: 'choice',
            choice: 'reminder',
            confidence: 0.94,
          },
        },
      });
      const mockClient = { systemOne: mockSystemOne } as unknown as TypeSafeClient;

      const result = await classifyItemType('ลบการแจ้งเตือนหน่อย', undefined, {
        client: mockClient,
      });

      expect(mockSystemOne).toHaveBeenCalledTimes(1);
      const callArg = mockSystemOne.mock.calls[0][0];
      expect(callArg.state).toBe('User: ลบการแจ้งเตือนหน่อย');
      expect(callArg.questions.itemType.type).toBe('choice');
      expect(result).toEqual({
        itemType: 'reminder',
        confidence: 0.94,
      });
    });

    it('formats state with assistant response when provided', async () => {
      const mockSystemOne = vi.fn().mockResolvedValue({
        answers: {
          itemType: {
            choice: 'alarm',
            confidence: 0.91,
          },
        },
      });
      const mockClient = { systemOne: mockSystemOne } as unknown as TypeSafeClient;

      const result = await classifyItemType('ลบอันแรกจ้ะ', 'ต้องการลบรายการไหนคะ', {
        client: mockClient,
      });

      const callArg = mockSystemOne.mock.calls[0][0];
      expect(callArg.state).toBe('User: ลบอันแรกจ้ะ\nAssistant: ต้องการลบรายการไหนคะ');
      expect(result.itemType).toBe('alarm');
    });
  });
});
