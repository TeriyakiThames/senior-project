import { messagingApi } from '@line/bot-sdk';

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

if (!channelAccessToken && process.env.NODE_ENV === 'production') {
  console.warn(
    '[LINE Client] Warning: LINE_CHANNEL_ACCESS_TOKEN is not defined in environment variables.',
  );
}

const globalForLine = globalThis as unknown as {
  lineClient?: messagingApi.MessagingApiClient;
  lineBlobClient?: messagingApi.MessagingApiBlobClient;
};

export const lineClient =
  globalForLine.lineClient ??
  new messagingApi.MessagingApiClient({
    channelAccessToken,
  });

export const lineBlobClient =
  globalForLine.lineBlobClient ??
  new messagingApi.MessagingApiBlobClient({
    channelAccessToken,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForLine.lineClient = lineClient;
  globalForLine.lineBlobClient = lineBlobClient;
}
