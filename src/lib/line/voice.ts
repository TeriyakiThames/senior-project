import type { Readable } from 'node:stream';
import { lineBlobClient } from './client';

/**
 * Custom error thrown when downloading a LINE voice message fails.
 */
export class LineVoiceDownloadError extends Error {
  public readonly messageId: string;
  public readonly statusCode?: number;
  public readonly cause?: unknown;

  constructor(
    message: string,
    options: { messageId: string; statusCode?: number; cause?: unknown },
  ) {
    super(message);
    this.name = 'LineVoiceDownloadError';
    this.messageId = options.messageId;
    this.statusCode = options.statusCode;
    this.cause = options.cause;
  }
}

export interface DownloadVoiceOptions {
  /**
   * Maximum allowed audio size in bytes to protect serverless memory.
   * Defaults to 25MB (26,214,400 bytes).
   */
  maxSizeBytes?: number;
}

const DEFAULT_MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

/**
 * Downloads a LINE voice message as an in-memory binary Buffer.
 *
 * Streams media chunks directly from LINE Blob Storage without writing
 * temporary files to disk, making it safe for serverless environments.
 *
 * @param messageId LINE audio message ID
 * @param options Optional configuration including maximum byte threshold
 * @returns In-memory Buffer containing complete binary audio stream
 * @throws {LineVoiceDownloadError} When retrieval fails, messageId is invalid, or payload exceeds limit
 */
export async function downloadVoiceMessage(
  messageId: string,
  options?: DownloadVoiceOptions,
): Promise<Buffer> {
  const trimmedId = messageId?.trim();
  if (!trimmedId) {
    throw new LineVoiceDownloadError('Invalid or empty messageId provided for voice download.', {
      messageId,
    });
  }

  const maxSizeBytes = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;

  try {
    let stream: Readable;
    let httpStatusCode: number | undefined;

    if (typeof lineBlobClient.getMessageContentWithHttpInfo === 'function') {
      const result = await lineBlobClient.getMessageContentWithHttpInfo(trimmedId);
      if (result && 'httpResponse' in result && result.httpResponse) {
        httpStatusCode = result.httpResponse.status;
        if (httpStatusCode === 202) {
          throw new LineVoiceDownloadError(
            'Voice message is still being prepared by LINE (HTTP 202 Accepted).',
            { messageId: trimmedId, statusCode: 202 },
          );
        }
        stream = result.body;
      } else {
        stream = await lineBlobClient.getMessageContent(trimmedId);
      }
    } else {
      stream = await lineBlobClient.getMessageContent(trimmedId);
    }

    // Guard against unhandled promise rejections inside @line/bot-sdk's async read implementation
    const streamWithRead = stream as unknown as {
      _read?: (size: number) => unknown;
      destroy: (err?: Error) => void;
    };
    if (typeof streamWithRead._read === 'function') {
      const originalRead = streamWithRead._read;
      streamWithRead._read = function (size: number) {
        const result = originalRead.call(this, size);
        if (result && typeof (result as Promise<unknown>).catch === 'function') {
          (result as Promise<unknown>).catch((err: unknown) => {
            this.destroy(err instanceof Error ? err : new Error(String(err)));
          });
        }
        return result;
      };
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const chunk of stream) {
      const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += bufferChunk.length;

      if (totalBytes > maxSizeBytes) {
        if ('destroy' in stream && typeof stream.destroy === 'function') {
          stream.destroy();
        }
        throw new LineVoiceDownloadError(
          `Voice message exceeded maximum allowed size of ${maxSizeBytes} bytes.`,
          { messageId: trimmedId },
        );
      }

      chunks.push(bufferChunk);
    }

    if (chunks.length === 0 || totalBytes === 0) {
      throw new LineVoiceDownloadError('Received empty audio payload from LINE Blob storage.', {
        messageId: trimmedId,
        statusCode: httpStatusCode,
      });
    }

    return Buffer.concat(chunks);
  } catch (error) {
    if (error instanceof LineVoiceDownloadError) {
      console.error(`[LINE Voice Downloader] Error: ${error.message} (messageId: ${trimmedId})`);
      throw error;
    }

    const statusCode =
      typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status: unknown }).status)
        : typeof error === 'object' && error !== null && 'statusCode' in error
          ? Number((error as { statusCode: unknown }).statusCode)
          : undefined;

    console.error(
      `[LINE Voice Downloader] Failed to download voice message for messageId "${trimmedId}":`,
      error,
    );

    throw new LineVoiceDownloadError(
      `Failed to download voice message content: ${error instanceof Error ? error.message : String(error)}`,
      {
        messageId: trimmedId,
        statusCode,
        cause: error,
      },
    );
  }
}
