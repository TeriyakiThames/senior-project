import { resolvePersonaParticles } from '@/lib/ai/persona';

export interface SystemPromptInput {
  now?: Date;
  profileFacts?: string[];
  dailySummary?: { date: string; summary: string } | null;
}

const BANGKOK_DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  timeZone: 'Asia/Bangkok',
  calendar: 'gregory',
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

/**
 * Formats an instant as Thai wording in Asia/Bangkok using the Gregorian year.
 */
export function formatBangkokDateTime(now: Date): string {
  return new Intl.DateTimeFormat('th-TH', BANGKOK_DATE_TIME_FORMAT).format(now);
}

function formatProfileFacts(facts: string[]): string {
  if (facts.length === 0) {
    return 'ยังไม่มีข้อมูลที่เรียนรู้เกี่ยวกับผู้ใช้';
  }

  return facts.map((fact) => `- ${fact}`).join('\n');
}

function formatDailySummary(dailySummary: SystemPromptInput['dailySummary']): string {
  if (!dailySummary?.date || !dailySummary.summary) {
    return '';
  }

  return `## สรุปวันนี้ (${dailySummary.date})
${dailySummary.summary}`;
}

/**
 * Assembles the elderly Thai grandchild system prompt for conversational generation.
 */
export function buildSystemPrompt(input: SystemPromptInput = {}): string {
  const now = input.now ?? new Date();
  const profileFacts = input.profileFacts ?? [];
  const particles = resolvePersonaParticles({ profile: { facts: profileFacts } });
  const bangkokNow = formatBangkokDateTime(now);
  const titleLine = particles.title
    ? `เรียกผู้ใช้ว่า "${particles.title}" เมื่อเหมาะสม`
    : 'ไม่ต้องใช้คำเรียกญาติพิเศษจนกว่าจะมีในข้อมูลผู้ใช้';
  const dailySummaryBlock = formatDailySummary(input.dailySummary);

  const sections = [
    `คุณคือหลานที่ใจดี อดทน และสุภาพ กำลังช่วยผู้สูงอายุใช้งานผู้ช่วยส่วนตัวในแอป LINE
พูดด้วยน้ำเสียงอบอุ่น เป็นธรรมชาติ เคารพ ไม่พูดจาเหมือนเด็กเล็ก และไม่ดูถูกผู้ใช้
ใช้ประโยคสั้นถึงปานกลาง อ่านง่ายบนหน้าจอมือถือ`,
    `## ลงท้ายสุภาพ
ใช้ "${particles.affirmative}" ท้ายประโยคบอกเล่า และ "${particles.question}" ท้ายประโยคคำถาม
${titleLine}`,
    `## ห้ามศัพท์เทคนิคในข้อความถึงผู้ใช้
ห้ามเอ่ยคำว่า API, JSON, token, database หรือศัพท์คอมพิวเตอร์อื่นในคำตอบที่ผู้ใช้เห็น`,
    `## เวลาปัจจุบัน (Asia/Bangkok)
${bangkokNow}`,
    `## ข้อมูลที่เรียนรู้เกี่ยวกับผู้ใช้
${formatProfileFacts(profileFacts)}`,
  ];

  if (dailySummaryBlock) {
    sections.push(dailySummaryBlock);
  }

  sections.push(`## การสนทนาที่เกี่ยวกับเครื่องมือ
ถ้าคำขอคลุมเครือหรือขาดรายละเอียดที่จำเป็น ให้ถามคำถามสั้น ๆ เพื่อให้ชัดเจนก่อนลงมือ
ก่อนบันทึกโน้ต ให้สรุปเนื้อหาโน้ตให้ผู้ใช้ฟัง แล้วรอการยืนยัน`);

  return sections.join('\n\n');
}
