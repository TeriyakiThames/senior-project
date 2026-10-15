import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadMemoryContext, updateUserProfile, getBangkokDateString } from '@/lib/ai/memory';
import * as collections from '@/lib/firebase/collections';
import * as gemini from '@/lib/ai/gemini';
import type { UserDoc, MessageDoc } from '@/types/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import type { GoogleGenAI } from '@google/genai';

vi.mock('@/lib/firebase/collections', () => ({
  userRef: vi.fn(),
  messagesRef: vi.fn(),
  getRecentMessages: vi.fn(),
}));

vi.mock('@/lib/ai/gemini', () => ({
  geminiClient: {
    interactions: {
      create: vi.fn(),
    },
  },
  generateDailySummary: vi.fn(),
}));

describe('Three-Tier Memory Manager (AI-05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBangkokDateString', () => {
    it('formats date to YYYY-MM-DD in Asia/Bangkok', () => {
      // 2026-10-15 18:00 UTC is 2026-10-16 01:00 in Bangkok (UTC+7)
      const date = new Date('2026-10-15T18:00:00Z');
      expect(getBangkokDateString(date)).toBe('2026-10-16');
    });
  });

  describe('loadMemoryContext', () => {
    it('returns empty context when user document does not exist', async () => {
      const mockGet = vi.fn().mockResolvedValue({ exists: false });
      vi.mocked(collections.userRef).mockReturnValue({
        get: mockGet,
      } as unknown as ReturnType<typeof collections.userRef>);

      const result = await loadMemoryContext('U_nonexistent');

      expect(result).toEqual({
        recentMessages: [],
        userFacts: [],
      });
      expect(collections.getRecentMessages).not.toHaveBeenCalled();
    });

    it('loads short-term messages and returns same-day daily summary without rollover', async () => {
      const fixedNow = new Date('2026-10-15T10:00:00+07:00');
      const todayStr = '2026-10-15';

      const mockUser: UserDoc = {
        lineUserId: 'U12345',
        displayName: 'สมศรี',
        language: 'th',
        timezone: 'Asia/Bangkok',
        firebaseUid: 'uid-123',
        createdAt: Timestamp.now(),
        profile: {
          facts: ['ชอบกินต้มยำกุ้ง', 'หลานชื่อบอย'],
          updatedAt: Timestamp.now(),
        },
        dailySummary: {
          date: todayStr,
          summary: '- คุยเรื่องสุขภาพตอนเช้า',
          generatedAt: Timestamp.now(),
        },
      };

      const mockMessages: MessageDoc[] = [
        { role: 'user', content: 'สวัสดีตอนเช้า', timestamp: Timestamp.now() },
        { role: 'assistant', content: 'สวัสดีค่ะ', timestamp: Timestamp.now() },
      ];

      vi.mocked(collections.userRef).mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => mockUser,
        }),
      } as unknown as ReturnType<typeof collections.userRef>);

      vi.mocked(collections.getRecentMessages).mockResolvedValue(mockMessages);

      const context = await loadMemoryContext('U12345', { now: fixedNow });

      expect(collections.getRecentMessages).toHaveBeenCalledWith('U12345', 10);
      expect(context.user).toEqual(mockUser);
      expect(context.recentMessages).toEqual(mockMessages);
      expect(context.userFacts).toEqual(['ชอบกินต้มยำกุ้ง', 'หลานชื่อบอย']);
      expect(context.dailySummary).toEqual({
        date: todayStr,
        summary: '- คุยเรื่องสุขภาพตอนเช้า',
      });
      expect(gemini.generateDailySummary).not.toHaveBeenCalled();
    });

    it('triggers generateDailySummary and updates user doc on rollover to a new calendar day', async () => {
      const fixedNow = new Date('2026-10-16T08:00:00+07:00');
      const todayStr = '2026-10-16';
      const yesterdayStr = '2026-10-15';

      const mockUser: UserDoc = {
        lineUserId: 'U12345',
        displayName: 'สมศรี',
        language: 'th',
        timezone: 'Asia/Bangkok',
        firebaseUid: 'uid-123',
        createdAt: Timestamp.now(),
        profile: {
          facts: ['ชอบกินต้มยำกุ้ง'],
          updatedAt: Timestamp.now(),
        },
        dailySummary: {
          date: yesterdayStr,
          summary: '- สรุปของเมื่อวาน',
          generatedAt: Timestamp.now(),
        },
      };

      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      vi.mocked(collections.userRef).mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ ...mockUser }),
        }),
        update: mockUpdate,
      } as unknown as ReturnType<typeof collections.userRef>);

      vi.mocked(collections.getRecentMessages).mockResolvedValue([]);

      const mockYesterdayMessages: MessageDoc[] = [
        { role: 'user', content: 'กินยาแล้วนะ', timestamp: Timestamp.now() },
        { role: 'assistant', content: 'เก่งมากค่ะ', timestamp: Timestamp.now() },
      ];

      vi.mocked(collections.messagesRef).mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: mockYesterdayMessages.map((m) => ({ data: () => m })),
            }),
          }),
        }),
      } as unknown as ReturnType<typeof collections.messagesRef>);

      vi.mocked(gemini.generateDailySummary).mockResolvedValue(
        '- ผู้ใช้กินยาตามเวลา\n- คุยทักทายกับหลาน',
      );

      const context = await loadMemoryContext('U12345', { now: fixedNow });

      expect(gemini.generateDailySummary).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          'dailySummary.date': todayStr,
          'dailySummary.summary': '- ผู้ใช้กินยาตามเวลา\n- คุยทักทายกับหลาน',
        }),
      );
      expect(context.dailySummary).toEqual({
        date: todayStr,
        summary: '- ผู้ใช้กินยาตามเวลา\n- คุยทักทายกับหลาน',
      });
    });
  });

  describe('updateUserProfile', () => {
    it('extracts novel facts, trims whitespace, deduplicates, and saves to Firestore', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        output_text: '```json\n["  ชอบดื่มชาเขียว  ", "หลานชื่อน้ำหวาน", "ชอบกินต้มยำกุ้ง"]\n```',
      });

      const mockClient = {
        interactions: { create: mockCreate },
      } as unknown as GoogleGenAI;

      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      vi.mocked(collections.userRef).mockReturnValue({
        update: mockUpdate,
      } as unknown as ReturnType<typeof collections.userRef>);

      const existingFacts = ['ชอบกินต้มยำกุ้ง'];
      const updated = await updateUserProfile(
        'U12345',
        'หลานชื่อน้ำหวานนะ ยายชอบดื่มชาเขียว',
        'จำได้แล้วค่ะคุณยาย',
        existingFacts,
        { client: mockClient },
      );

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          'profile.facts': ['ชอบกินต้มยำกุ้ง', 'ชอบดื่มชาเขียว', 'หลานชื่อน้ำหวาน'],
        }),
      );
      expect(updated).toEqual(['ชอบกินต้มยำกุ้ง', 'ชอบดื่มชาเขียว', 'หลานชื่อน้ำหวาน']);
    });

    it('does not write to Firestore if no new facts are discovered', async () => {
      const mockCreate = vi.fn().mockResolvedValue({
        output_text: '[]',
      });

      const mockClient = {
        interactions: { create: mockCreate },
      } as unknown as GoogleGenAI;

      const mockUpdate = vi.fn();
      vi.mocked(collections.userRef).mockReturnValue({
        update: mockUpdate,
      } as unknown as ReturnType<typeof collections.userRef>);

      const existingFacts = ['ชอบกินต้มยำกุ้ง'];
      const updated = await updateUserProfile(
        'U12345',
        'วันนี้อากาศดีจัง',
        'ใช่ค่ะคุณยาย',
        existingFacts,
        { client: mockClient },
      );

      expect(mockUpdate).not.toHaveBeenCalled();
      expect(updated).toEqual(existingFacts);
    });

    it('caps total facts at 50 using FIFO strategy when limit is exceeded', async () => {
      // 49 existing facts
      const existingFacts = Array.from({ length: 49 }, (_, i) => `fact_${i + 1}`);

      const mockCreate = vi.fn().mockResolvedValue({
        output_text: JSON.stringify(['new_fact_a', 'new_fact_b', 'new_fact_c']),
      });

      const mockClient = {
        interactions: { create: mockCreate },
      } as unknown as GoogleGenAI;

      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      vi.mocked(collections.userRef).mockReturnValue({
        update: mockUpdate,
      } as unknown as ReturnType<typeof collections.userRef>);

      const updated = await updateUserProfile(
        'U12345',
        'เพิ่มข้อมูลใหม่',
        'รับทราบค่ะ',
        existingFacts,
        { client: mockClient },
      );

      expect(updated).toHaveLength(50);
      // Older facts dropped (FIFO)
      expect(updated).not.toContain('fact_1');
      expect(updated).not.toContain('fact_2');
      expect(updated).toContain('fact_3');
      expect(updated).toContain('new_fact_a');
      expect(updated).toContain('new_fact_b');
      expect(updated).toContain('new_fact_c');
    });

    it('catches and handles errors gracefully without throwing unhandled rejections', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Gemini API connection error'));
      const mockClient = {
        interactions: { create: mockCreate },
      } as unknown as GoogleGenAI;

      const existingFacts = ['เดิม'];
      const updated = await updateUserProfile('U12345', 'สวัสดี', 'สวัสดีค่ะ', existingFacts, {
        client: mockClient,
      });

      expect(updated).toEqual(existingFacts);
    });
  });
});
