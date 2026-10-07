import type { webhook } from '@line/bot-sdk';
import { lineClient } from '@/lib/line/client';
import { downloadVoiceMessage } from '@/lib/line/voice';
import { transcribeThaiAudio } from '@/lib/speech/stt';
import { userRef } from '@/lib/firebase/collections';
import type { UserDoc } from '@/types/firestore';

export interface PersonaParticles {
  title: string;
  affirmative: string;
  question: string;
}

/**
 * Resolves polite particles and elder addressing based on user profile facts or defaults.
 */
export function resolvePersonaParticles(userDoc?: UserDoc | null): PersonaParticles {
  const facts = userDoc?.profile?.facts ?? [];
  const factsString = facts.join(' ').toLowerCase();

  // Intimate elder relative phrasing (จ้ะ / จ๊ะ)
  if (
    factsString.includes('จ้ะ') ||
    factsString.includes('จ๊ะ') ||
    factsString.includes('ยาย') ||
    factsString.includes('ย่า') ||
    factsString.includes('intimate')
  ) {
    return {
      title: 'ยาย',
      affirmative: 'จ้ะ',
      question: 'จ๊ะ',
    };
  }

  // Male speaker or polite ครับ
  if (factsString.includes('ครับ') || factsString.includes('male')) {
    return {
      title: 'หลาน',
      affirmative: 'ครับ',
      question: 'ครับ',
    };
  }

  // Default respectful female speaker (ค่ะ / คะ) per elder guidelines
  return {
    title: '',
    affirmative: 'ค่ะ',
    question: 'คะ',
  };
}

/**
 * Builds a warm, gentle Thai prompt asking the user to speak again when audio is silent or inaudible.
 */
export function buildSilencePrompt(particles: PersonaParticles): string {
  if (particles.affirmative === 'จ้ะ') {
    return 'ยายไม่ได้ยินเลยจ้ะ พูดใหม่อีกทีได้ไหมจ๊ะ 🙏';
  }
  if (particles.affirmative === 'ครับ') {
    return 'หลานไม่ได้ยินเลยครับ พูดใหม่อีกทีได้ไหมครับ 🙏';
  }
  return 'ไม่ได้ยินเลยค่ะ พูดใหม่อีกทีได้ไหมคะ 🙏';
}

/**
 * Builds a friendly Thai prompt when an unrecoverable speech processing error occurs.
 */
export function buildErrorPrompt(particles: PersonaParticles): string {
  if (particles.affirmative === 'จ้ะ') {
    return 'ขออภัยจ้ะ ระบบฟังเสียงขัดข้องชั่วคราว ลองส่งเป็นข้อความหรือพูดใหม่อีกทีนะจ๊ะ 🙏';
  }
  if (particles.affirmative === 'ครับ') {
    return 'ขออภัยครับ ระบบฟังเสียงขัดข้องชั่วคราว ลองส่งเป็นข้อความหรือพูดใหม่อีกทีนะครับ 🙏';
  }
  return 'ขออภัยค่ะ ระบบฟังเสียงขัดข้องชั่วคราว ลองส่งเป็นข้อความหรือพูดใหม่อีกทีนะคะ 🙏';
}

/**
 * Retrieves the user profile from Firestore if userId is present, safely ignoring errors.
 */
export async function getUserProfile(userId?: string): Promise<UserDoc | null> {
  if (!userId) {
    return null;
  }
  try {
    const snap = await userRef(userId).get();
    if (snap.exists) {
      return snap.data() as UserDoc;
    }
  } catch (error) {
    console.warn(`[SpeechHandler] Failed to fetch user profile for "${userId}":`, error);
  }
  return null;
}

/**
 * Processes an incoming LINE voice note event:
 * 1. Downloads the audio payload from LINE Blob storage.
 * 2. Transcribes the audio using Google Cloud Speech-to-Text v2 Chirp model.
 * 3. Handles inaudible/silent audio with dynamic persona polite particles.
 * 4. Catches unrecoverable errors gracefully and replies with a friendly Thai retry prompt.
 * 5. Hands off valid transcribed text to the downstream text pipeline.
 */
export async function processAudioMessage(
  event: webhook.MessageEvent & { message: webhook.AudioMessageContent },
  onTranscribed?: (transcript: string) => Promise<void>,
): Promise<string | null> {
  const replyToken = event.replyToken;
  const messageId = event.message.id;
  const userId = event.source?.userId;

  // Retrieve user profile to resolve persona particles
  const userDoc = await getUserProfile(userId);
  const particles = resolvePersonaParticles(userDoc);

  try {
    const audioBuffer = await downloadVoiceMessage(messageId);
    const transcript = (await transcribeThaiAudio(audioBuffer)).trim();

    // Inaudible or silent voice note
    if (!transcript) {
      if (replyToken) {
        await lineClient.replyMessage({
          replyToken,
          messages: [
            {
              type: 'text',
              text: buildSilencePrompt(particles),
            },
          ],
        });
      }
      return null;
    }

    // Hand off recognized text to downstream pipeline
    if (onTranscribed) {
      await onTranscribed(transcript);
    }

    return transcript;
  } catch (error) {
    console.error(`[SpeechHandler] Error processing audio message ${messageId}:`, error);

    if (replyToken) {
      try {
        await lineClient.replyMessage({
          replyToken,
          messages: [
            {
              type: 'text',
              text: buildErrorPrompt(particles),
            },
          ],
        });
      } catch (replyError) {
        console.error('[SpeechHandler] Failed to dispatch error reply message:', replyError);
      }
    }

    return null;
  }
}
