import { describe, it, expect } from 'vitest';
import {
  isValidDocumentId,
  assertValidDocumentId,
  isPayloadSizeWithinLimit,
  readBoundedBuffer,
} from '@/lib/utils/security';
import { AppError } from '@/lib/utils/errors';

describe('Security Utilities (security.ts)', () => {
  describe('isValidDocumentId', () => {
    it('accepts valid LINE user IDs, UIDs, and alphanumeric IDs', () => {
      expect(isValidDocumentId('U1234567890abcdef1234567890abcdef')).toBe(true);
      expect(isValidDocumentId('user-123')).toBe(true);
      expect(isValidDocumentId('mock-user-123')).toBe(true);
      expect(isValidDocumentId('alarm_item_999')).toBe(true);
      expect(isValidDocumentId('doc.with.dots')).toBe(true);
      expect(isValidDocumentId('item:colon:id')).toBe(true);
    });

    it('rejects path traversal and directory climbing attempts', () => {
      expect(isValidDocumentId('../../victim')).toBe(false);
      expect(isValidDocumentId('../notes')).toBe(false);
      expect(isValidDocumentId('..')).toBe(false);
      expect(isValidDocumentId('.')).toBe(false);
      expect(isValidDocumentId('item/../../other')).toBe(false);
    });

    it('rejects forward slashes and backslashes', () => {
      expect(isValidDocumentId('user/notes')).toBe(false);
      expect(isValidDocumentId('/root/doc')).toBe(false);
      expect(isValidDocumentId('user\\notes')).toBe(false);
      expect(isValidDocumentId('trailing/')).toBe(false);
    });

    it('rejects Firestore reserved identifiers matching __.*__', () => {
      expect(isValidDocumentId('__reserved__')).toBe(false);
      expect(isValidDocumentId('__metadata__')).toBe(false);
    });

    it('rejects empty, whitespace-only, and oversized strings', () => {
      expect(isValidDocumentId('')).toBe(false);
      expect(isValidDocumentId('   ')).toBe(false);
      expect(isValidDocumentId('a'.repeat(129))).toBe(false);
      expect(isValidDocumentId('a'.repeat(128))).toBe(true);
    });

    it('rejects non-string types safely', () => {
      expect(isValidDocumentId(null)).toBe(false);
      expect(isValidDocumentId(undefined)).toBe(false);
      expect(isValidDocumentId(12345)).toBe(false);
      expect(isValidDocumentId({})).toBe(false);
      expect(isValidDocumentId([])).toBe(false);
    });
  });

  describe('assertValidDocumentId', () => {
    it('does not throw when ID is valid', () => {
      expect(() => assertValidDocumentId('valid-user-id')).not.toThrow();
    });

    it('throws AppError with code INVALID_DOCUMENT_ID when ID is unsafe', () => {
      expect(() => assertValidDocumentId('../../dangerous/path', 'userId')).toThrow(AppError);
      try {
        assertValidDocumentId('bad/path', 'testId');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).code).toBe('INVALID_DOCUMENT_ID');
      }
    });
  });

  describe('isPayloadSizeWithinLimit', () => {
    it('returns true when Content-Length is within allowable limit', () => {
      const req = new Request('http://localhost', {
        headers: { 'content-length': '1024' },
      });
      expect(isPayloadSizeWithinLimit(req, 2048)).toBe(true);
    });

    it('returns false when Content-Length exceeds allowable limit', () => {
      const req = new Request('http://localhost', {
        headers: { 'content-length': '100000000' }, // ~100MB
      });
      expect(isPayloadSizeWithinLimit(req, 512 * 1024)).toBe(false);
    });

    it('returns true when Content-Length header is omitted or malformed', () => {
      const reqWithoutHeader = new Request('http://localhost');
      expect(isPayloadSizeWithinLimit(reqWithoutHeader, 1024)).toBe(true);

      const reqWithMalformed = new Request('http://localhost', {
        headers: { 'content-length': 'invalid-number' },
      });
      expect(isPayloadSizeWithinLimit(reqWithMalformed, 1024)).toBe(true);
    });
  });

  describe('readBoundedBuffer', () => {
    it('reads body buffer when size is within limit', async () => {
      const text = 'hello world';
      const req = new Request('http://localhost', {
        method: 'POST',
        body: text,
      });
      const buffer = await readBoundedBuffer(req, 1024);
      expect(buffer).not.toBeNull();
      expect(buffer?.toString('utf-8')).toBe(text);
    });

    it('returns null if content-length header exceeds limit', async () => {
      const req = new Request('http://localhost', {
        method: 'POST',
        headers: { 'content-length': '2048' },
        body: 'small',
      });
      const buffer = await readBoundedBuffer(req, 1024);
      expect(buffer).toBeNull();
    });

    it('returns null if stream chunks exceed limit', async () => {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(600));
          controller.enqueue(new Uint8Array(600));
          controller.close();
        },
      });
      const req = new Request('http://localhost', {
        method: 'POST',
        body: stream,
        // @ts-expect-error duplex needed for node fetch with stream
        duplex: 'half',
      });
      const buffer = await readBoundedBuffer(req, 1000);
      expect(buffer).toBeNull();
    });
  });
});
