import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { webhook } from '@line/bot-sdk';
import { processAudioMessage, resolvePersonaParticles } from '@/lib/speech/handler';
import { lineClient } from '@/lib/line/client';
import { downloadVoiceMessage } from '@/lib/line/voice';
import { transcribeThaiAudio } from '@/lib/speech/stt';
import { userRef } from '@/lib/firebase/collections';

vi.mock('@/lib/line/client', () => ({
  lineClient: {
    replyMessage: vi.fn(),
  },
}));

vi.mock('@/lib/line/voice', () => ({
  downloadVoiceMessage: vi.fn(),
}));

vi.mock('@/lib/speech/stt', () => ({
  transcribeThaiAudio: vi.fn(),
}));

vi.mock('@/lib/firebase/collections', () => ({
  userRef: vi.fn(),
}));

describe('Speech Event Handler (processAudioMessage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseAudioEvent = {
    type: 'message' as const,
    replyToken: 'reply-token-test',
    source: {
      userId: 'user-elder-123',
    },
    message: {
      id: 'voice-msg-999',
      type: 'audio' as const,
    },
  } as unknown as webhook.MessageEvent & { message: webhook.AudioMessageContent };

  describe('resolvePersonaParticles', () => {
    it('resolves default polite female particles when no facts match', () => {
      const particles = resolvePersonaParticles(null);
      expect(particles).toEqual({ title: '', affirmative: 'ค่ะ', question: 'คะ' });
    });

    it('resolves intimate elder particles when user facts contain "จ้ะ" or "ยาย"', () => {
      const particles = resolvePersonaParticles({
        profile: { facts: ['ชอบฟังเพลงเก่า', 'ยาย'] },
      } as never);
      expect(particles).toEqual({ title: 'ยาย', affirmative: 'จ้ะ', question: 'จ๊ะ' });
    });

    it('resolves polite male particles when user facts contain "ครับ"', () => {
      const particles = resolvePersonaParticles({
        profile: { facts: ['particle:ครับ'] },
      } as never);
      expect(particles).toEqual({ title: 'หลาน', affirmative: 'ครับ', question: 'ครับ' });
    });
  });

  describe('processAudioMessage workflow', () => {
    it('downloads audio, transcribes text, and triggers onTranscribed callback', async () => {
      vi.mocked(userRef).mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      } as never);

      const fakeBuffer = Buffer.from('fake-audio-bytes');
      vi.mocked(downloadVoiceMessage).mockResolvedValue(fakeBuffer);
      vi.mocked(transcribeThaiAudio).mockResolvedValue('เตือนกินยาตอนบ่ายสอง');

      const onTranscribedMock = vi.fn().mockResolvedValue(undefined);

      const result = await processAudioMessage(baseAudioEvent, onTranscribedMock);

      expect(downloadVoiceMessage).toHaveBeenCalledWith('voice-msg-999');
      expect(transcribeThaiAudio).toHaveBeenCalledWith(fakeBuffer);
      expect(onTranscribedMock).toHaveBeenCalledWith('เตือนกินยาตอนบ่ายสอง');
      expect(result).toBe('เตือนกินยาตอนบ่ายสอง');
      expect(lineClient.replyMessage).not.toHaveBeenCalled();
    });

    it('replies with gentle Thai prompt when audio is silent or inaudible (default particles)', async () => {
      vi.mocked(userRef).mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      } as never);

      vi.mocked(downloadVoiceMessage).mockResolvedValue(Buffer.from('silent-audio'));
      vi.mocked(transcribeThaiAudio).mockResolvedValue('');

      const onTranscribedMock = vi.fn();
      const result = await processAudioMessage(baseAudioEvent, onTranscribedMock);

      expect(onTranscribedMock).not.toHaveBeenCalled();
      expect(result).toBeNull();
      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'reply-token-test',
        messages: [
          {
            type: 'text',
            text: 'ไม่ได้ยินเลยค่ะ พูดใหม่อีกทีได้ไหมคะ 🙏',
          },
        ],
      });
    });

    it('adapts silence prompt to elder particles (จ้ะ/จ๊ะ) from user profile facts', async () => {
      vi.mocked(userRef).mockReturnValue({
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            profile: {
              facts: ['ยาย', 'จ้ะ'],
            },
          }),
        }),
      } as never);

      vi.mocked(downloadVoiceMessage).mockResolvedValue(Buffer.from('silent-audio'));
      vi.mocked(transcribeThaiAudio).mockResolvedValue('   ');

      const result = await processAudioMessage(baseAudioEvent);

      expect(result).toBeNull();
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'reply-token-test',
        messages: [
          {
            type: 'text',
            text: 'ยายไม่ได้ยินเลยจ้ะ พูดใหม่อีกทีได้ไหมจ๊ะ 🙏',
          },
        ],
      });
    });

    it('catches STT or download errors gracefully and replies with friendly retry message', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(userRef).mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      } as never);

      vi.mocked(downloadVoiceMessage).mockRejectedValue(new Error('LINE Blob Storage timeout'));

      const result = await processAudioMessage(baseAudioEvent);

      expect(result).toBeNull();
      expect(lineClient.replyMessage).toHaveBeenCalledTimes(1);
      expect(lineClient.replyMessage).toHaveBeenCalledWith({
        replyToken: 'reply-token-test',
        messages: [
          {
            type: 'text',
            text: 'ขออภัยค่ะ ระบบฟังเสียงขัดข้องชั่วคราว ลองส่งเป็นข้อความหรือพูดใหม่อีกทีนะคะ 🙏',
          },
        ],
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('does not send reply message if replyToken is missing', async () => {
      vi.mocked(downloadVoiceMessage).mockResolvedValue(Buffer.from('audio'));
      vi.mocked(transcribeThaiAudio).mockResolvedValue('');

      const eventWithoutReplyToken = {
        ...baseAudioEvent,
        replyToken: '',
      };

      const result = await processAudioMessage(eventWithoutReplyToken);

      expect(result).toBeNull();
      expect(lineClient.replyMessage).not.toHaveBeenCalled();
    });
  });
});
