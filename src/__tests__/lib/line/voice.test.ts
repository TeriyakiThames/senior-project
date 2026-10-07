import { Readable } from 'node:stream';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadVoiceMessage, LineVoiceDownloadError } from '@/lib/line/voice';
import { lineBlobClient } from '@/lib/line/client';

vi.mock('@/lib/line/client', () => ({
  lineBlobClient: {
    getMessageContent: vi.fn(),
    getMessageContentWithHttpInfo: vi.fn(),
  },
}));

describe('downloadVoiceMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('downloads and concatenates binary audio chunks into a single Buffer', async () => {
    const chunk1 = Buffer.from('audio-part-1');
    const chunk2 = Buffer.from('-part-2');

    vi.mocked(lineBlobClient.getMessageContent).mockResolvedValueOnce(
      Readable.from([chunk1, chunk2]) as unknown as Awaited<
        ReturnType<typeof lineBlobClient.getMessageContent>
      >,
    );

    const buffer = await downloadVoiceMessage('voice_msg_101');

    expect(lineBlobClient.getMessageContent).toHaveBeenCalledWith('voice_msg_101');
    expect(buffer).toEqual(Buffer.from('audio-part-1-part-2'));
  });

  it('rejects with LineVoiceDownloadError when LINE client fails', async () => {
    vi.mocked(lineBlobClient.getMessageContent).mockRejectedValueOnce(
      new Error('LINE API request failed'),
    );

    await expect(downloadVoiceMessage('voice_msg_102')).rejects.toThrow(LineVoiceDownloadError);
  });

  it('handles mid-stream async read network failures without unhandled rejection', async () => {
    const errorStream = new Readable({
      async read() {
        throw new Error('Socket closed unexpectedly');
      },
    });

    vi.mocked(lineBlobClient.getMessageContent).mockResolvedValueOnce(
      errorStream as unknown as Awaited<ReturnType<typeof lineBlobClient.getMessageContent>>,
    );

    await expect(downloadVoiceMessage('voice_msg_103')).rejects.toThrow(LineVoiceDownloadError);
  });

  it('rejects with LineVoiceDownloadError when content is still transcoding (HTTP 202)', async () => {
    vi.mocked(lineBlobClient.getMessageContentWithHttpInfo).mockResolvedValueOnce({
      httpResponse: { status: 202 } as Response,
      body: Readable.from([]) as unknown as Readable,
    });

    const promise = downloadVoiceMessage('voice_msg_202');
    await expect(promise).rejects.toThrow(LineVoiceDownloadError);
    await expect(promise).rejects.toMatchObject({
      statusCode: 202,
      message: expect.stringContaining('still being prepared'),
    });
  });

  it('rejects with LineVoiceDownloadError when stream payload is empty (0 bytes)', async () => {
    vi.mocked(lineBlobClient.getMessageContent).mockResolvedValueOnce(
      Readable.from([]) as unknown as Awaited<ReturnType<typeof lineBlobClient.getMessageContent>>,
    );

    const promise = downloadVoiceMessage('voice_msg_empty');
    await expect(promise).rejects.toThrow(LineVoiceDownloadError);
    await expect(promise).rejects.toMatchObject({
      message: expect.stringContaining('Received empty audio payload'),
    });
  });

  it('rejects with LineVoiceDownloadError when messageId is empty, whitespace, or invalid type', async () => {
    // @ts-expect-error testing undefined input
    await expect(downloadVoiceMessage(undefined)).rejects.toThrow(LineVoiceDownloadError);
    // @ts-expect-error testing null input
    await expect(downloadVoiceMessage(null)).rejects.toThrow(LineVoiceDownloadError);
    // @ts-expect-error testing numeric input
    await expect(downloadVoiceMessage(12345)).rejects.toThrow(LineVoiceDownloadError);
    // @ts-expect-error testing object input
    await expect(downloadVoiceMessage({})).rejects.toThrow(LineVoiceDownloadError);

    await expect(downloadVoiceMessage('')).rejects.toThrow(LineVoiceDownloadError);
    await expect(downloadVoiceMessage('   ')).rejects.toThrow(LineVoiceDownloadError);
  });
});
