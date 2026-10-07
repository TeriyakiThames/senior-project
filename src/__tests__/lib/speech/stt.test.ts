import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transcribeThaiAudio, speechClient, getSpeechClientOptions } from '@/lib/speech/stt';
import { v2 } from '@google-cloud/speech';

describe('Google Cloud Speech-to-Text v2 Client (STT-01)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe('Client configuration & options', () => {
    it('initializes speechClient as an instance of v2.SpeechClient', () => {
      expect(speechClient).toBeInstanceOf(v2.SpeechClient);
    });

    it('derives default regional endpoint when no location is specified', () => {
      delete process.env.GCP_LOCATION;
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;

      const options = getSpeechClientOptions();
      expect(options.apiEndpoint).toBe('asia-southeast1-speech.googleapis.com');
      expect(options.credentials).toBeUndefined();
    });

    it('uses specified GCP_LOCATION for the regional endpoint', () => {
      process.env.GCP_LOCATION = 'us-central1';
      const options = getSpeechClientOptions();
      expect(options.apiEndpoint).toBe('us-central1-speech.googleapis.com');
    });

    it('parses valid GOOGLE_APPLICATION_CREDENTIALS_JSON', () => {
      const mockCreds = {
        client_email: 'stt-service-account@test.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----',
      };
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify(mockCreds);

      const options = getSpeechClientOptions();
      expect(options.credentials).toEqual(mockCreds);
    });

    it('falls back gracefully when GOOGLE_APPLICATION_CREDENTIALS_JSON is invalid JSON', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = 'invalid-json';

      const options = getSpeechClientOptions();
      expect(options.credentials).toBeUndefined();
    });
  });

  describe('transcribeThaiAudio', () => {
    it('returns empty string if audioBuffer is empty', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const mockClient = {
        recognize: vi.fn(),
      } as unknown as v2.SpeechClient;

      const result = await transcribeThaiAudio(emptyBuffer, { client: mockClient });

      expect(result).toBe('');
      expect(mockClient.recognize).not.toHaveBeenCalled();
    });

    it('sends correct Chirp 2 parameters and formats recognized transcript', async () => {
      const audioBuffer = Buffer.from('mock-audio-data');
      const mockRecognize = vi.fn().mockResolvedValue([
        {
          results: [
            {
              alternatives: [{ transcript: 'สวัสดีครับ' }],
            },
            {
              alternatives: [{ transcript: 'ช่วยเตือนกินยาด้วยนะ' }],
            },
          ],
        },
      ]);

      const mockClient = {
        recognize: mockRecognize,
      } as unknown as v2.SpeechClient;

      const transcript = await transcribeThaiAudio(audioBuffer, {
        projectId: 'test-project',
        location: 'asia-southeast1',
        client: mockClient,
      });

      expect(mockRecognize).toHaveBeenCalledTimes(1);
      expect(mockRecognize).toHaveBeenCalledWith({
        recognizer: 'projects/test-project/locations/asia-southeast1/recognizers/_',
        config: {
          autoDecodingConfig: {},
          languageCodes: ['th-TH', 'en-US'],
          model: 'chirp_2',
          features: {
            enableAutomaticPunctuation: true,
          },
        },
        content: audioBuffer,
      });

      expect(transcript).toBe('สวัสดีครับ ช่วยเตือนกินยาด้วยนะ');
    });

    it('returns empty string when speech results are empty or silent', async () => {
      const audioBuffer = Buffer.from('silent-audio');
      const mockClient = {
        recognize: vi.fn().mockResolvedValue([{ results: [] }]),
      } as unknown as v2.SpeechClient;

      const transcript = await transcribeThaiAudio(audioBuffer, { client: mockClient });
      expect(transcript).toBe('');
    });

    it('returns empty string when alternatives lack transcripts', async () => {
      const audioBuffer = Buffer.from('noise-audio');
      const mockClient = {
        recognize: vi.fn().mockResolvedValue([
          {
            results: [{ alternatives: [] }],
          },
        ]),
      } as unknown as v2.SpeechClient;

      const transcript = await transcribeThaiAudio(audioBuffer, { client: mockClient });
      expect(transcript).toBe('');
    });
  });
});
