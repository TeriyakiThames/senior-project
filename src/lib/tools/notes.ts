import { Timestamp } from 'firebase-admin/firestore';
import { notesRef, pendingActionsRef } from '@/lib/firebase/collections';
import { summarizeNote } from '@/lib/ai/gemini';
import {
  extractNoteParams,
  type NoteParams,
  type ExtractNoteParamsOptions,
} from '@/lib/ai/parameter-extractor';
import { isPureNoteCommand, isClarificationResponse } from '@/lib/utils/note-validation';
import { buildNoteConfirmation } from '@/lib/line/flex-messages';
import type { NoteDoc, PendingActionDoc, UserDoc } from '@/types/firestore';
import type { ToolResult } from './index';

export const NOTE_EMPTY_FALLBACK =
  'หนูยังไม่ได้รับเนื้อหาข้อความเลยค่ะ คุณตาคุณยายช่วยบอกใหม่อีกครั้งได้ไหมคะ เช่น "ช่วยจดว่าต้องไปหาหมอวันจันทร์" ค่ะ';

export const NOTE_CLARIFICATION_MESSAGE =
  'หนูยังไม่ค่อยแน่ใจเนื้อหาที่ต้องการให้จดเลยค่ะ คุณตาคุณยายช่วยบอกเรื่องที่ต้องการให้จดอีกครั้งได้ไหมคะ เช่น "ช่วยจดว่าต้องไปหาหมอวันจันทร์" ค่ะ';

export const NOTE_EXPIRED_OR_NOT_FOUND_MESSAGE =
  'ไม่พบรายการบันทึกที่รอการยืนยัน หรือรายการหมดอายุแล้วค่ะ (รายการมีอายุ 5 นาทีนะคะ) รบกวนบอกหนูใหม่อีกครั้งได้เลยค่ะ';

export const NOTE_CANCELLED_MESSAGE = 'ยกเลิกการบันทึกเรียบร้อยแล้วค่ะ';

export const NOTE_CONFIRMED_SUCCESS_MESSAGE = 'บันทึกโน้ตเรียบร้อยแล้วค่ะ คุณตาคุณยาย';

export interface HandleSaveNoteOptions {
  source?: 'voice' | 'text';
  now?: Date;
  summary?: string;
  isAmbiguous?: boolean;
  params?: NoteParams | null;
  extractOptions?: ExtractNoteParamsOptions;
}

export interface HandleConfirmNoteOptions {
  now?: Date;
}

export interface HandleCancelActionOptions {
  now?: Date;
}

/**
 * Handles note creation draft:
 * - If user text is unclear, ambiguous, or lacks substantive note content, returns a normal clarification message without a Flex message.
 * - If clear note content is present, generates AI summary, saves 5-minute expiring draft in users/{userId}/pendingActions/current, and returns an interactive Flex confirmation card.
 */
export async function handleSaveNote(
  userText: string,
  _geminiResponse: string,
  user: UserDoc,
  options?: HandleSaveNoteOptions,
): Promise<ToolResult> {
  const trimmedText = userText?.trim() ?? '';
  if (!trimmedText) {
    return {
      success: false,
      message: NOTE_EMPTY_FALLBACK,
    };
  }

  // If the request was classified as ambiguous or is purely an imperative command without note content
  if (options?.isAmbiguous || isPureNoteCommand(trimmedText)) {
    return {
      success: false,
      message: NOTE_CLARIFICATION_MESSAGE,
    };
  }

  const now = options?.now ?? new Date();
  const source = options?.source ?? 'voice';

  // Substantive content determination
  let noteContent = trimmedText;

  if (options?.params !== undefined) {
    if (!options.params || !options.params.content || !options.params.content.trim()) {
      return {
        success: false,
        message: NOTE_CLARIFICATION_MESSAGE,
      };
    }
    noteContent = options.params.content.trim();
  } else if (!options?.summary) {
    try {
      const extracted = await extractNoteParams(trimmedText, options?.extractOptions);
      if (!extracted || !extracted.content || !extracted.content.trim()) {
        return {
          success: false,
          message: NOTE_CLARIFICATION_MESSAGE,
        };
      }
      noteContent = extracted.content.trim();
    } catch (err) {
      console.warn('[NotesTool] Parameter extraction error, falling back to raw content:', err);
    }
  }

  let summary = options?.summary;
  if (!summary) {
    try {
      summary = await summarizeNote(noteContent, { language: user.language });
    } catch (error) {
      console.error('[NotesTool] Error summarizing note with Gemini:', error);
      summary = noteContent;
    }
  }

  // If summary is empty or contains clarification responses, prompt is unclear
  if (!summary || !summary.trim() || isClarificationResponse(summary)) {
    return {
      success: false,
      message: NOTE_CLARIFICATION_MESSAGE,
    };
  }

  const cleanSummary = summary.trim();

  const expiresAtDate = new Date(now.getTime() + 5 * 60 * 1000);
  const expiresAt = Timestamp.fromDate(expiresAtDate);

  const pendingData: PendingActionDoc = {
    type: 'confirm_note',
    data: {
      content: noteContent,
      summary: cleanSummary,
      source,
    },
    expiresAt,
  };

  try {
    const pendingRef = pendingActionsRef(user.lineUserId).doc('current');
    await pendingRef.set(pendingData);

    const flexMessage = buildNoteConfirmation(cleanSummary);

    return {
      success: true,
      flexMessage,
      data: {
        summary: cleanSummary,
        content: noteContent,
        source,
        expiresAt: expiresAtDate.toISOString(),
      },
    };
  } catch (error) {
    console.error('[NotesTool] Error creating pending note draft:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการเตรียมบันทึกโน้ต กรุณาลองใหม่อีกครั้งค่ะ',
    };
  }
}

