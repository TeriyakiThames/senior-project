import { Readable } from 'node:stream';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadVoiceMessage, LineVoiceDownloadError } from '@/lib/line/voice';
import { lineBlobClient } from '@/lib/line/client';

vi.mock('@/lib/line/client', () => ({
  lineBlobClient: {
    getMessageContent: vi.fn(),
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
});
