import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleGenAI } from '@google/genai';
import {
  ai,
  geminiClient,
  generateResponse,
  summarizeNote,
  generateDailySummary,
} from '@/lib/ai/gemini';
import type { UserDoc, MessageDoc } from '@/types/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { createMockGeminiClient, createMockUserDoc } from '@/__tests__/mocks';

describe('Gemini 3.5 Flash-Lite Client (AI-02)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe('Singleton Client', () => {
    it('initializes and exports ai and geminiClient singleton', () => {
      expect(ai).toBeDefined();
      expect(geminiClient).toBe(ai);
    });
  });

  describe('generateResponse', () => {
    const mockUser: UserDoc = createMockUserDoc({
      displayName: 'สมศรี',
      profile: {
        facts: ['กินยาความดันตอนเช้า', 'particle:ค่ะ'],
        updatedAt: Timestamp.now(),
      },
      dailySummary: {
        date: '2026-10-15',
        summary: 'คุยเรื่องไปโรงพยาบาล',
        generatedAt: Timestamp.now(),
      },
    });

    const mockMessages: MessageDoc[] = [
      {
        role: 'user',
        content: 'สวัสดีหลาน',
        timestamp: Timestamp.now(),
      },
      {
        role: 'assistant',
        content: 'สวัสดีค่ะคุณยาย มีอะไรให้หลานช่วยไหมคะ',
        timestamp: Timestamp.now(),
      },
    ];

    it('passes system instruction, format-mapped history, and store: false', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'interaction-abc',
        output_text: 'ได้เลยค่ะคุณยาย หลานช่วยจดให้นะคะ',
      });

      const mockClient = {
        interactions: { create: mockCreate },
      } as unknown as GoogleGenAI;

      const frozenNow = new Date('2026-10-15T08:00:00Z');
      const result = await generateResponse('เตือนกินยาด้วยนะ', mockUser, mockMessages, {
        client: mockClient,
        now: frozenNow,
      });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];

      expect(callArgs.model).toBe('gemini-3.5-flash-lite');
      expect(callArgs.store).toBe(false);
      expect(callArgs.generation_config).toEqual({
        temperature: 0.7,
        max_output_tokens: 1024,
      });

      // Context checks
      expect(callArgs.input).toContain('Previous conversation:');
      expect(callArgs.input).toContain('User: สวัสดีหลาน');
      expect(callArgs.input).toContain('Assistant: สวัสดีค่ะคุณยาย มีอะไรให้หลานช่วยไหมคะ');
      expect(callArgs.input).toContain('User: เตือนกินยาด้วยนะ');

      // System instruction checks
      expect(callArgs.system_instruction).toContain('กินยาความดันตอนเช้า');
      expect(callArgs.system_instruction).toContain('คุยเรื่องไปโรงพยาบาล');

      // Result
      expect(result).toEqual({
        responseText: 'ได้เลยค่ะคุณยาย หลานช่วยจดให้นะคะ',
        interactionId: 'interaction-abc',
      });
    });

    it('handles empty message history without Previous conversation header', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'interaction-xyz',
        output_text: 'สวัสดีค่ะ',
      });

      const mockClient = {
        interactions: { create: mockCreate },
      } as unknown as GoogleGenAI;

      const result = await generateResponse('สวัสดี', mockUser, [], { client: mockClient });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];

      expect(callArgs.input).toBe('สวัสดี');
      expect(result.responseText).toBe('สวัสดีค่ะ');
    });

    it('honors model override if passed in options', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'interaction-custom',
        output_text: 'ตอบกลับแล้วค่ะ',
      });

      const mockClient = {
        interactions: { create: mockCreate },
      } as unknown as GoogleGenAI;

      await generateResponse('สวัสดี', mockUser, [], {
        client: mockClient,
        model: 'gemini-3.8-flash',
      });

      expect(mockCreate.mock.calls[0][0].model).toBe('gemini-3.8-flash');
    });
  });

  describe('summarizeNote', () => {
    it('returns empty string if note content is empty or whitespace', async () => {
      const mockCreate = vi.fn();
      const mockClient = {
        interactions: { create: mockCreate },
      } as unknown as GoogleGenAI;

      const resEmpty = await summarizeNote('', { client: mockClient });
      const resSpaces = await summarizeNote('   ', { client: mockClient });

      expect(resEmpty).toBe('');
      expect(resSpaces).toBe('');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('condenses note content with store: false and returns summary', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'interaction-sum',
        output_text: 'นัดคุณหมอสมชาย วันศุกร์ที่ 20 เวลา 10:00 น. ตรวจเบาหวาน',
      });

      const mockClient = {
        interactions: { create: mockCreate },
      } as unknown as GoogleGenAI;

      const noteText =
        'วันศุกร์ที่ 20 นี้มีนัดกับคุณหมอสมชายที่คลินิกชั้น 2 ตอน 10 โมงเช้า อย่าลืมงดน้ำงดอาหารไปตรวจเบาหวานด้วยนะลูก';

      const summary = await summarizeNote(noteText, { client: mockClient });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];

      expect(callArgs.model).toBe('gemini-3.5-flash-lite');
      expect(callArgs.store).toBe(false);
      expect(callArgs.input).toBe(noteText);
      expect(callArgs.system_instruction).toContain('ไม่เกิน 2-3 ประโยค');
      expect(callArgs.generation_config).toEqual({
        temperature: 0.3,
        max_output_tokens: 256,
      });

      expect(summary).toBe('นัดคุณหมอสมชาย วันศุกร์ที่ 20 เวลา 10:00 น. ตรวจเบาหวาน');
    });

    it('supports English summary when requested', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'interaction-sum-en',
        output_text: 'Doctor appointment on Friday 20th at 10 AM.',
      });

      const mockClient = {
        interactions: { create: mockCreate },
      } as unknown as GoogleGenAI;

      await summarizeNote('Doctor appointment Friday at 10am', {
        client: mockClient,
        language: 'en',
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.system_instruction).toContain('Summarize this note concisely');
    });

    it('falls back to raw content if output_text is null or empty', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'interaction-blank',
        output_text: null,
      });

      const mockClient = {
        interactions: { create: mockCreate },
      } as unknown as GoogleGenAI;

      const rawContent = 'เนื้อหาดิบ';
      const summary = await summarizeNote(rawContent, { client: mockClient });

      expect(summary).toBe(rawContent);
    });
  });

  describe('generateDailySummary', () => {
    it('returns empty string if messages list is empty', async () => {
      const mockCreate = vi.fn();
      const mockClient = {
        interactions: { create: mockCreate },
      } as unknown as GoogleGenAI;

      const res = await generateDailySummary([], { client: mockClient });

      expect(res).toBe('');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('aggregates transcript and generates 3-5 bullet points with store: false', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        id: 'interaction-daily',
        output_text:
          '- ผู้ใช้ตั้งปลุกตอน 7 โมงเช้า\n- ผู้ใช้บันทึกโน้ตเรื่องยาความดัน\n- สอบถามสภาพอากาศช่วงบ่าย',
      });

      const mockClient = {
        interactions: { create: mockCreate },
      } as unknown as GoogleGenAI;

      const messages: MessageDoc[] = [
        {
          role: 'user',
          content: 'ตั้งปลุก 7 โมงเช้าให้หน่อย',
          timestamp: Timestamp.now(),
        },
        {
          role: 'assistant',
          content: 'ตั้งปลุกเรียบร้อยแล้วค่ะ',
          timestamp: Timestamp.now(),
        },
      ];

      const summary = await generateDailySummary(messages, { client: mockClient });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];

      expect(callArgs.model).toBe('gemini-3.5-flash-lite');
      expect(callArgs.store).toBe(false);
      expect(callArgs.input).toContain('ผู้ใช้: ตั้งปลุก 7 โมงเช้าให้หน่อย');
      expect(callArgs.input).toContain('ผู้ช่วย: ตั้งปลุกเรียบร้อยแล้วค่ะ');
      expect(callArgs.system_instruction).toContain('3-5 หัวข้อย่อย');
      expect(callArgs.generation_config).toEqual({
        temperature: 0.3,
        max_output_tokens: 512,
      });

      expect(summary).toContain('- ผู้ใช้ตั้งปลุกตอน 7 โมงเช้า');
    });
  });

  describe('Error handling', () => {
    it('propagates API errors when Google GenAI SDK fails', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Gemini API quota exceeded'));

      const mockClient = {
        interactions: { create: mockCreate },
      } as unknown as GoogleGenAI;

      const mockUser: UserDoc = {
        lineUserId: 'U12345678',
        displayName: 'สมศรี',
        language: 'th',
        timezone: 'Asia/Bangkok',
        firebaseUid: 'uid-123',
        createdAt: Timestamp.now(),
        profile: { facts: [], updatedAt: Timestamp.now() },
      };

      await expect(
        generateResponse('สวัสดี', mockUser, [], { client: mockClient }),
      ).rejects.toThrow('Gemini API quota exceeded');
    });
  });
});
