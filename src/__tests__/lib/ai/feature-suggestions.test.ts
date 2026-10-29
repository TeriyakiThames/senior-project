import { describe, it, expect } from 'vitest';
import {
  VERIFIED_BOT_FEATURES,
  ALLOWED_FEATURE_IDS,
  isAllowedFeature,
  validateFeatureIds,
  sanitizeFeatureList,
  isCapabilitiesInquiry,
  buildFullCapabilitiesText,
  buildComplementarySuggestionsText,
  buildActionConfirmationSuggestionsText,
  buildFeatureSuggestionBubble,
  type BotFeatureId,
} from '@/lib/ai/feature-suggestions';

describe('Feature Suggestions & Anti-Hallucination Safeguards', () => {
  describe('VERIFIED_BOT_FEATURES & Whitelist', () => {
    it('contains strictly the 6 verified bot capabilities and no others', () => {
      const keys = Object.keys(VERIFIED_BOT_FEATURES);
      expect(keys).toHaveLength(6);
      expect(keys.sort()).toEqual([
        'delete_item',
        'list_items',
        'save_note',
        'set_alarm',
        'set_reminder',
        'voice_input',
      ]);
    });

    it('defines name, description, and example for every feature', () => {
      for (const feature of Object.values(VERIFIED_BOT_FEATURES)) {
        expect(feature.id).toBeTruthy();
        expect(feature.name).toBeTruthy();
        expect(feature.description).toBeTruthy();
        expect(feature.example).toBeTruthy();
      }
    });

    it('safeguards against hallucinated capabilities via isAllowedFeature', () => {
      // Genuine features
      expect(isAllowedFeature('save_note')).toBe(true);
      expect(isAllowedFeature('set_reminder')).toBe(true);
      expect(isAllowedFeature('set_alarm')).toBe(true);
      expect(isAllowedFeature('list_items')).toBe(true);
      expect(isAllowedFeature('delete_item')).toBe(true);
      expect(isAllowedFeature('voice_input')).toBe(true);

      // Hallucinated / Unsupported features must return false
      expect(isAllowedFeature('call_ambulance')).toBe(false);
      expect(isAllowedFeature('order_food')).toBe(false);
      expect(isAllowedFeature('play_music')).toBe(false);
      expect(isAllowedFeature('weather_forecast')).toBe(false);
      expect(isAllowedFeature('smart_home_control')).toBe(false);
      expect(isAllowedFeature('stock_trading')).toBe(false);
    });

    it('validates feature ID lists via validateFeatureIds', () => {
      expect(validateFeatureIds(['set_reminder', 'save_note', 'set_alarm'])).toBe(true);
      expect(validateFeatureIds(['save_note', 'order_groceries'])).toBe(false);
    });

    it('filters out hallucinated features via sanitizeFeatureList', () => {
      const mixed = ['save_note', 'book_taxi', 'set_alarm', 'read_news', 'voice_input'];
      const sanitized = sanitizeFeatureList(mixed);

      expect(sanitized).toEqual(['save_note', 'set_alarm', 'voice_input']);
    });
  });

  describe('isCapabilitiesInquiry', () => {
    it('identifies explicit capability inquiries in Thai', () => {
      expect(isCapabilitiesInquiry('ทำอะไรได้บ้าง')).toBe(true);
      expect(isCapabilitiesInquiry('ช่วยอะไรได้บ้าง')).toBe(true);
      expect(isCapabilitiesInquiry('ทำไรได้บ้าง')).toBe(true);
      expect(isCapabilitiesInquiry('บอททำอะไรได้')).toBe(true);
      expect(isCapabilitiesInquiry('มีฟีเจอร์อะไรบ้าง')).toBe(true);
      expect(isCapabilitiesInquiry('มีฟังก์ชันอะไรบ้าง')).toBe(true);
      expect(isCapabilitiesInquiry('วิธีใช้')).toBe(true);
      expect(isCapabilitiesInquiry('สอนใช้หน่อย')).toBe(true);
      expect(isCapabilitiesInquiry('เมนู')).toBe(true);
      expect(isCapabilitiesInquiry('ช่วยเหลือ')).toBe(true);
    });

    it('identifies capability inquiries in English', () => {
      expect(isCapabilitiesInquiry('help')).toBe(true);
      expect(isCapabilitiesInquiry('what can you do?')).toBe(true);
      expect(isCapabilitiesInquiry('menu')).toBe(true);
      expect(isCapabilitiesInquiry('info')).toBe(true);
    });

    it('returns false for general chat, greetings, and empty messages', () => {
      expect(isCapabilitiesInquiry('สวัสดี')).toBe(false);
      expect(isCapabilitiesInquiry('สบายดีไหม')).toBe(false);
      expect(isCapabilitiesInquiry('กินข้าวหรือยัง')).toBe(false);
      expect(isCapabilitiesInquiry('วันนี้ปวดหลังจัง')).toBe(false);
      expect(isCapabilitiesInquiry('')).toBe(false);
      expect(isCapabilitiesInquiry(undefined)).toBe(false);
    });
  });

  describe('buildFullCapabilitiesText', () => {
    it('builds clear bulleted capability list using default Thai persona', () => {
      const text = buildFullCapabilitiesText(null);

      expect(text).toContain('หนูสามารถช่วยคุณตาคุณยายได้ตามนี้เลยค่ะ:');
      expect(text).toContain('• ตั้งเตือนความจำ');
      expect(text).toContain('• ตั้งนาฬิกาปลุก');
      expect(text).toContain('• จดบันทึกข้อความ');
      expect(text).toContain('• ดูหรือลบรายการที่ตั้งไว้');
      expect(text).toContain('• ส่งข้อความเสียงคุยกับหนูแทนการพิมพ์ได้ตลอดเลยนะคะ');
    });

    it('respects male persona particles when user facts indicate ครับ', () => {
      const text = buildFullCapabilitiesText({ profile: { facts: ['particle:ครับ'] } });

      expect(text).toContain('ตามนี้เลยครับ:');
      expect(text).toContain('ส่งข้อความเสียงคุยกับหนูแทนการพิมพ์ได้ตลอดเลยนะครับ');
    });

    it('respects intimate grandma persona particles when user facts indicate ยาย', () => {
      const text = buildFullCapabilitiesText({ profile: { facts: ['คุณยายสมศรี', 'พูดจ้ะ'] } });

      expect(text).toContain('หนูสามารถช่วยคุณยายได้ตามนี้เลยจ้ะ:');
      expect(text).toContain('ส่งข้อความเสียงคุยกับหนูแทนการพิมพ์ได้ตลอดเลยนะจ้ะ');
    });
  });

  describe('buildComplementarySuggestionsText', () => {
    it('suggests reminder and alarm after save_note', () => {
      const text = buildComplementarySuggestionsText('save_note', null);

      expect(text).toContain('ตั้งเตือนความจำ');
      expect(text).toContain('ตั้งนาฬิกาปลุก');
      expect(text).toContain('อยากให้หนูช่วยตั้งเตือนหรือตั้งนาฬิกาปลุกเรื่องนี้ด้วยไหมคะ');
      // Should not redundantly offer to save a note again
      expect(text).not.toContain('ช่วยจดบันทึก');
    });

    it('suggests save_note and alarm after set_reminder', () => {
      const text = buildComplementarySuggestionsText('set_reminder', null);

      expect(text).toContain('จดบันทึกข้อความ');
      expect(text).toContain('ตั้งนาฬิกาปลุก');
      expect(text).toContain('บอกหนูได้ตลอดเวลาเลยนะคะ');
      // Should not redundantly offer to set a reminder
      expect(text).not.toContain('ตั้งเตือนความจำ');
    });

    it('suggests reminder and save_note after set_alarm', () => {
      const text = buildComplementarySuggestionsText('set_alarm', null);

      expect(text).toContain('ตั้งเตือนความจำ');
      expect(text).toContain('จดบันทึกข้อความ');
      expect(text).toContain('บอกหนูได้ตลอดเวลาเลยนะคะ');
      // Should not redundantly offer to set an alarm
      expect(text).not.toContain('ตั้งนาฬิกาปลุก');
    });

    it('suggests delete or setting new items after list_items', () => {
      const text = buildComplementarySuggestionsText('list_items', null);

      expect(text).toContain('ลบรายการ');
      expect(text).toContain('ตั้งเตือนและบันทึกเรื่องใหม่');
      expect(text).toContain('เสมอนะคะ');
    });

    it('suggests setting new reminders or checking remaining items after delete_item', () => {
      const text = buildComplementarySuggestionsText('delete_item', null);

      expect(text).toContain('ช่วยตั้งเตือนใหม่');
      expect(text).toContain('ดูรายการเตือน');
    });
  });

  describe('buildActionConfirmationSuggestionsText', () => {
    it('suggests setting reminder or alarm after confirm_note', () => {
      const text = buildActionConfirmationSuggestionsText('confirm_note', null);

      expect(text).toContain('ตั้งเตือนความจำ');
      expect(text).toContain('ตั้งนาฬิกาปลุก');
      expect(text).toContain('บอกหนูได้ตลอดเวลาเลยนะคะ');
    });

    it('suggests saving notes or setting alarm after confirm_reminder', () => {
      const text = buildActionConfirmationSuggestionsText('confirm_reminder', null);

      expect(text).toContain('จดบันทึกข้อความ');
      expect(text).toContain('ตั้งนาฬิกาปลุก');
    });

    it('provides warm encouragement after cancel_action', () => {
      const text = buildActionConfirmationSuggestionsText('cancel_action', null);

      expect(text).toContain('ช่วยตั้งเตือน');
      expect(text).toContain('ตั้งนาฬิกาปลุก');
      expect(text).toContain('จดบันทึก');
    });
  });

  describe('buildFeatureSuggestionBubble', () => {
    it('returns full capabilities bubble on capability inquiry text', () => {
      const bubble = buildFeatureSuggestionBubble({
        userText: 'เธอช่วยอะไรได้บ้าง',
      });

      expect(bubble).not.toBeNull();
      expect(bubble?.type).toBe('text');
      expect(bubble?.text).toContain('หนูสามารถช่วยคุณตาคุณยายได้ตามนี้เลยค่ะ:');
      expect(bubble?.text).toContain('• ตั้งเตือนความจำ');
    });

    it('returns complementary suggestion bubble after save_note intent', () => {
      const bubble = buildFeatureSuggestionBubble({
        intent: 'save_note',
        userText: 'ช่วยจดว่าต้องซื้อนม',
      });

      expect(bubble).not.toBeNull();
      expect(bubble?.type).toBe('text');
      expect(bubble?.text).toContain('ตั้งเตือนความจำ');
      expect(bubble?.text).toContain('ตั้งนาฬิกาปลุก');
    });

    it('returns action confirmation bubble for confirm_note', () => {
      const bubble = buildFeatureSuggestionBubble({
        actionType: 'confirm_note',
      });

      expect(bubble).not.toBeNull();
      expect(bubble?.type).toBe('text');
      expect(bubble?.text).toContain('หากต้องการให้หนูช่วยตั้งเตือนความจำ หรือตั้งนาฬิกาปลุก');
    });

    it('returns null when disableSuggestions is set to true', () => {
      const bubble = buildFeatureSuggestionBubble({
        intent: 'save_note',
        disableSuggestions: true,
      });

      expect(bubble).toBeNull();
    });

    it('returns null for general chat without capabilities inquiry', () => {
      const bubble = buildFeatureSuggestionBubble({
        intent: 'general_chat',
        userText: 'สวัสดีตอนเช้าจ้ะ',
      });

      expect(bubble).toBeNull();
    });
  });
});
