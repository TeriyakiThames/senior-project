import { vi } from 'vitest';
import type { UserDoc, AlarmDoc, ReminderDoc, NoteDoc } from '@/types/firestore';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * ------------------------------------------------------------------
 * 1. LINE Bot SDK Mocks (@line/bot-sdk)
 * ------------------------------------------------------------------
 */
export function createMockLineClient(overrides?: Record<string, any>) {
  return {
    replyMessage: vi.fn().mockResolvedValue({}),
    showLoadingAnimation: vi.fn().mockResolvedValue({}),
    pushMessage: vi.fn().mockResolvedValue({}),
    getProfile: vi.fn().mockResolvedValue({
      userId: 'mock-line-user-id',
      displayName: 'คุณตาใจดี',
      pictureUrl: 'https://example.com/avatar.jpg',
    }),
    getMessageContent: vi.fn().mockResolvedValue(Buffer.from('mock-audio-bytes')),
    createRichMenu: vi.fn().mockResolvedValue('richmenu-mock-id'),
    setDefaultRichMenu: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

export function createMockLineBlobClient(overrides?: Record<string, any>) {
  return {
    getMessageContent: vi.fn().mockResolvedValue(Buffer.from('mock-blob-content')),
    getMessageContentWithHttpInfo: vi.fn().mockResolvedValue({
      data: Buffer.from('mock-blob-content'),
      status: 200,
    }),
    setRichMenuImage: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

/**
 * ------------------------------------------------------------------
 * 2. Firebase Admin & Firestore Mocks (firebase-admin)
 * ------------------------------------------------------------------
 */
export interface MockDocOptions {
  id?: string;
  data?: Record<string, any>;
  exists?: boolean;
}

export function createMockDocRef(options: MockDocOptions = {}) {
  const { id = 'mock-doc-id', data = {}, exists = true } = options;

  const mockSnapshot = {
    id,
    exists,
    data: vi.fn(() => (exists ? data : undefined)),
    ref: {} as any,
  };

  const docRef = {
    id,
    path: `mock-collection/${id}`,
    get: vi.fn().mockResolvedValue(mockSnapshot),
    set: vi.fn().mockResolvedValue({ writeTime: Timestamp.now() }),
    update: vi.fn().mockResolvedValue({ writeTime: Timestamp.now() }),
    delete: vi.fn().mockResolvedValue({ writeTime: Timestamp.now() }),
    collection: vi.fn(),
  };

  mockSnapshot.ref = docRef;
  return docRef;
}

export function createMockQuerySnapshot(
  docsData: Array<{ id: string; data: Record<string, any> }>,
) {
  const docs = docsData.map((d) => ({
    id: d.id,
    exists: true,
    data: () => d.data,
    ref: createMockDocRef({ id: d.id, data: d.data }),
  }));

  return {
    empty: docs.length === 0,
    size: docs.length,
    docs,
    forEach: vi.fn((callback: (doc: any) => void) => docs.forEach(callback)),
  };
}

export function createMockCollectionRef(
  docsData: Array<{ id: string; data: Record<string, any> }> = [],
) {
  const querySnapshot = createMockQuerySnapshot(docsData);

  const query: any = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue(querySnapshot),
    add: vi.fn().mockImplementation((data: any) => {
      const newId = `new-doc-${Date.now()}`;
      return Promise.resolve(createMockDocRef({ id: newId, data }));
    }),
    doc: vi.fn().mockImplementation((docId?: string) => {
      const targetId = docId || `generated-id-${Math.random().toString(36).substring(7)}`;
      const existing = docsData.find((d) => d.id === targetId);
      return createMockDocRef({
        id: targetId,
        data: existing ? existing.data : {},
        exists: !!existing,
      });
    }),
  };

  return query;
}

export function createMockFirestore(
  initialCollections: Record<string, Array<{ id: string; data: Record<string, any> }>> = {},
) {
  const batchOperations: any[] = [];

  const mockBatch = {
    set: vi.fn((ref: any, data: any, options?: any) => {
      batchOperations.push({ type: 'set', ref, data, options });
      return mockBatch;
    }),
    update: vi.fn((ref: any, ...args: any[]) => {
      batchOperations.push({ type: 'update', ref, args });
      return mockBatch;
    }),
    delete: vi.fn((ref: any) => {
      batchOperations.push({ type: 'delete', ref });
      return mockBatch;
    }),
    commit: vi.fn().mockResolvedValue([]),
  };

  const db = {
    collection: vi.fn((name: string) => {
      const data = initialCollections[name] || [];
      return createMockCollectionRef(data);
    }),
    doc: vi.fn((path: string) => {
      const parts = path.split('/');
      const id = parts[parts.length - 1];
      return createMockDocRef({ id });
    }),
    batch: vi.fn(() => mockBatch),
    runTransaction: vi.fn((fn: (transaction: any) => Promise<any>) =>
      fn({
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      }),
    ),
  };

  return { db, mockBatch, batchOperations };
}

/**
 * ------------------------------------------------------------------
 * 3. Google GenAI Mocks (@google/genai)
 * ------------------------------------------------------------------
 */
export function createMockGeminiClient(
  responseText = 'สวัสดีค่ะคุณตา มีอะไรให้หลานช่วยไหมคะ',
  overrides?: Record<string, any>,
) {
  return {
    interactions: {
      create: vi.fn().mockResolvedValue({
        id: 'interaction-mock-123',
        output_text: responseText,
      }),
      ...overrides?.interactions,
    },
    models: {
      generateContent: vi.fn().mockResolvedValue({
        text: responseText,
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 25,
          totalTokenCount: 125,
        },
      }),
      ...overrides?.models,
    },
    ...overrides,
  };
}

/**
 * ------------------------------------------------------------------
 * 4. TypeSafe AI Jev Mocks (@typesafe-ai/sdk)
 * ------------------------------------------------------------------
 */
export function createMockJevClient(
  defaultIntent = 'general_chat',
  ambiguityScore = 0.1,
  probabilities: Record<string, number> = { [defaultIntent]: 0.95 },
  overrides?: Record<string, any>,
) {
  return {
    systemOne: vi.fn().mockResolvedValue({
      model: 'jev-latest',
      answers: {
        intent: {
          type: 'choice',
          choice: defaultIntent,
          confidence: probabilities[defaultIntent] ?? 0.95,
          probabilities,
        },
        is_ambiguous: {
          type: 'noul',
          noul: ambiguityScore,
        },
      },
      usage: { input_tokens: 15, output_tokens: 10 },
      ...overrides?.answers,
    }),
    ...overrides,
  };
}

/**
 * ------------------------------------------------------------------
 * 5. Google Cloud Tasks Mocks (@google-cloud/tasks)
 * ------------------------------------------------------------------
 */
export function createMockCloudTasksClient(overrides?: Record<string, any>) {
  return {
    createTask: vi.fn().mockResolvedValue([
      {
        name: 'projects/mock-project/locations/asia-southeast1/queues/reminder-queue/tasks/mock-task-123',
      },
    ]),
    deleteTask: vi.fn().mockResolvedValue([{}]),
    queuePath: vi.fn(
      (project: string, location: string, queue: string) =>
        `projects/${project}/locations/${location}/queues/${queue}`,
    ),
    ...overrides,
  };
}

/**
 * ------------------------------------------------------------------
 * 6. Google Cloud Speech Mocks (@google-cloud/speech)
 * ------------------------------------------------------------------
 */
export function createMockSpeechClient(
  transcript = 'ปลุก 7 โมงเช้าด้วยนะ',
  overrides?: Record<string, any>,
) {
  return {
    recognize: vi.fn().mockResolvedValue([
      {
        results: [
          {
            alternatives: [
              {
                transcript,
                confidence: 0.98,
              },
            ],
          },
        ],
      },
    ]),
    ...overrides,
  };
}

/**
 * ------------------------------------------------------------------
 * 7. Firestore Document Factories for Tests
 * ------------------------------------------------------------------
 */
export function createMockUserDoc(overrides?: Partial<UserDoc>): UserDoc {
  return {
    lineUserId: 'U12345678',
    displayName: 'คุณยายสมศรี',
    language: 'th',
    timezone: 'Asia/Bangkok',
    firebaseUid: 'uid-mock-123',
    createdAt: Timestamp.now(),
    profile: {
      facts: ['กินยาความดันตอนเช้า', 'particle:ค่ะ'],
      updatedAt: Timestamp.now(),
    },
    dailySummary: {
      date: '2026-10-16',
      summary: 'คุยเรื่องไปโรงพยาบาลศิริราช',
      generatedAt: Timestamp.now(),
    },
    ...overrides,
  };
}

export function createMockAlarmDoc(overrides?: Partial<AlarmDoc>): AlarmDoc {
  return {
    time: '07:00',
    label: 'ตื่นนอน',
    recurrence: 'daily',
    daysOfWeek: [1, 2, 3, 4, 5],
    enabled: true,
    nextFireAt: Timestamp.now(),
    cloudTaskName:
      'projects/mock-project/locations/asia-southeast1/queues/reminder-queue/tasks/mock-alarm-task',
    createdAt: Timestamp.now(),
    ...overrides,
  };
}

export function createMockReminderDoc(overrides?: Partial<ReminderDoc>): ReminderDoc {
  return {
    message: 'กินยาความดันหลังอาหารเช้า',
    scheduledAt: Timestamp.now(),
    recurrence: 'once',
    enabled: true,
    nextFireAt: Timestamp.now(),
    cloudTaskName:
      'projects/mock-project/locations/asia-southeast1/queues/reminder-queue/tasks/mock-reminder-task',
    status: 'pending',
    createdAt: Timestamp.now(),
    ...overrides,
  };
}

export function createMockNoteDoc(overrides?: Partial<NoteDoc>): NoteDoc {
  return {
    content: 'หมอนัดวันที่ 25 ตุลาคมนี้ เวลา 9 โมงเช้า',
    summary: 'หมอนัด 25 ต.ค. เวลา 09:00 น.',
    source: 'voice',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    ...overrides,
  };
}
