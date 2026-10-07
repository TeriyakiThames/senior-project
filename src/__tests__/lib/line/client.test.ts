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
});
