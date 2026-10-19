import type { PersonaParticles } from '@/lib/ai/persona';

export type ErrorStage = 'stt' | 'ai' | 'tool' | 'network' | 'default';

export type LogSeverity =
  | 'DEFAULT'
  | 'DEBUG'
  | 'INFO'
  | 'NOTICE'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL'
  | 'ALERT'
  | 'EMERGENCY';

export interface StructuredLogRecord {
  severity: LogSeverity;
  stage: string;
  timestamp: string;
  message: string;
  name?: string;
  code?: string;
  stack?: string;
  context?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Standard application error with domain error code and contextual metadata.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Emits a single-line structured JSON record formatted for Google Cloud Logging and Vercel drains.
 */
export function logError(
  stage: string,
  error: unknown,
  context?: Record<string, unknown>,
  severity: LogSeverity = 'ERROR',
): StructuredLogRecord {
  const timestamp = new Date().toISOString();
  let message = 'Unknown error';
  let name = 'Error';
  let stack: string | undefined;
  let code: string | undefined;

  if (error instanceof AppError) {
    message = error.message;
    name = error.name;
    code = error.code;
    stack = error.stack;
  } else if (error instanceof Error) {
    message = error.message;
    name = error.name;
    stack = error.stack;
    if ('code' in error && typeof (error as { code: unknown }).code === 'string') {
      code = (error as { code: string }).code;
    }
  } else if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    try {
      message = JSON.stringify(error);
    } catch {
      message = String(error);
    }
  }

  const logRecord: StructuredLogRecord = {
    severity,
    stage,
    timestamp,
    message,
    name,
    ...(code ? { code } : {}),
    ...(stack ? { stack } : {}),
    ...(context ? { context } : {}),
  };

  const serialized = JSON.stringify(logRecord);
  if (
    severity === 'WARNING' ||
    severity === 'INFO' ||
    severity === 'NOTICE' ||
    severity === 'DEBUG'
  ) {
    console.warn(serialized);
  } else {
    console.error(serialized);
  }

  return logRecord;
}

/**
 * Resolves a warm, jargon-free, polite fallback message adapted to the user's language and persona particles.
 */
export function getFallbackMessage(
  stage: ErrorStage | string,
  language = 'th',
  particles?: PersonaParticles,
): string {
  const isEn = language.toLowerCase().startsWith('en');

  if (isEn) {
    switch (stage) {
      case 'stt':
        return "Sorry, I couldn't understand the audio clearly. Please try saying it again or type a message instead 🙏";
      case 'ai':
        return "I'm sorry, I didn't quite understand that. Could you please say or type it again? 🙏";
      case 'tool':
        return "Sorry, I wasn't able to complete that request right now. Please try again in a moment 🙏";
      case 'network':
        return "The connection is temporarily interrupted. Please don't worry, let's try again in a moment 🙏";
      case 'default':
      default:
        return 'Something went wrong temporarily. Please try again in a moment 🙏';
    }
  }

  // Thai persona fallback
  const affirmative = particles?.affirmative ?? 'ค่ะ';

  if (affirmative === 'จ้ะ') {
    switch (stage) {
      case 'stt':
        return 'ขออภัยจ้ะ ฟังเสียงไม่ชัดเจน ลองพูดใหม่อีกทีนะจ๊ะ หรือพิมพ์บอกแทนได้เลยจ้ะ 🙏';
      case 'ai':
        return 'ขอโทษด้วยจ้ะ ยังไม่ค่อยเข้าใจคำสั่งนี้ ลองบอกใหม่อีกครั้งได้ไหมจ๊ะ 🙏';
      case 'tool':
        return 'ขออภัยจ้ะ ดำเนินการไม่สำเร็จในตอนนี้ ลองใหม่อีกครั้งนะจ๊ะ 🙏';
      case 'network':
        return 'สัญญาณเชื่อมต่อติดขัดชั่วคราว ไม่ต้องกังวลนะจ๊ะ เดี๋ยวลองใหม่อีกทีจ้ะ 🙏';
      case 'default':
      default:
        return 'ระบบขัดข้องชั่วคราว ขออภัยด้วยนะจ๊ะ ลองใหม่อีกครั้งนะจ๊ะ 🙏';
    }
  }

  if (affirmative === 'ครับ') {
    switch (stage) {
      case 'stt':
        return 'ขออภัยครับ ฟังเสียงไม่ชัดเจน ลองพูดใหม่อีกทีนะครับ หรือพิมพ์บอกแทนได้เลยครับ 🙏';
      case 'ai':
        return 'ขอโทษด้วยครับ ยังไม่ค่อยเข้าใจคำสั่งนี้ ลองบอกใหม่อีกครั้งได้ไหมครับ 🙏';
      case 'tool':
        return 'ขออภัยครับ ดำเนินการไม่สำเร็จในตอนนี้ ลองใหม่อีกครั้งนะครับ 🙏';
      case 'network':
        return 'สัญญาณเชื่อมต่อติดขัดชั่วคราว ไม่ต้องกังวลนะครับ เดี๋ยวลองใหม่อีกทีครับ 🙏';
      case 'default':
      default:
        return 'ระบบขัดข้องชั่วคราว ขออภัยด้วยนะครับ ลองใหม่อีกครั้งนะครับ 🙏';
    }
  }

  // Default polite female particles (ค่ะ / นะคะ)
  switch (stage) {
    case 'stt':
      return 'ขออภัยค่ะ ฟังเสียงไม่ชัดเจน ลองพูดใหม่อีกทีนะคะ หรือพิมพ์บอกแทนได้เลยค่ะ 🙏';
    case 'ai':
      return 'ขอโทษด้วยค่ะ ยังไม่ค่อยเข้าใจคำสั่งนี้ ลองบอกใหม่อีกครั้งได้ไหมคะ 🙏';
    case 'tool':
      return 'ขออภัยค่ะ ดำเนินการไม่สำเร็จในตอนนี้ ลองใหม่อีกครั้งนะคะ 🙏';
    case 'network':
      return 'สัญญาณเชื่อมต่อติดขัดชั่วคราว ไม่ต้องกังวลนะคะ เดี๋ยวลองใหม่อีกทีค่ะ 🙏';
    case 'default':
    default:
      return 'ระบบขัดข้องชั่วคราว ขออภัยด้วยนะคะ ลองใหม่อีกครั้งนะคะ 🙏';
  }
}
