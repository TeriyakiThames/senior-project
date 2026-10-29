import type { IntentType } from '@/types/jev';
import { resolvePersonaParticles, type PersonaUserInput } from '@/lib/ai/persona';
import type { messagingApi } from '@line/bot-sdk';

/**
 * Strict, immutable whitelist of bot feature identifiers.
 * Safeguards against any hallucinated capabilities.
 */
export type BotFeatureId =
  'set_reminder' | 'set_alarm' | 'save_note' | 'list_items' | 'delete_item' | 'voice_input';

export interface BotFeature {
  id: BotFeatureId;
  name: string;
  description: string;
  example: string;
}

/**
 * The 6 verified bot capabilities that the bot is physically capable of performing.
 */
export const VERIFIED_BOT_FEATURES: Record<BotFeatureId, BotFeature> = {
  set_reminder: {
    id: 'set_reminder',
    name: 'ตั้งเตือนความจำ',
    description: 'เตือนกินยา เตือนไปหาหมอ หรือเตือนทำธุระ',
    example: 'เช่น "เตือนกินยาตอนสองทุ่ม"',
  },
  set_alarm: {
    id: 'set_alarm',
    name: 'ตั้งนาฬิกาปลุก',
    description: 'ปลุกตอนเช้าหรือตามเวลาที่ต้องการ',
    example: 'เช่น "ปลุก 6 โมงเช้า"',
  },
  save_note: {
    id: 'save_note',
    name: 'จดบันทึกข้อความ',
    description: 'จดของที่ต้องซื้อ เบอร์โทร หรือเรื่องสำคัญ',
    example: 'เช่น "ช่วยจดว่าซื้อนมจืด 2 กล่อง"',
  },
  list_items: {
    id: 'list_items',
    name: 'ดูรายการทั้งหมด',
    description: 'ตรวจดูรายการเตือน รายการปลุก หรือโน้ตที่จดไว้',
    example: 'เช่น "ดูรายการเตือน"',
  },
  delete_item: {
    id: 'delete_item',
    name: 'ลบรายการ',
    description: 'ลบรายการเตือนหรือนาฬิกาปลุกที่ไม่ต้องการ',
    example: 'เช่น "ลบเตือนกินยา"',
  },
  voice_input: {
    id: 'voice_input',
    name: 'ส่งข้อความเสียง',
    description: 'กดปุ่มไมโครโฟนส่งเสียงพูดคุยแทนการพิมพ์ได้ตลอด',
    example: 'กดปุ่มไมค์ใน LINE แล้วพูดได้เลย',
  },
};

export const ALLOWED_FEATURE_IDS: ReadonlySet<string> = new Set<BotFeatureId>([
  'set_reminder',
  'set_alarm',
  'save_note',
  'list_items',
  'delete_item',
  'voice_input',
]);

/**
 * Validates whether a feature ID is one of the verified, implemented bot capabilities.
 */
export function isAllowedFeature(featureId: string): featureId is BotFeatureId {
  return ALLOWED_FEATURE_IDS.has(featureId);
}

/**
 * Safeguard function: Validates an array of feature IDs, ensuring zero hallucinations.
 */
export function validateFeatureIds(featureIds: string[]): featureIds is BotFeatureId[] {
  return featureIds.every(isAllowedFeature);
}

/**
 * Safeguard filter: Strips out any hallucinated or unsupported feature ideas.
 */
export function sanitizeFeatureList(featureIds: string[]): BotFeatureId[] {
  return featureIds.filter(isAllowedFeature);
}

/**
 * Maps each completed action/intent to complementary features that the user might also want.
 * e.g. After saving a note, offer to set a reminder or set an alarm.
 */
export const COMPLEMENTARY_FEATURE_MAP: Partial<Record<IntentType, BotFeatureId[]>> = {
  save_note: ['set_reminder', 'set_alarm'],
  set_reminder: ['save_note', 'set_alarm'],
  set_alarm: ['set_reminder', 'save_note'],
  list_items: ['delete_item', 'set_reminder'],
  delete_item: ['list_items', 'set_reminder'],
};

