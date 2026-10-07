import { v2 } from '@google-cloud/speech';

export interface TranscribeAudioOptions {
  projectId?: string;
  location?: string;
  client?: v2.SpeechClient;
}

/**
 * Derives configuration options for SpeechClient initialization,
 * pointing to the regional endpoint and ingesting JSON credentials if provided.
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

  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credentialsJson) {
    try {
      options.credentials = JSON.parse(credentialsJson) as Record<string, unknown>;
    } catch {
      // Ignore parse failure and fall back to GCP default application credentials
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
 * Transcribes audio (Buffer or Uint8Array) into Thai text using Google Cloud Speech-to-Text v2 Chirp 2 model.
 *
 * Automatically detects audio encoding (native m4a/AAC decoding without ffmpeg),
 * applies bilingual language detection (th-TH primary, en-US secondary), and enables automatic punctuation.
 *
 * @param audioBuffer Audio payload as Buffer or Uint8Array
 * @param options Optional overrides for projectId, location, or SpeechClient instance
 * @returns Cleaned transcript string combining all recognized alternatives, or empty string if no speech is detected.
 */
export async function transcribeThaiAudio(
  audioBuffer: Buffer | Uint8Array,
  options?: TranscribeAudioOptions,
): Promise<string> {
  if (!audioBuffer || audioBuffer.length === 0) {
    return '';
  }

  const projectId =
    options?.projectId || process.env.GOOGLE_CLOUD_PROJECT_ID || 'senior-project-dummy';
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
}
