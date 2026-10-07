import { describe, it, expect } from 'vitest';
import { messagingApi } from '@line/bot-sdk';
import { lineClient, lineBlobClient } from '@/lib/line/client';

describe('LINE client singletons', () => {
  it('exports lineClient as an instance of MessagingApiClient', () => {
    expect(lineClient).toBeInstanceOf(messagingApi.MessagingApiClient);
  });

  it('exports lineBlobClient as an instance of MessagingApiBlobClient', () => {
    expect(lineBlobClient).toBeInstanceOf(messagingApi.MessagingApiBlobClient);
  });

  it('preserves singletons on globalThis in non-production environments', () => {
    const globalForLine = globalThis as unknown as {
      lineClient?: messagingApi.MessagingApiClient;
      lineBlobClient?: messagingApi.MessagingApiBlobClient;
    };
    expect(globalForLine.lineClient).toBe(lineClient);
    expect(globalForLine.lineBlobClient).toBe(lineBlobClient);
  });
});
