import { beforeEach, afterEach, vi } from 'vitest';

// Configure test environment variables to prevent runtime warnings and missing key exceptions
Object.assign(process.env, { NODE_ENV: 'test' });
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-api-key';
process.env.TYPESAFE_API_KEY = process.env.TYPESAFE_API_KEY || 'test-typesafe-api-key';
process.env.LINE_CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || 'test-channel-secret';
process.env.LINE_CHANNEL_ACCESS_TOKEN =
  process.env.LINE_CHANNEL_ACCESS_TOKEN || 'test-channel-access-token';
process.env.WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'test-webhook-secret';
process.env.GOOGLE_CLOUD_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'test-gcp-project';
process.env.GCP_LOCATION = process.env.GCP_LOCATION || 'asia-southeast1';
process.env.CLOUD_TASKS_QUEUE_ID = process.env.CLOUD_TASKS_QUEUE_ID || 'senior-assistant-queue';
process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
process.env.LIFF_ID = process.env.LIFF_ID || 'test-liff-id';
process.env.NEXT_PUBLIC_LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || 'test-liff-id';

const originalEnv = { ...process.env };

beforeEach(() => {
  // Ensure base test environment is preserved across tests
  process.env = { ...originalEnv };
});

afterEach(() => {
  vi.clearAllMocks();
});
