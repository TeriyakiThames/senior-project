import { describe, it, expect } from 'vitest';
import { isPureNoteCommand, isClarificationResponse } from '@/lib/utils/note-validation';

describe('Note Validation Utilities', () => {
  describe('isPureNoteCommand', () => {
    it('returns true for empty or whitespace-only strings', () => {
      expect(isPureNoteCommand('')).toBe(true);
      expect(isPureNoteCommand('   ')).toBe(true);
      expect(isPureNoteCommand('\t\n')).toBe(true);
    });

    it('returns true for pure Thai command phrases asking to take a note without content', () => {
      const pureCommands = [
        'จด',
        'ช่วยจด',
        'ช่วยจดหน่อย',
        'ช่วยจดให้หน่อย',
        'ช่วยจดที',
        'ช่วยจดให้ที',
        'จดให้หน่อย',
        'จดหน่อย',
        'จดโน้ต',
        'ช่วยจดโน้ต',
        'ช่วยจดโน้ตหน่อย',
        'ช่วยจดโน้ตให้หน่อยค่ะ',
        'ช่วยจดโน้ตให้หน่อยครับ',
        'จดบันทึกให้หน่อย',
        'ช่วยจดบันทึกหน่อย',
        'บันทึกโน้ต',
        'บันทึกให้หน่อย',
        'ช่วยบันทึกหน่อยค่ะ',
        'อยากจดโน้ต',
        'อยากจดบันทึก',
        'มีเรื่องจะให้จด',
        'มีเรื่องให้จด',
        'จดไว้หน่อย',
        'ช่วยจดไว้หน่อย',
        'สรุปโน้ตให้หน่อย',
        'ช่วยสรุปบันทึกให้หน่อยค่ะ',
      ];

      for (const cmd of pureCommands) {
        expect(isPureNoteCommand(cmd), `Expected "${cmd}" to be identified as a pure command`).toBe(
          true,
        );
      }
    });

    it('returns true for pure English command phrases asking to take a note without content', () => {
      const pureCommands = [
        'note',
        'take a note',
        'take note',
        'write a note',
        'save note',
        'note this',
        'write this down',
        'save this',
        'please take a note',
      ];

      for (const cmd of pureCommands) {
        expect(isPureNoteCommand(cmd), `Expected "${cmd}" to be identified as a pure command`).toBe(
          true,
        );
      }
    });

    it('returns false when actual substantive note content is present', () => {
      const notesWithContent = [
        'ช่วยจดให้หน่อยว่าต้องไปซื้อยาแก้ปวดที่คลินิกตอนบ่าย',
        'จดว่าพรุ่งนี้หมอนัด 9 โมง',
        'ความดันเช้านี้ 120 80 จดไว้หน่อย',
        'ซื้อนม 2 กล่อง',
        'ไปหาหมอฟัน',
        'ซื้อผลไม้',
        'นัดเพื่อนกินข้าวเที่ยง',
        'ค่าน้ำ 350 บาท',
        'จดโน้ต ซื้อไข่ไก่',
        'บันทึก: ประชุมพรุ่งนี้ 10 โมง',
      ];

      for (const note of notesWithContent) {
        expect(
          isPureNoteCommand(note),
          `Expected "${note}" NOT to be identified as a pure command`,
        ).toBe(false);
      }
    });
  });

  describe('isClarificationResponse', () => {
    it('returns true for empty or whitespace-only strings', () => {
      expect(isClarificationResponse('')).toBe(true);
      expect(isClarificationResponse('   ')).toBe(true);
    });

    it('returns true for UNCLEAR marker', () => {
      expect(isClarificationResponse('UNCLEAR')).toBe(true);
      expect(isClarificationResponse('unclear')).toBe(true);
    });

    it('returns true for AI clarification/prompting responses asking the user to send content', () => {
      const clarificationResponses = [
        'กรุณาส่งเนื้อหาโน้ตที่ต้องการให้สรุปมาได้เลยครับ ผมจะจัดการสรุปให้กระชับไม่เกิน 2-3 ประโยค โดยคงใจความสำคัญ วันที่ เวลา และสิ่งที่ต้องทำไว้อย่างครบถ้วนครับ',
        'กรุณาส่งเนื้อหาที่ต้องการให้จดมาได้เลยค่ะ',
        'ต้องการให้สรุปเรื่องอะไรคะ',
        'ไม่มีเนื้อหาให้สรุปค่ะ',
        'บอกเรื่องที่ต้องการให้จดอีกครั้งนะคะ',
        'อยากให้จดเรื่องอะไรคะ',
        'ขอเนื้อหาที่ต้องการให้จดด้วยค่ะ',
      ];

      for (const resp of clarificationResponses) {
        expect(
          isClarificationResponse(resp),
          `Expected "${resp}" to be identified as clarification`,
        ).toBe(true);
      }
    });

    it('returns false for actual valid note summaries', () => {
      const validSummaries = [
        'ซื้อยาแก้ปวดที่คลินิกตอนบ่าย',
        'นัดหมอวันพรุ่งนี้เวลา 09:00 น.',
        'วัดความดันเช้านี้ได้ 120/80',
        'ซื้อนม 2 กล่องและไข่ไก่',
        'ไปหาหมอฟัน',
      ];

      for (const summary of validSummaries) {
        expect(
          isClarificationResponse(summary),
          `Expected "${summary}" NOT to be identified as clarification`,
        ).toBe(false);
      }
    });
  });
});
