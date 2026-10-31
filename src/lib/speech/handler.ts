import type { webhook } from '@line/bot-sdk';
import { resolvePersonaParticles, type PersonaParticles } from '@/lib/ai/persona';
import { userRef } from '@/lib/firebase/collections';
import { lineClient } from '@/lib/line/client';
import { downloadVoiceMessage } from '@/lib/line/voice';
import { transcribeThaiAudio } from '@/lib/speech/stt';
import type { UserDoc } from '@/types/firestore';
import { logError } from '@/lib/utils/errors';

export type { PersonaParticles } from '@/lib/ai/persona';
export { resolvePersonaParticles };

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

  // Retrieve user profile to resolve persona particles concurrently with voice download
  const userDocPromise = getUserProfile(userId);
  let userDoc: UserDoc | null = null;

  try {
    const [fetchedUserDoc, audioBuffer] = await Promise.all([
      userDocPromise,
      downloadVoiceMessage(messageId),
    ]);
    userDoc = fetchedUserDoc;
    const particles = resolvePersonaParticles(userDoc);

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
    logError('stt', error, { messageId, userId });

    const fallbackUserDoc = userDoc ?? (await userDocPromise.catch(() => null));
    const particles = resolvePersonaParticles(fallbackUserDoc);

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
        logError('line_reply', replyError, { messageId, userId });
      }
    }

    return null;
  }
}
