import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTool } from '@/lib/tools/index';
import * as alarmTool from '@/lib/tools/alarm';
import * as reminderTool from '@/lib/tools/reminder';
import type { UserDoc } from '@/types/firestore';
import { Timestamp } from 'firebase-admin/firestore';

vi.mock('@/lib/tools/alarm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tools/alarm')>();
  return {
    ...actual,
    handleSetAlarm: vi.fn(),
  };
});

vi.mock('@/lib/tools/reminder', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tools/reminder')>();
  return {
    ...actual,
    handleSetReminder: vi.fn(),
  };
});

describe('Tool Dispatcher Router', () => {
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

  it('routes set_reminder intent to handleSetReminder', async () => {
    vi.mocked(reminderTool.handleSetReminder).mockResolvedValue({
      success: true,
      message: 'ตั้งเตือน "กินยา" เรียบร้อยแล้วค่ะ',
    });

    const result = await executeTool({
      intent: { intent: 'set_reminder', confidence: 0.96, isAmbiguous: false },
      userText: 'เตือนกินยาตอน 8 โมงเช้า',
      geminiResponse: 'รับทราบค่ะ',
      user: mockUser,
    });

    expect(reminderTool.handleSetReminder).toHaveBeenCalledWith(
      'เตือนกินยาตอน 8 โมงเช้า',
      'รับทราบค่ะ',
      mockUser,
      expect.objectContaining({}),
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe('ตั้งเตือน "กินยา" เรียบร้อยแล้วค่ะ');
  });

  it('passes through geminiResponse for general_chat or unimplemented intents', async () => {
    const result = await executeTool({
      intent: { intent: 'general_chat', confidence: 0.95, isAmbiguous: false },
      userText: 'สวัสดีตอนเช้าจ้ะ',
      geminiResponse: 'สวัสดีค่ะคุณยาย วันนี้อากาศดีนะคะ',
      user: mockUser,
    });

    expect(alarmTool.handleSetAlarm).not.toHaveBeenCalled();
    expect(reminderTool.handleSetReminder).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.message).toBe('สวัสดีค่ะคุณยาย วันนี้อากาศดีนะคะ');
  });
});