/**
 * Handles confirmation of a pending note: validates expiration, moves draft
 * to users/{userId}/notes, and deletes the pending action document.
 */
export async function handleConfirmNote(
  user: UserDoc,
  options?: HandleConfirmNoteOptions,
): Promise<ToolResult> {
  const now = options?.now ?? new Date();
  const pendingRef = pendingActionsRef(user.lineUserId).doc('current');

  try {
    const snap = await pendingRef.get();
    if (!snap.exists) {
      return {
        success: false,
        message: NOTE_EXPIRED_OR_NOT_FOUND_MESSAGE,
      };
    }

    const data = snap.data() as PendingActionDoc;
    if (data.type !== 'confirm_note' || !data.data) {
      return {
        success: false,
        message: NOTE_EXPIRED_OR_NOT_FOUND_MESSAGE,
      };
    }

    // Check expiration (5 minutes expiry)
    if (data.expiresAt && data.expiresAt.toMillis() <= now.getTime()) {
      await pendingRef.delete();
      return {
        success: false,
        message: NOTE_EXPIRED_OR_NOT_FOUND_MESSAGE,
      };
    }

    const draftData = data.data as {
      content?: string;
      summary?: string;
      source?: 'voice' | 'text';
    };

    const nowTs = Timestamp.fromDate(now);
    const noteDoc: NoteDoc = {
      content: draftData.content ?? '',
      summary: draftData.summary ?? draftData.content ?? '',
      source: draftData.source === 'text' ? 'text' : 'voice',
      createdAt: nowTs,
      updatedAt: nowTs,
    };

    const docRef = await notesRef(user.lineUserId).add(noteDoc);
    await pendingRef.delete();

    return {
      success: true,
      message: NOTE_CONFIRMED_SUCCESS_MESSAGE,
      data: {
        noteId: docRef.id,
        summary: noteDoc.summary,
      },
    };
  } catch (error) {
    console.error('[NotesTool] Error confirming note:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการบันทึกโน้ต กรุณาลองใหม่อีกครั้งค่ะ',
    };
  }
}

/**
 * Handles cancellation of a pending action: deletes the pending draft if present
 * and returns a polite confirmation message in Thai.
 */
export async function handleCancelAction(
  user: UserDoc,
  _options?: HandleCancelActionOptions,
): Promise<ToolResult> {
  const pendingRef = pendingActionsRef(user.lineUserId).doc('current');

  try {
    const snap = await pendingRef.get();
    if (snap.exists) {
      await pendingRef.delete();
    }

    return {
      success: true,
      message: NOTE_CANCELLED_MESSAGE,
    };
  } catch (error) {
    console.error('[NotesTool] Error cancelling pending action:', error);
    return {
      success: false,
      message: 'เกิดข้อผิดพลาดในการยกเลิก กรุณาลองใหม่อีกครั้งค่ะ',
    };
  }
}
