import { messagingApi } from '@line/bot-sdk';

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';

export const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken,
});

export const lineBlobClient = new messagingApi.MessagingApiBlobClient({
  channelAccessToken,
});