/**
 * Checks if the user is asking what the bot can do or asking for help/commands.
 */
export function isCapabilitiesInquiry(text?: string): boolean {
  if (!text) return false;
  const normalized = text.trim().toLowerCase();
  if (
    normalized === 'help' ||
    normalized === 'info' ||
    normalized === 'menu' ||
    normalized === 'เมนู' ||
    normalized === 'ช่วยเหลือ' ||
    normalized === 'วิธีใช้' ||
    normalized === 'ใช้งานยังไง' ||
    normalized === 'สอนใช้' ||
    normalized === 'คำสั่ง'
  ) {
    return true;
  }

  const capabilityPatterns = [
    /ทำอะไรได้/i,
    /ทำไรได้/i,
    /ช่วยอะไรได้/i,
    /ช่วยอะไรฉันได้/i,
    /มีอะไรให้ช่วย/i,
    /มีฟังก์ชันอะไร/i,
    /มีฟีเจอร์อะไร/i,
    /บอททำอะไร/i,
    /ทำอะไรเป็น/i,
    /ความสามารถ/i,
    /วิธีใช้/i,
    /สอนใช้/i,
    /ช่วยเหลือ/i,
    /what can you do/i,
  ];

  return capabilityPatterns.some((pattern) => pattern.test(normalized));
}

/**
 * Formats polite ending particles for Thai persona.
 */
function resolvePoliteEndings(userDoc?: PersonaUserInput | null) {
  const particles = resolvePersonaParticles(userDoc);
  const affirmativeEnding =
    particles.affirmative === 'จ้ะ'
      ? 'นะจ้ะ'
      : particles.affirmative === 'ครับ'
        ? 'นะครับ'
        : 'นะคะ';
  const questionEnding =
    particles.question === 'จ๊ะ' ? 'จ๊ะ' : particles.question === 'ครับ' ? 'ครับ' : 'คะ';
  const alwaysEnding =
    particles.affirmative === 'จ้ะ'
      ? 'เสมอนะจ้ะ'
      : particles.affirmative === 'ครับ'
        ? 'เสมอนะครับ'
        : 'เสมอนะคะ';
  const anytimeEnding =
    particles.affirmative === 'จ้ะ'
      ? 'ได้ตลอดเวลาเลยนะจ้ะ'
      : particles.affirmative === 'ครับ'
        ? 'ได้ตลอดเวลาเลยนะครับ'
        : 'ได้ตลอดเวลาเลยนะคะ';

  return {
    particles,
    affirmativeEnding,
    questionEnding,
    alwaysEnding,
    anytimeEnding,
  };
}

/**
 * Builds the comprehensive list of all verified bot features for capabilities inquiry or help.
 */
export function buildFullCapabilitiesText(userDoc?: PersonaUserInput | null): string {
  const { particles, affirmativeEnding } = resolvePoliteEndings(userDoc);
  const titlePart = particles.title ? `คุณ${particles.title}` : 'คุณตาคุณยาย';

  return [
    `หนูสามารถช่วย${titlePart}ได้ตามนี้เลย${particles.affirmative}:`,
    '• ตั้งเตือนความจำ (เช่น "เตือนกินยาตอนสองทุ่ม")',
    '• ตั้งนาฬิกาปลุก (เช่น "ปลุกหกโมงเช้า")',
    '• จดบันทึกข้อความ (เช่น "ช่วยจดว่าต้องซื้อนม")',
    '• ดูหรือลบรายการที่ตั้งไว้ (เช่น "ดูรายการเตือน")',
    `• ส่งข้อความเสียงคุยกับหนูแทนการพิมพ์ได้ตลอดเลย${affirmativeEnding}`,
  ].join('\n');
}

/**
 * Builds contextual complementary feature suggestions based on what the user just did.
 */
