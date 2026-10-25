import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTool } from '@/lib/tools/index';
import * as alarmTool from '@/lib/tools/alarm';
import * as reminderTool from '@/lib/tools/reminder';
import * as notesTool from '@/lib/tools/notes';
import * as collections from '@/lib/firebase/collections';
import type { UserDoc } from '@/types/firestore';
import { Timestamp } from 'firebase-admin/firestore';

vi.mock('@/lib/firebase/collections', () => ({
  pendingActionsRef: vi.fn(),
}));

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
    handleConfirmReminder: vi.fn(),
  };
});

vi.mock('@/lib/tools/notes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tools/notes')>();
  return {
    ...actual,
    handleSaveNote: vi.fn(),
    handleConfirmNote: vi.fn(),
    handleCancelAction: vi.fn(),
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
    vi.mocked(collections.pendingActionsRef).mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
      }),
    } as unknown as ReturnType<typeof collections.pendingActionsRef>);
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

  it('routes save_note intent to handleSaveNote', async () => {
    vi.mocked(notesTool.handleSaveNote).mockResolvedValue({
      success: true,
      flexMessage: { type: 'flex' } as unknown as Record<string, unknown>,
    });

    const result = await executeTool({
      intent: { intent: 'save_note', confidence: 0.95, isAmbiguous: false },
      userText: 'ช่วยจดว่าต้องไปจ่ายค่าน้ำ',
      geminiResponse: 'รับทราบค่ะ',
      user: mockUser,
    });

    expect(notesTool.handleSaveNote).toHaveBeenCalledWith(
      'ช่วยจดว่าต้องไปจ่ายค่าน้ำ',
      'รับทราบค่ะ',
      mockUser,
      expect.objectContaining({}),
    );
    expect(result.success).toBe(true);
    expect(result.flexMessage).toBeDefined();
  });

  it('routes confirm_action intent to handleConfirmNote', async () => {
    vi.mocked(notesTool.handleConfirmNote).mockResolvedValue({
      success: true,
      message: 'บันทึกโน้ตเรียบร้อยแล้วค่ะ',
    });

    const result = await executeTool({
      intent: { intent: 'confirm_action', confidence: 0.97, isAmbiguous: false },
      userText: 'บันทึกเลย',
      geminiResponse: '',
      user: mockUser,
    });

    expect(notesTool.handleConfirmNote).toHaveBeenCalledWith(mockUser, expect.objectContaining({}));
    expect(result.success).toBe(true);
    expect(result.message).toBe('บันทึกโน้ตเรียบร้อยแล้วค่ะ');
  });

  it('routes confirm_action intent to handleConfirmReminder when pending action is confirm_reminder', async () => {
    vi.mocked(collections.pendingActionsRef).mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ type: 'confirm_reminder' }),
        }),
      }),
    } as unknown as ReturnType<typeof collections.pendingActionsRef>);

    vi.mocked(reminderTool.handleConfirmReminder).mockResolvedValue({
      success: true,
      message: 'ตั้งเตือนเรียบร้อยแล้วค่ะ',
    });

    const result = await executeTool({
      intent: { intent: 'confirm_action', confidence: 0.97, isAmbiguous: false },
      userText: 'ยืนยันเตือน',
      geminiResponse: '',
      user: mockUser,
    });

    expect(reminderTool.handleConfirmReminder).toHaveBeenCalledWith(
      mockUser,
      expect.objectContaining({}),
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe('ตั้งเตือนเรียบร้อยแล้วค่ะ');
  });

  it('routes cancel_action intent to handleCancelAction', async () => {
    vi.mocked(notesTool.handleCancelAction).mockResolvedValue({
      success: true,
      message: 'ยกเลิกการบันทึกเรียบร้อยแล้วค่ะ',
    });

    const result = await executeTool({
      intent: { intent: 'cancel_action', confidence: 0.96, isAmbiguous: false },
      userText: 'ยกเลิก',
      geminiResponse: '',
      user: mockUser,
    });

    expect(notesTool.handleCancelAction).toHaveBeenCalledWith(
      mockUser,
      expect.objectContaining({}),
    );
    expect(result.success).toBe(true);
    expect(result.message).toBe('ยกเลิกการบันทึกเรียบร้อยแล้วค่ะ');
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
    expect(notesTool.handleSaveNote).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.message).toBe('สวัสดีค่ะคุณยาย วันนี้อากาศดีนะคะ');
  });
});
