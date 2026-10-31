/**
 * Note validation utilities for detecting pure command requests lacking content
 * and identifying conversational clarification responses from AI models.
 */

/**
 * Checks whether the user's input is purely a command to take a note
 * without any substantive content (e.g. "ช่วยจดโน้ตหน่อย", "จดบันทึกให้หน่อย").
 */
export function isPureNoteCommand(text: string): boolean {
  if (!text || !text.trim()) {
    return true;
  }

  const clean = text
    .trim()
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'“”]/g, '')
    .trim();

  if (!clean) {
    return true;
  }

  // Common pure Thai imperative phrases with no content
  const pureThaiPatterns = [
    /^(?:ช่วย|อยาก|ขอ|รบกวน|วาน)?(?:จด|บันทึก)(?:โน้ต|ข้อความ|บันทึก)?(?:หน่อย|ให้หน่อย|ไว้หน่อย|ไว้ที|ที|ให้ที|ให้ด้วย|ด้วย|นะ|นะคะ|นะครับ|ครับ|ค่ะ|เลย|สิ|หน่อยนะ)*$/,
    /^(?:โน้ต|บันทึก)(?:หน่อย|ให้หน่อย|ไว้หน่อย|ที|ให้ที|นะ|นะคะ|นะครับ|ครับ|ค่ะ)*$/,
    /^(?:มีเรื่อง(?:จะ)?ให้(?:จด|บันทึก)|จะจดโน้ต|จะบันทึก)(?:หน่อย|ให้หน่อย|นะ|นะคะ|นะครับ|ครับ|ค่ะ)*$/,
    /^(?:ช่วย)?(?:สรุป)(?:โน้ต|บันทึก)?(?:ให้หน่อย|หน่อย|ที|ให้ที|นะ|นะคะ|นะครับ|ครับ|ค่ะ)*$/,
  ];

  if (pureThaiPatterns.some((pattern) => pattern.test(clean))) {
    return true;
  }

  // Common English pure phrases
  const pureEnglishPatterns = [
    /^(?:please\s+)?(?:take|write|make|save|record|create)?\s*(?:a\s+)?(?:note|memo)(?:\s+down|\s+please)?$/,
    /^(?:note\s+this|write\s+this\s+down|save\s+this)$/,
  ];

  if (pureEnglishPatterns.some((pattern) => pattern.test(clean))) {
    return true;
  }

  return false;
}

/**
 * Checks whether an AI-generated summary is actually a clarification request
 * asking the user for note details rather than an actual note summary.
 */
export function isClarificationResponse(text: string): boolean {
  if (!text || !text.trim()) {
    return true;
  }

  const clean = text.trim();
  if (clean === 'UNCLEAR') {
    return true;
  }

  const clarificationPatterns = [
    /กรุณาส่งเนื้อหา/,
    /ต้องการให้สรุป/,
    /ไม่มีเนื้อหา/,
    /ส่งเนื้อหาโน้ต/,
    /ระบุเนื้อหา/,
    /บอกเรื่องที่ต้องการให้จด/,
    /อยากให้จดเรื่องอะไร/,
    /ขอเนื้อหา/,
    /\bunclear\b/i,
  ];

  return clarificationPatterns.some((pattern) => pattern.test(clean));
}
