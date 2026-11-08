import { AppError } from './errors';

/**
 * Validates that an ID is a safe, non-empty Firestore document identifier.
 * Strictly prevents path traversal, slash injection, directory climbing, and reserved names.
 *
 * @param id The document ID candidate
 * @returns boolean indicating whether the ID is safe
 */
export function isValidDocumentId(id: unknown): id is string {
  if (typeof id !== 'string') {
    return false;
  }
  const trimmed = id.trim();
  if (trimmed.length === 0 || trimmed.length > 128) {
    return false;
  }
  // Disallow forward slash and backslash (crucial: stops Firestore subcollection path traversal)
  if (trimmed.includes('/') || trimmed.includes('\\')) {
    return false;
  }
  // Disallow '.' and '..' (directory traversal)
  if (trimmed === '.' || trimmed === '..') {
    return false;
  }
  // Disallow Firestore reserved metadata identifiers __.*__
  if (/^__.*__$/.test(trimmed)) {
    return false;
  }
  // Must consist only of alphanumeric, underscore, hyphen, colon, or dot
  return /^[a-zA-Z0-9_\-.:]+$/.test(trimmed);
}

/**
 * Asserts that an ID is valid, throwing an AppError if invalid.
 */
export function assertValidDocumentId(id: unknown, fieldName = 'id'): asserts id is string {
  if (!isValidDocumentId(id)) {
    throw new AppError(
      `Invalid or unsafe ${fieldName}: path traversal or illegal characters detected`,
      'INVALID_DOCUMENT_ID',
    );
  }
}

/**
 * Verifies that the request's Content-Length does not exceed the allowed maximum bytes.
 * Protects against unbounded payloads and Memory Exhaustion / DoS.
 *
 * @param request The incoming Request or NextRequest
 * @param maxBytes Maximum allowable body size in bytes
 * @returns boolean True if within limit, false if exceeds
 */
export function isPayloadSizeWithinLimit(request: Request, maxBytes: number): boolean {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > maxBytes) {
      return false;
    }
  }
  return true;
}