export function buildComplementarySuggestionsText(
  intent: IntentType,
  userDoc?: PersonaUserInput | null,
): string {
  const { affirmativeEnding, questionEnding, anytimeEnding, alwaysEnding } =
    resolvePoliteEndings(userDoc);

  switch (intent) {
    case 'save_note':
      return `หนูยังช่วยตั้งเตือนความจำ (เช่น เตือนกินยา) หรือตั้งนาฬิกาปลุกให้ได้ด้วย${affirmativeEnding} อยากให้หนูช่วยตั้งเตือนหรือตั้งนาฬิกาปลุกเรื่องนี้ด้วยไหม${questionEnding}`;

    case 'set_reminder':
      return `นอกจากนี้ หนูยังช่วยจดบันทึกข้อความ (เช่น จดเรื่องสำคัญ) หรือตั้งนาฬิกาปลุกให้ได้ด้วย${affirmativeEnding} บอกหนู${anytimeEnding}`;

    case 'set_alarm':
      return `นอกจากนี้ หนูยังช่วยตั้งเตือนความจำ (เช่น เตือนกินยา) หรือช่วยจดบันทึกข้อความให้ได้ด้วย${affirmativeEnding} บอกหนู${anytimeEnding}`;

    case 'list_items':
      return `คุณตาคุณยายสามารถบอกให้หนูช่วยลบรายการ หรือช่วยตั้งเตือนและบันทึกเรื่องใหม่ได้${alwaysEnding}`;

    case 'delete_item':
      return `สามารถบอกให้หนูช่วยตั้งเตือนใหม่ หรือพิมพ์ว่า "ดูรายการเตือน" เพื่อตรวจดูรายการที่เหลือได้${affirmativeEnding}`;

    default:
      return '';
  }
}

/**
 * Builds suggestions following explicit action confirmations or cancellations.
 */
export function buildActionConfirmationSuggestionsText(
  actionType: 'confirm_note' | 'confirm_reminder' | 'cancel_action',
  userDoc?: PersonaUserInput | null,
): string {
  const { anytimeEnding, alwaysEnding } = resolvePoliteEndings(userDoc);

  switch (actionType) {
    case 'confirm_note':
      return `หากต้องการให้หนูช่วยตั้งเตือนความจำ หรือตั้งนาฬิกาปลุก บอกหนู${anytimeEnding}`;

    case 'confirm_reminder':
      return `หากต้องการให้หนูช่วยจดบันทึกข้อความ หรือตั้งนาฬิกาปลุก บอกหนู${anytimeEnding}`;

    case 'cancel_action':
      return `คุณตาคุณยายสามารถบอกให้หนูช่วยตั้งเตือน ตั้งนาฬิกาปลุก หรือจดบันทึกเรื่องอื่นได้${alwaysEnding}`;
  }
}

export interface FeatureSuggestionOptions {
  intent?: IntentType | string;
  userText?: string;
  actionType?: 'confirm_note' | 'confirm_reminder' | 'cancel_action';
  userDoc?: PersonaUserInput | null;
  disableSuggestions?: boolean;
}

/**
 * Builds the feature suggestion chat bubble message ({ type: 'text', text: ... })
 * to be placed underneath the primary message sent by the bot.
 *
 * Guarantees:
 * - Only verified features are ever suggested.
 * - Simple text chat bubble format (no advanced forms, flex, or carousels).
 * - Returns null when suggestions are disabled or not applicable.
 */
export function buildFeatureSuggestionBubble(
  options: FeatureSuggestionOptions,
): messagingApi.TextMessage | null {
  if (options.disableSuggestions) {
    return null;
  }

  // 1. Direct capabilities or help inquiry
  if (options.userText && isCapabilitiesInquiry(options.userText)) {
    return {
      type: 'text',
      text: buildFullCapabilitiesText(options.userDoc),
    };
  }

  // 2. Action confirmation or cancellation
  if (options.actionType) {
    const text = buildActionConfirmationSuggestionsText(options.actionType, options.userDoc);
    return text ? { type: 'text', text } : null;
  }

  // 3. Contextual tool suggestion after tool execution
  if (options.intent && options.intent in COMPLEMENTARY_FEATURE_MAP) {
    const text = buildComplementarySuggestionsText(options.intent as IntentType, options.userDoc);
    return text ? { type: 'text', text } : null;
  }

  return null;
}
