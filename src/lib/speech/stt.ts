import { v2 } from '@google-cloud/speech';
import { geminiClient } from '@/lib/ai/gemini';

export interface TranscribeAudioOptions {
  projectId?: string;
  location?: string;
  client?: v2.SpeechClient;
  disableFallback?: boolean;
}

/**
 * Derives configuration options for SpeechClient initialization,
 * pointing to the regional endpoint and ingesting JSON credentials if provided.
 * Falls back to FIREBASE_SERVICE_ACCOUNT_KEY if GOOGLE_APPLICATION_CREDENTIALS_JSON is unset.
 */
export function getSpeechClientOptions() {
  const location = process.env.GCP_LOCATION || 'asia-southeast1';
  const apiEndpoint = `${location}-speech.googleapis.com`;

  const options: {
    apiEndpoint: string;
    credentials?: Record<string, unknown>;
  } = {
    apiEndpoint,
  };

  const credentialsJson =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (credentialsJson) {
    try {
      const parsed = JSON.parse(credentialsJson) as Record<string, unknown>;
      if (typeof parsed.private_key === 'string') {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      options.credentials = parsed;
    } catch (parseError) {
      console.warn(
        '[STT] Failed to parse speech client credentials JSON, falling back to ADC:',
        parseError,
      );
    }
  }

  return options;
}

const globalForSpeech = globalThis as unknown as {
  speechClient?: v2.SpeechClient;
};

export const speechClient =
  globalForSpeech.speechClient ?? new v2.SpeechClient(getSpeechClientOptions());

if (process.env.NODE_ENV !== 'production') {
  globalForSpeech.speechClient = speechClient;
}

/**
 * Fallback transcription using Gemini multimodal audio capabilities.
 * Invoked when Google Cloud STT v2 encounters quota, disabled API, or permission issues.
 */
export async function transcribeThaiAudioWithGemini(
  audioBuffer: Buffer | Uint8Array,
): Promise<string> {
  const buffer = Buffer.isBuffer(audioBuffer) ? audioBuffer : Buffer.from(audioBuffer);
  const base64Audio = buffer.toString('base64');

  const interaction = await geminiClient.interactions.create({
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
    input: [
      {
        type: 'text',
        text: 'ถอดความเสียงภาษาไทยนี้เป็นข้อความภาษาไทยอย่างถูกต้องและตรงไปตรงมาที่สุด ถอดเฉพาะคำพูดที่ได้ยินเท่านั้น ห้ามแต่งเติม ห้ามตอบรับ ห้ามใส่คำอธิบายเพิ่มเติม ห้ามใส่เครื่องหมายคำพูด หากไม่มีเสียงพูดหรือเป็นเพียงเสียงเงียบ ให้ตอบว่า SILENCE',
      },
      {
        type: 'audio',
        data: base64Audio,
        mime_type: 'audio/m4a',
      },
    ],
    generation_config: {
      temperature: 0.1,
      max_output_tokens: 512,
    },
    store: false,
  });

  const output = (interaction.output_text ?? '').trim();
  if (!output || output.toUpperCase() === 'SILENCE') {
    return '';
  }
  return output;
}

/**
 * Transcribes audio (Buffer or Uint8Array) into Thai text using Google Cloud Speech-to-Text v2 Chirp 2 model.
 *
 * Automatically detects audio encoding (native m4a/AAC decoding without ffmpeg),
 * applies bilingual language detection (th-TH primary, en-US secondary), and enables automatic punctuation.
 * Gracefully falls back to Gemini multimodal transcription if Cloud STT encounters permissions or service outages.
 *
 * @param audioBuffer Audio payload as Buffer or Uint8Array
 * @param options Optional overrides for projectId, location, client instance, or disabling fallback
 * @returns Cleaned transcript string combining all recognized alternatives, or empty string if no speech is detected.
 */
export async function transcribeThaiAudio(
  audioBuffer: Buffer | Uint8Array,
  options?: TranscribeAudioOptions,
): Promise<string> {
  if (!audioBuffer || audioBuffer.length === 0) {
    return '';
  }

  // Derive default project ID from env or credentials JSON
  let defaultProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  if (!defaultProjectId) {
    const credentialsJson =
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (credentialsJson) {
      try {
        const parsed = JSON.parse(credentialsJson) as { project_id?: string };
        if (parsed?.project_id) {
          defaultProjectId = parsed.project_id;
        }
      } catch {
        // ignore parse failure
      }
    }
  }

  const projectId = options?.projectId || defaultProjectId || 'senior-project-dummy';
  const location = options?.location || process.env.GCP_LOCATION || 'asia-southeast1';
  const client = options?.client || speechClient;

  const recognizer = `projects/${projectId}/locations/${location}/recognizers/_`;

  const request = {
    recognizer,
    config: {
      autoDecodingConfig: {},
      languageCodes: ['th-TH', 'en-US'],
      model: 'chirp_2',
      features: {
        enableAutomaticPunctuation: true,
      },
    },
    content: audioBuffer,
  };

  try {
    const [response] = await client.recognize(request);
    const results = response?.results ?? [];

    if (results.length === 0) {
      return '';
    }

    const transcripts = results
      .map((r) => r.alternatives?.[0]?.transcript ?? '')
      .filter(Boolean)
      .join(' ')
      .trim();

    return transcripts;
  } catch (error) {
    if (options?.disableFallback) {
      throw error;
    }

    console.warn(
      '[STT] Cloud Speech-to-Text v2 failed, attempting Gemini multimodal transcription fallback:',
      error,
    );

    try {
      return await transcribeThaiAudioWithGemini(audioBuffer);
    } catch (fallbackError) {
      console.error('[STT] Both Cloud STT and Gemini fallback failed:', fallbackError);
      throw error;
    }
  }
}
