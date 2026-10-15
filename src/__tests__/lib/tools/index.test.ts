import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTool } from '@/lib/tools/index';
import * as alarmTool from '@/lib/tools/alarm';
import type { UserDoc } from '@/types/firestore';
import { Timestamp } from 'firebase-admin/firestore';

vi.mock('@/lib/tools/alarm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tools/alarm')>();
  return {
    ...actual,
    handleSetAlarm: vi.fn(),
  };
});

describe('Tool Dispatcher Router (SCHED-03)', () => {
  const mockUser: UserDoc = {
    lineUserId: 'U_ROUTER_USER_001',
    displayName: 'คุณยายสมใจ',
    language: 'th',
    timezone: 'Asia/Bangkok',
    firebaseUid: 'uid-001',
    createdAt: Timestamp.now(),
    profile: { facts: [], updatedAt: Timestamp.now() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes set_alarm intent to handleSetAlarm', async () => {
    vi.mocked(alarmTool.handleSetAlarm).mockResolvedValue({
      success: true,
      message: 'ตั้งปลุกเรียบร้อยแล้วค่ะ',
    });

    const result = await executeTool({
      intent: { intent: 'set_alarm', confidence: 0.98, isAmbiguous: false },
      userText: 'ตั้งปลุก 7 โมงเช้า',
      geminiResponse: 'รับทราบค่ะ',
      user: mockUser,
    });

    expect(alarmTool.handleSetAlarm).toHaveBeenCalledWith(
      'ตั้งปลุก 7 โมงเช้า',
      'รับทราบค่ะ',
      mockUser,
      expect.objectContaining({}),
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe('ตั้งปลุกเรียบร้อยแล้วค่ะ');
  });

  it('passes through geminiResponse for general_chat or unimplemented intents', async () => {
    const result = await executeTool({
      intent: { intent: 'general_chat', confidence: 0.95, isAmbiguous: false },
      userText: 'สวัสดีตอนเช้าจ้ะ',
      geminiResponse: 'สวัสดีค่ะคุณยาย วันนี้อากาศดีนะคะ',
      user: mockUser,
    });

    expect(alarmTool.handleSetAlarm).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.message).toBe('สวัสดีค่ะคุณยาย วันนี้อากาศดีนะคะ');
  });
});
