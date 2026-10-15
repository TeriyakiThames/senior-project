import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, formatBangkokDateTime } from '@/lib/ai/system-prompt';

const FROZEN_NOW = new Date('2026-10-15T13:34:00Z');

describe('formatBangkokDateTime', () => {
  it('formats Asia/Bangkok time in Thai with a Gregorian year', () => {
    const formatted = formatBangkokDateTime(FROZEN_NOW);

    expect(formatted).toContain('2026');
    expect(formatted).not.toContain('2569');
    expect(formatted).toMatch(/ตุลาคม/);
    expect(formatted).toMatch(/15/);
  });
});

describe('buildSystemPrompt', () => {
  it('uses default ค่ะ/คะ particles, timestamp, and no daily summary when profile is empty', () => {
    const prompt = buildSystemPrompt({ now: FROZEN_NOW });

    expect(prompt).toContain('หลานที่ใจดี');
    expect(prompt).toContain('"ค่ะ"');
    expect(prompt).toContain('"คะ"');
    expect(prompt).toContain(formatBangkokDateTime(FROZEN_NOW));
    expect(prompt).toContain('ยังไม่มีข้อมูลที่เรียนรู้เกี่ยวกับผู้ใช้');
    expect(prompt).not.toContain('สรุปวันนี้');
  });

  it('interpolates populated profile facts and ครับ particles', () => {
    const prompt = buildSystemPrompt({
      now: FROZEN_NOW,
      profileFacts: ['particle:ครับ', 'กินยาความดันตอนเช้า'],
    });

    expect(prompt).toContain('particle:ครับ');
    expect(prompt).toContain('กินยาความดันตอนเช้า');
    expect(prompt).toContain('"ครับ"');
    expect(prompt).toContain('เรียกผู้ใช้ว่า "หลาน"');
    expect(prompt).not.toContain('ยังไม่มีข้อมูลที่เรียนรู้เกี่ยวกับผู้ใช้');
  });

  it('interpolates the daily summary when present', () => {
    const prompt = buildSystemPrompt({
      now: FROZEN_NOW,
      dailySummary: {
        date: '2026-10-15',
        summary: 'วันนี้คุยเรื่องนัดหมอตอนบ่าย',
      },
    });

    expect(prompt).toContain('## สรุปวันนี้ (2026-10-15)');
    expect(prompt).toContain('วันนี้คุยเรื่องนัดหมอตอนบ่าย');
  });

  it('omits the daily summary block when it is absent', () => {
    const prompt = buildSystemPrompt({
      now: FROZEN_NOW,
      dailySummary: null,
    });

    expect(prompt).not.toContain('สรุปวันนี้');
    expect(prompt).not.toContain('วันนี้คุยเรื่องนัดหมอตอนบ่าย');
  });

  it('includes jargon bans and tool-talk instructions', () => {
    const prompt = buildSystemPrompt({ now: FROZEN_NOW });

    expect(prompt).toMatch(/API/);
    expect(prompt).toMatch(/JSON/);
    expect(prompt).toMatch(/token/i);
    expect(prompt).toMatch(/database/i);
    expect(prompt).toContain('ถ้าคำขอคลุมเครือ');
    expect(prompt).toContain('ก่อนบันทึกโน้ต');
    expect(prompt).toContain('รอการยืนยัน');
  });
});
