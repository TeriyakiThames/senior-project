import { describe, it, expect, vi } from 'vitest';
import { AppError, logError, getFallbackMessage } from '@/lib/utils/errors';
import type { PersonaParticles } from '@/lib/ai/persona';

describe('Centralized Error Handling (errors.ts)', () => {
  describe('AppError', () => {
    it('creates an AppError instance with code and context payload', () => {
      const context = { userId: 'u-123', stage: 'stt' };
      const error = new AppError('Transcription failed', 'STT_TRANSCRIPTION_FAILED', context);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.name).toBe('AppError');
      expect(error.message).toBe('Transcription failed');
      expect(error.code).toBe('STT_TRANSCRIPTION_FAILED');
      expect(error.context).toEqual(context);
    });
  });

  describe('logError', () => {
    it('emits a single-line structured JSON record with Cloud Logging fields to console.error', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new AppError('AI quota exceeded', 'AI_QUOTA_EXCEEDED', { attempts: 3 });
      const record = logError('ai', error, { requestId: 'req-456' });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const loggedString = consoleErrorSpy.mock.calls[0][0];
      const parsed = JSON.parse(loggedString);

      expect(parsed.severity).toBe('ERROR');
      expect(parsed.stage).toBe('ai');
      expect(parsed.message).toBe('AI quota exceeded');
      expect(parsed.code).toBe('AI_QUOTA_EXCEEDED');
      expect(parsed.name).toBe('AppError');
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.context).toEqual({ requestId: 'req-456' });
      expect(record.stage).toBe('ai');

      consoleErrorSpy.mockRestore();
    });

    it('routes WARNING severity to console.warn', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logError('cache', new Error('Cache miss'), undefined, 'WARNING');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(parsed.severity).toBe('WARNING');
      expect(parsed.stage).toBe('cache');

      consoleWarnSpy.mockRestore();
    });
  });

  describe('getFallbackMessage', () => {
    it('returns warm, polite default Thai messages for each stage', () => {
      const sttMsg = getFallbackMessage('stt', 'th');
      const aiMsg = getFallbackMessage('ai', 'th');
      const toolMsg = getFallbackMessage('tool', 'th');
      const netMsg = getFallbackMessage('network', 'th');
      const defaultMsg = getFallbackMessage('default', 'th');

      expect(sttMsg).toContain('ฟังเสียงไม่ชัดเจน');
      expect(sttMsg).toContain('ค่ะ');
      expect(aiMsg).toContain('ยังไม่ค่อยเข้าใจคำสั่งนี้');
      expect(toolMsg).toContain('ดำเนินการไม่สำเร็จในตอนนี้');
      expect(netMsg).toContain('สัญญาณเชื่อมต่อติดขัดชั่วคราว');
      expect(defaultMsg).toContain('ระบบขัดข้องชั่วคราว');
    });

    it('adapts Thai messages to persona particles (จ้ะ and ครับ)', () => {
      const intimateParticles: PersonaParticles = {
        title: 'ยาย',
        affirmative: 'จ้ะ',
        question: 'จ๊ะ',
      };
      const maleParticles: PersonaParticles = {
        title: 'หลาน',
        affirmative: 'ครับ',
        question: 'ครับ',
      };

      const intimateStt = getFallbackMessage('stt', 'th', intimateParticles);
      const maleStt = getFallbackMessage('stt', 'th', maleParticles);

      expect(intimateStt).toContain('ขออภัยจ้ะ');
      expect(intimateStt).toContain('นะจ๊ะ');
      expect(maleStt).toContain('ขออภัยครับ');
      expect(maleStt).toContain('นะครับ');
    });

    it('returns polite English messages for each stage without technical jargon', () => {
      const sttMsg = getFallbackMessage('stt', 'en');
      const aiMsg = getFallbackMessage('ai', 'en');
      const toolMsg = getFallbackMessage('tool', 'en');
      const netMsg = getFallbackMessage('network', 'en');
      const defaultMsg = getFallbackMessage('unknown_stage', 'en');

      expect(sttMsg).toContain("Sorry, I couldn't understand the audio clearly");
      expect(aiMsg).toContain("I'm sorry, I didn't quite understand that");
      expect(toolMsg).toContain("Sorry, I wasn't able to complete that request");
      expect(netMsg).toContain('The connection is temporarily interrupted');
      expect(defaultMsg).toContain('Something went wrong temporarily');
    });
  });
});
