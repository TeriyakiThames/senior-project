import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleSaveNote,
  handleConfirmNote,
  handleCancelAction,
  NOTE_EMPTY_FALLBACK,
  NOTE_CLARIFICATION_MESSAGE,
  NOTE_EXPIRED_OR_NOT_FOUND_MESSAGE,
  NOTE_CANCELLED_MESSAGE,
  NOTE_CONFIRMED_SUCCESS_MESSAGE,
} from '@/lib/tools/notes';
import * as collections from '@/lib/firebase/collections';
import * as gemini from '@/lib/ai/gemini';
import * as extractor from '@/lib/ai/parameter-extractor';
import type { UserDoc } from '@/types/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { createMockUserDoc } from '@/__tests__/mocks';

vi.mock('@/lib/firebase/collections', () => ({
  notesRef: vi.fn(),
  pendingActionsRef: vi.fn(),
}));

vi.mock('@/lib/ai/gemini', () => ({
  summarizeNote: vi.fn(),
}));

vi.mock('@/lib/ai/parameter-extractor', () => ({
  extractNoteParams: vi.fn(),
}));

describe('Notes Tool Handlers (SCHED-05)', () => {
  const mockUser: UserDoc = createMockUserDoc({
    lineUserId: 'U_TEST_USER_NOTE_001',
    displayName: 'คุณยายใจดี',
    firebaseUid: 'firebase-uid-note-001',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extractor.extractNoteParams).mockImplementation(async (text: string) => ({
      content: text,
    }));
  });

  describe('handleSaveNote', () => {
    it('summarizes note, saves 5-minute draft to pendingActions/current, and returns flexMessage', async () => {
      const now = new Date('2026-10-17T10:00:00.000Z');
      const mockSet = vi.fn().mockResolvedValue(undefined);
      const mockDoc = vi.fn().mockReturnValue({ set: mockSet });

      vi.mocked(collections.pendingActionsRef).mockReturnValue({
        doc: mockDoc,
      } as unknown as ReturnType<typeof collections.pendingActionsRef>);

      vi.mocked(extractor.extractNoteParams).mockResolvedValue({
        content: 'ต้องไปซื้อยาแก้ปวดที่คลินิกตอนบ่าย',
      });
      vi.mocked(gemini.summarizeNote).mockResolvedValue('ซื้อยาแก้ปวดที่คลินิก');

      const result = await handleSaveNote(
        'ช่วยจดให้หน่อยว่าต้องไปซื้อยาแก้ปวดที่คลินิกตอนบ่าย',
        '',
        mockUser,
        { now, source: 'voice' },
      );

      expect(result.success).toBe(true);
      expect(result.flexMessage).toBeDefined();
      expect(result.data?.summary).toBe('ซื้อยาแก้ปวดที่คลินิก');
      expect(result.data?.source).toBe('voice');

      // Verify pendingAction saved to doc('current')
      expect(mockDoc).toHaveBeenCalledWith('current');
      expect(mockSet).toHaveBeenCalledTimes(1);

      const savedDraft = mockSet.mock.calls[0][0];
      expect(savedDraft.type).toBe('confirm_note');
      expect(savedDraft.data.content).toBe('ต้องไปซื้อยาแก้ปวดที่คลินิกตอนบ่าย');
      expect(savedDraft.data.summary).toBe('ซื้อยาแก้ปวดที่คลินิก');
      expect(savedDraft.data.source).toBe('voice');

      // Verify 5-minute expiry (10:00 -> 10:05)
      const expectedExpiry = new Date('2026-10-17T10:05:00.000Z');
      expect(savedDraft.expiresAt.toDate().toISOString()).toBe(expectedExpiry.toISOString());
    });

    it('falls back to raw text if summarizeNote throws an error', async () => {
      const now = new Date('2026-10-17T10:00:00.000Z');
      const mockSet = vi.fn().mockResolvedValue(undefined);
      const mockDoc = vi.fn().mockReturnValue({ set: mockSet });

      vi.mocked(collections.pendingActionsRef).mockReturnValue({
        doc: mockDoc,
      } as unknown as ReturnType<typeof collections.pendingActionsRef>);

      vi.mocked(extractor.extractNoteParams).mockResolvedValue({ content: 'ไปหาหมอฟัน' });
      vi.mocked(gemini.summarizeNote).mockRejectedValue(new Error('AI API failure'));

      const result = await handleSaveNote('ไปหาหมอฟัน', '', mockUser, { now });

      expect(result.success).toBe(true);
      expect(result.data?.summary).toBe('ไปหาหมอฟัน');
      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'confirm_note',
          data: expect.objectContaining({ summary: 'ไปหาหมอฟัน' }),
        }),
      );
    });

    it('returns empty text fallback when input is empty or whitespace only', async () => {
      const result = await handleSaveNote('   ', '', mockUser);

      expect(result.success).toBe(false);
      expect(result.message).toBe(NOTE_EMPTY_FALLBACK);
      expect(result.flexMessage).toBeUndefined();
      expect(collections.pendingActionsRef).not.toHaveBeenCalled();
    });

    it('returns clarification message and NO flexMessage when input is a pure command without content', async () => {
      const pureCommands = [
        'ช่วยจดโน้ตหน่อย',
        'จดบันทึกให้หน่อย',
        'ช่วยจดหน่อย',
        'ช่วยจดที',
        'จดโน้ต',
        'บันทึกให้หน่อยค่ะ',
      ];

      for (const cmd of pureCommands) {
        const result = await handleSaveNote(cmd, '', mockUser);

        expect(result.success).toBe(false);
        expect(result.message).toBe(NOTE_CLARIFICATION_MESSAGE);
        expect(result.flexMessage).toBeUndefined();
        expect(collections.pendingActionsRef).not.toHaveBeenCalled();
      }
    });

    it('returns clarification message and NO flexMessage when request is ambiguous (isAmbiguous: true)', async () => {
      const result = await handleSaveNote('มีเรื่องจะเล่าให้ฟัง', '', mockUser, {
        isAmbiguous: true,
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe(NOTE_CLARIFICATION_MESSAGE);
      expect(result.flexMessage).toBeUndefined();
      expect(collections.pendingActionsRef).not.toHaveBeenCalled();
    });

    it('returns clarification message and NO flexMessage when parameter extraction returns null', async () => {
      vi.mocked(extractor.extractNoteParams).mockResolvedValue(null);

      const result = await handleSaveNote('เมื่อวานตอนเย็น', '', mockUser);

      expect(result.success).toBe(false);
      expect(result.message).toBe(NOTE_CLARIFICATION_MESSAGE);
      expect(result.flexMessage).toBeUndefined();
      expect(collections.pendingActionsRef).not.toHaveBeenCalled();
    });

    it('returns clarification message and NO flexMessage when Gemini summary is a clarification prompt', async () => {
      vi.mocked(extractor.extractNoteParams).mockResolvedValue({
        content: 'สรุปโน้ตให้หน่อย',
      });
      // The exact problematic output from the user screenshot
      vi.mocked(gemini.summarizeNote).mockResolvedValue(
        'กรุณาส่งเนื้อหาโน้ตที่ต้องการให้สรุปมาได้เลยครับ ผมจะจัดการสรุปให้กระชับไม่เกิน 2-3 ประโยค โดยคงใจความสำคัญ วันที่ เวลา และสิ่งที่ต้องทำไว้อย่างครบถ้วนครับ',
      );

      const result = await handleSaveNote('สรุปโน้ตให้หน่อย', '', mockUser);

      expect(result.success).toBe(false);
      expect(result.message).toBe(NOTE_CLARIFICATION_MESSAGE);
      expect(result.flexMessage).toBeUndefined();
      expect(collections.pendingActionsRef).not.toHaveBeenCalled();
    });

    it('returns failure result if Firestore pendingAction set throws', async () => {
      const mockDoc = vi.fn().mockReturnValue({
        set: vi.fn().mockRejectedValue(new Error('Firestore write error')),
      });

      vi.mocked(collections.pendingActionsRef).mockReturnValue({
        doc: mockDoc,
      } as unknown as ReturnType<typeof collections.pendingActionsRef>);

      vi.mocked(extractor.extractNoteParams).mockResolvedValue({ content: 'ซื้อผลไม้' });
      vi.mocked(gemini.summarizeNote).mockResolvedValue('ซื้อผลไม้');

      const result = await handleSaveNote('ซื้อผลไม้', '', mockUser);

      expect(result.success).toBe(false);
      expect(result.message).toContain('เกิดข้อผิดพลาดในการเตรียมบันทึกโน้ต');
    });
  });

  describe('handleConfirmNote', () => {
    it('moves draft to notes subcollection, cleans up pending action, and returns polite confirmation', async () => {
      const now = new Date('2026-10-17T10:02:00.000Z'); // Within 5 minutes
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          type: 'confirm_note',
          data: {
            content: 'จดว่าต้องจ่ายค่าน้ำ',
            summary: 'จ่ายค่าน้ำ',
            source: 'voice',
          },
          expiresAt: Timestamp.fromDate(new Date('2026-10-17T10:05:00.000Z')),
        }),
      });

      const mockDoc = vi.fn().mockReturnValue({
        get: mockGet,
        delete: mockDelete,
      });

      vi.mocked(collections.pendingActionsRef).mockReturnValue({
        doc: mockDoc,
      } as unknown as ReturnType<typeof collections.pendingActionsRef>);

      const mockAdd = vi.fn().mockResolvedValue({ id: 'note-doc-789' });
      vi.mocked(collections.notesRef).mockReturnValue({
        add: mockAdd,
      } as unknown as ReturnType<typeof collections.notesRef>);

      const result = await handleConfirmNote(mockUser, { now });

      expect(result.success).toBe(true);
      expect(result.message).toBe(NOTE_CONFIRMED_SUCCESS_MESSAGE);
      expect(result.data?.noteId).toBe('note-doc-789');

      // Verify note added to notesRef
      expect(mockAdd).toHaveBeenCalledTimes(1);
      const addedNote = mockAdd.mock.calls[0][0];
      expect(addedNote.content).toBe('จดว่าต้องจ่ายค่าน้ำ');
      expect(addedNote.summary).toBe('จ่ายค่าน้ำ');
      expect(addedNote.source).toBe('voice');
      expect(addedNote.createdAt).toBeInstanceOf(Timestamp);
      expect(addedNote.updatedAt).toBeInstanceOf(Timestamp);

      // Verify pending action deleted
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it('returns polite message when pending action is missing or already confirmed', async () => {
      const mockDoc = vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      });

      vi.mocked(collections.pendingActionsRef).mockReturnValue({
        doc: mockDoc,
      } as unknown as ReturnType<typeof collections.pendingActionsRef>);

      const result = await handleConfirmNote(mockUser);

      expect(result.success).toBe(false);
      expect(result.message).toBe(NOTE_EXPIRED_OR_NOT_FOUND_MESSAGE);
      expect(collections.notesRef).not.toHaveBeenCalled();
    });

    it('cleans up and returns polite message when pending action has expired (>5 minutes)', async () => {
      const now = new Date('2026-10-17T10:06:00.000Z'); // Past 10:05:00 expiry
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockGet = vi.fn().mockResolvedValue({
        exists: true,
        data: () => ({
          type: 'confirm_note',
          data: {
            content: 'โทรหาลูก',
            summary: 'โทรหาลูก',
            source: 'voice',
          },
          expiresAt: Timestamp.fromDate(new Date('2026-10-17T10:05:00.000Z')),
        }),
      });

      const mockDoc = vi.fn().mockReturnValue({
        get: mockGet,
        delete: mockDelete,
      });

      vi.mocked(collections.pendingActionsRef).mockReturnValue({
        doc: mockDoc,
      } as unknown as ReturnType<typeof collections.pendingActionsRef>);

      const result = await handleConfirmNote(mockUser, { now });

      expect(result.success).toBe(false);
      expect(result.message).toBe(NOTE_EXPIRED_OR_NOT_FOUND_MESSAGE);
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(collections.notesRef).not.toHaveBeenCalled();
    });

    it('returns polite message if pending action type is not confirm_note', async () => {
      const mockDoc = vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            type: 'other_action',
            data: {},
            expiresAt: Timestamp.now(),
          }),
        }),
      });

      vi.mocked(collections.pendingActionsRef).mockReturnValue({
        doc: mockDoc,
      } as unknown as ReturnType<typeof collections.pendingActionsRef>);

      const result = await handleConfirmNote(mockUser);

      expect(result.success).toBe(false);
      expect(result.message).toBe(NOTE_EXPIRED_OR_NOT_FOUND_MESSAGE);
      expect(collections.notesRef).not.toHaveBeenCalled();
    });
  });

  describe('handleCancelAction', () => {
    it('deletes pending action when it exists and returns polite confirmation', async () => {
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockDoc = vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: true }),
        delete: mockDelete,
      });

      vi.mocked(collections.pendingActionsRef).mockReturnValue({
        doc: mockDoc,
      } as unknown as ReturnType<typeof collections.pendingActionsRef>);

      const result = await handleCancelAction(mockUser);

      expect(result.success).toBe(true);
      expect(result.message).toBe(NOTE_CANCELLED_MESSAGE);
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it('returns polite confirmation gracefully when no pending action exists', async () => {
      const mockDoc = vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
        delete: vi.fn(),
      });

      vi.mocked(collections.pendingActionsRef).mockReturnValue({
        doc: mockDoc,
      } as unknown as ReturnType<typeof collections.pendingActionsRef>);

      const result = await handleCancelAction(mockUser);

      expect(result.success).toBe(true);
      expect(result.message).toBe(NOTE_CANCELLED_MESSAGE);
    });
  });
});
