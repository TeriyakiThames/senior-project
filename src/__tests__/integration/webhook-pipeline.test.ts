import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { webhook } from '@line/bot-sdk';
import { processWebhookEvents } from '@/lib/line/dispatcher';
import { lineClient } from '@/lib/line/client';
import * as jev from '@/lib/ai/jev';
import * as gemini from '@/lib/ai/gemini';
import * as extractor from '@/lib/ai/parameter-extractor';
import * as collections from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';
import { createBangkokDate } from '@/lib/utils/recurrence';

const { mockCreateTask, mockDeleteTask, mockQueuePath } = vi.hoisted(() => ({
  mockCreateTask: vi.fn().mockResolvedValue([{ name: 'projects/test/queues/q/tasks/mock-task-1' }]),
  mockDeleteTask: vi.fn().mockResolvedValue([{}]),
  mockQueuePath: vi.fn(() => 'projects/test/queues/q'),
}));

/**
 * In-memory data store mimicking Firestore state for the integration tests.
 */
class InMemoryDatabase {
  users = new Map<string, any>();
  messages = new Map<string, any[]>();
  alarms = new Map<string, Map<string, any>>();
  reminders = new Map<string, Map<string, any>>();
  notes = new Map<string, Map<string, any>>();
  pendingActions = new Map<string, Map<string, any>>();

  reset() {
    this.users.clear();
    this.messages.clear();
    this.alarms.clear();
    this.reminders.clear();
    this.notes.clear();
    this.pendingActions.clear();
  }

  getMessages(uid: string) {
    if (!this.messages.has(uid)) this.messages.set(uid, []);
    return this.messages.get(uid)!;
  }

  getAlarms(uid: string) {
    if (!this.alarms.has(uid)) this.alarms.set(uid, new Map());
    return this.alarms.get(uid)!;
  }

  getReminders(uid: string) {
    if (!this.reminders.has(uid)) this.reminders.set(uid, new Map());
    return this.reminders.get(uid)!;
  }

  getNotes(uid: string) {
    if (!this.notes.has(uid)) this.notes.set(uid, new Map());
    return this.notes.get(uid)!;
  }

  getPendingActions(uid: string) {
    if (!this.pendingActions.has(uid)) this.pendingActions.set(uid, new Map());
    return this.pendingActions.get(uid)!;
  }
}

const inMemoryDb = new InMemoryDatabase();

// 1. Mock external LINE Messaging SDK
vi.mock('@/lib/line/client', () => ({
  lineClient: {
    replyMessage: vi.fn().mockResolvedValue({}),
    showLoadingAnimation: vi.fn().mockResolvedValue({}),
    getProfile: vi.fn().mockImplementation((uid: string) =>
      Promise.resolve({
        userId: uid,
        displayName: 'คุณยายสมศรี',
      }),
    ),
  },
}));

// 2. Mock external Google Cloud Tasks SDK
vi.mock('@google-cloud/tasks', () => {
  return {
    CloudTasksClient: vi.fn().mockImplementation(() => ({
      createTask: mockCreateTask,
      deleteTask: mockDeleteTask,
      queuePath: mockQueuePath,
    })),
  };
});

// 3. Mock external AI SDKs (Gemini & TypeSafe AI Jev)
vi.mock('@/lib/ai/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/gemini')>();
  return {
    ...actual,
    generateResponse: vi.fn(),
    summarizeNote: vi.fn(),
    generateDailySummary: vi.fn(),
    geminiClient: {
      interactions: {
        create: vi.fn().mockResolvedValue({ id: 'mock-id', output_text: '[]' }),
      },
      models: {
        generateContent: vi.fn().mockResolvedValue({ text: '[]' }),
      },
    },
  };
});

vi.mock('@/lib/ai/jev', () => ({
  classifyIntent: vi.fn(),
}));

vi.mock('@/lib/ai/parameter-extractor', () => ({
  extractAlarmParams: vi.fn(),
  extractReminderParams: vi.fn(),
}));

// 4. Mock Firestore collections with real in-memory state persistence
vi.mock('@/lib/firebase/collections', () => {
  return {
    getOrCreateUser: vi.fn(async (uid: string, displayName: string) => {
      let user = inMemoryDb.users.get(uid);
      if (!user) {
        user = {
          lineUserId: uid,
          displayName,
          language: 'th',
          timezone: 'Asia/Bangkok',
          firebaseUid: 'mock-fb-uid',
          profile: { facts: ['ชอบกินส้มโอ', 'particle:ค่ะ'] },
          createdAt: Timestamp.now(),
        };
        inMemoryDb.users.set(uid, user);
      }
      return user;
    }),

    userRef: vi.fn((uid: string) => ({
      get: vi.fn().mockImplementation(async () => {
        const user = inMemoryDb.users.get(uid);
        return {
          exists: !!user,
          data: () => user,
        };
      }),
      set: vi.fn().mockImplementation(async (data: any) => {
        inMemoryDb.users.set(uid, data);
      }),
      update: vi.fn().mockImplementation(async (changes: any) => {
        const current = inMemoryDb.users.get(uid) ?? {};
        inMemoryDb.users.set(uid, { ...current, ...changes });
      }),
      collection: vi.fn((_sub: string) => ({
        doc: vi.fn((_docId: string) => ({
          get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
        })),
      })),
    })),

    getRecentMessages: vi.fn(async (uid: string, limit = 10) => {
      const msgs = inMemoryDb.getMessages(uid);
      return msgs.slice(-limit);
    }),

    saveMessages: vi.fn(async (uid: string, userMsg: string, assistantMsg: string) => {
      const msgs = inMemoryDb.getMessages(uid);
      msgs.push({ role: 'user', content: userMsg, timestamp: Timestamp.now() });
      msgs.push({ role: 'assistant', content: assistantMsg, timestamp: Timestamp.now() });
    }),

    messagesRef: vi.fn((uid: string) => ({
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockImplementation(async () => {
        const msgs = inMemoryDb.getMessages(uid);
        return {
          docs: msgs.map((m) => ({ data: () => m })),
        };
      }),
    })),

    alarmsRef: vi.fn((uid: string) => ({
      add: vi.fn(async (data: any) => {
        const docId = `alarm-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        inMemoryDb.getAlarms(uid).set(docId, { ...data });
        return {
          id: docId,
          update: vi.fn(async (changes: any) => {
            const current = inMemoryDb.getAlarms(uid).get(docId);
            inMemoryDb.getAlarms(uid).set(docId, { ...current, ...changes });
          }),
          delete: vi.fn(async () => {
            inMemoryDb.getAlarms(uid).delete(docId);
          }),
        };
      }),
    })),

    remindersRef: vi.fn((uid: string) => ({
      add: vi.fn(async (data: any) => {
        const docId = `reminder-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        inMemoryDb.getReminders(uid).set(docId, { ...data });
        return {
          id: docId,
          update: vi.fn(async (changes: any) => {
            const current = inMemoryDb.getReminders(uid).get(docId);
            inMemoryDb.getReminders(uid).set(docId, { ...current, ...changes });
          }),
          delete: vi.fn(async () => {
            inMemoryDb.getReminders(uid).delete(docId);
          }),
        };
      }),
    })),

    notesRef: vi.fn((uid: string) => ({
      add: vi.fn(async (data: any) => {
        const docId = `note-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        inMemoryDb.getNotes(uid).set(docId, { ...data });
        return {
          id: docId,
          update: vi.fn(async (changes: any) => {
            const current = inMemoryDb.getNotes(uid).get(docId);
            inMemoryDb.getNotes(uid).set(docId, { ...current, ...changes });
          }),
          delete: vi.fn(async () => {
            inMemoryDb.getNotes(uid).delete(docId);
          }),
        };
      }),
    })),

    pendingActionsRef: vi.fn((uid: string) => ({
      doc: vi.fn((docId: string) => ({
        get: vi.fn(async () => {
          const action = inMemoryDb.getPendingActions(uid).get(docId);
          return {
            exists: !!action,
            data: () => action,
          };
        }),
        set: vi.fn(async (data: any) => {
          inMemoryDb.getPendingActions(uid).set(docId, { ...data });
        }),
        delete: vi.fn(async () => {
          inMemoryDb.getPendingActions(uid).delete(docId);
        }),
      })),
    })),
  };
});

describe('Webhook Pipeline Integration Suite', () => {
  const TEST_USER_ID = 'U_INTEGRATION_TEST_ELDER_001';

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateTask.mockResolvedValue([{ name: 'projects/test/queues/q/tasks/mock-task-1' }]);
    inMemoryDb.reset();
  });

  function createFakeLineMessageEvent(
    text: string,
    replyToken = 'reply-token-test',
  ): webhook.Event {
    return {
      type: 'message',
      mode: 'active',
      timestamp: Date.now(),
      source: {
        type: 'user',
        userId: TEST_USER_ID,
      },
      webhookEventId: `event-${Date.now()}`,
      deliveryContext: { isRedelivery: false },
      replyToken,
      message: {
        id: `msg-${Date.now()}`,
        type: 'text',
        text,
      },
    } as unknown as webhook.Event;
  }

  it('Flow 1: Alarm creation pipeline (user, memory, intent, tool, reply, history save)', async () => {
    // Mock intent classification & conversational reply
    vi.mocked(jev.classifyIntent).mockResolvedValue({
      intent: 'set_alarm',
      confidence: 0.96,
      isAmbiguous: false,
    });
    vi.mocked(gemini.generateResponse).mockResolvedValue({
      responseText: 'ได้เลยค่ะ เดี๋ยวหนูตั้งเวลาปลุก 7 โมงเช้าให้นะคะ',
    });
    vi.mocked(extractor.extractAlarmParams).mockResolvedValue({
      time: '07:00',
      label: 'ตื่นนอน',
      recurrence: 'daily',
    });

    const event = createFakeLineMessageEvent('ช่วยตั้งปลุก 7 โมงเช้าทุกวันหน่อยจ้ะ', 'token-alarm');
    await processWebhookEvents([event]);

    // 1. User & Memory verification
    expect(collections.getOrCreateUser).toHaveBeenCalledWith(TEST_USER_ID, 'คุณยายสมศรี');
    expect(inMemoryDb.users.has(TEST_USER_ID)).toBe(true);

    // 2. Cloud Task scheduling verification via real scheduleNotification calling CloudTasksClient
    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({
          httpRequest: expect.objectContaining({
            body: expect.any(String),
          }),
        }),
      }),
    );

    // 3. Document persistence in Firestore
    const userAlarms = inMemoryDb.getAlarms(TEST_USER_ID);
    expect(userAlarms.size).toBe(1);
    const createdAlarm = Array.from(userAlarms.values())[0];
    expect(createdAlarm.time).toBe('07:00');
    expect(createdAlarm.label).toBe('ตื่นนอน');
    expect(createdAlarm.recurrence).toBe('daily');
    expect(createdAlarm.cloudTaskName).toBe('projects/test/queues/q/tasks/mock-task-1');

    // 4. LINE Reply verification: primary message + contextual suggestion chat bubble
    expect(lineClient.replyMessage).toHaveBeenCalledWith({
      replyToken: 'token-alarm',
      messages: [
        {
          type: 'text',
          text: 'ตั้งปลุก "ตื่นนอน" เวลา 07:00 น. เรียบร้อยแล้วค่ะ',
        },
        {
          type: 'text',
          text: 'นอกจากนี้ หนูยังช่วยตั้งเตือนความจำ (เช่น เตือนกินยา) หรือช่วยจดบันทึกข้อความให้ได้ด้วยนะคะ บอกหนูได้ตลอดเวลาเลยนะคะ',
        },
      ],
    });

    // 5. History save verification
    const messages = inMemoryDb.getMessages(TEST_USER_ID);
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('ช่วยตั้งปลุก 7 โมงเช้าทุกวันหน่อยจ้ะ');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].content).toContain('ตั้งปลุก "ตื่นนอน" เวลา 07:00 น. เรียบร้อยแล้วค่ะ');
  });

  it('Flow 2: Reminder multi-turn creation pipeline with datetime picker and confirmation', async () => {
    // --- Turn 1: Reminder Request (produces pre-confirmation card + suggestions) ---
    vi.mocked(jev.classifyIntent).mockResolvedValue({
      intent: 'set_reminder',
      confidence: 0.94,
      isAmbiguous: false,
    });
    vi.mocked(gemini.generateResponse).mockResolvedValue({
      responseText: 'รับทราบค่ะคุณยาย เดี๋ยวหนูเตือนกินยาให้นะคะ',
    });

    const fireDate = createBangkokDate(2026, 10, 26, 19, 0, 0);
    vi.mocked(extractor.extractReminderParams).mockResolvedValue({
      message: 'กินยาความดันหลังอาหาร',
      scheduledAt: fireDate.toISOString(),
      recurrence: 'once',
    });

    const event = createFakeLineMessageEvent('เตือนกินยาความดันตอน 1 ทุ่มด้วยนะ', 'token-reminder');
    await processWebhookEvents([event]);

    // 1. Cloud Task scheduling NOT yet executed
    expect(mockCreateTask).not.toHaveBeenCalled();

    // 2. Pending action draft saved in Firestore
    const pendingActions = inMemoryDb.getPendingActions(TEST_USER_ID);
    const currentAction = pendingActions.get('current');
    expect(currentAction).toBeDefined();
    expect(currentAction.type).toBe('confirm_reminder');
    expect(currentAction.data.message).toBe('กินยาความดันหลังอาหาร');

    // 3. Document persistence in Firestore reminders collection is NOT yet committed
    expect(inMemoryDb.getReminders(TEST_USER_ID).size).toBe(0);

    // 4. LINE Reply verification: Flex Message with confirmation card + suggestion bubble underneath
    expect(lineClient.replyMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        replyToken: 'token-reminder',
        messages: [
          expect.objectContaining({
            type: 'flex',
            altText: expect.stringContaining('ยืนยันเตือน: กินยาความดันหลังอาหาร'),
          }),
          {
            type: 'text',
            text: 'นอกจากนี้ หนูยังช่วยจดบันทึกข้อความ (เช่น จดเรื่องสำคัญ) หรือตั้งนาฬิกาปลุกให้ได้ด้วยนะคะ บอกหนูได้ตลอดเวลาเลยนะคะ',
          },
        ],
      }),
    );

    // --- Turn 2: User changes time via native datetimepicker postback ---
    const postbackChangeEvent = {
      type: 'postback',
      replyToken: 'token-reminder-postback',
      source: { type: 'user', userId: TEST_USER_ID },
      postback: {
        data: 'action=change_reminder_time',
        params: { datetime: '2026-10-26T20:00' },
      },
    } as unknown as webhook.Event;

    await processWebhookEvents([postbackChangeEvent]);

    // Verify pending draft time was updated
    const updatedPending = inMemoryDb.getPendingActions(TEST_USER_ID).get('current');
    expect(updatedPending.data.scheduledAt).toContain('2026-10-26');

    // Verify updated Flex Message card was sent to LINE
    expect(lineClient.replyMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        replyToken: 'token-reminder-postback',
        messages: [
          expect.objectContaining({
            type: 'flex',
            altText: expect.stringContaining('20:00 น.'),
          }),
        ],
      }),
    );

    // --- Turn 3: User confirms reminder ("ยืนยันเตือน") ---
    const confirmEvent = createFakeLineMessageEvent('ยืนยันเตือน', 'token-reminder-confirm');
    await processWebhookEvents([confirmEvent]);

    // 5. Cloud Task scheduling verification via real scheduleNotification
    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({
          httpRequest: expect.objectContaining({
            body: expect.any(String),
          }),
        }),
      }),
    );

    // 6. Document persistence in Firestore reminders collection
    const userReminders = inMemoryDb.getReminders(TEST_USER_ID);
    expect(userReminders.size).toBe(1);
    const createdReminder = Array.from(userReminders.values())[0];
    expect(createdReminder.message).toBe('กินยาความดันหลังอาหาร');
    expect(createdReminder.status).toBe('pending');
    expect(createdReminder.cloudTaskName).toBe('projects/test/queues/q/tasks/mock-task-1');

    // 7. Pending action draft was cleared
    expect(inMemoryDb.getPendingActions(TEST_USER_ID).has('current')).toBe(false);

    // 8. LINE Reply verification: confirmed message + suggestion bubble
    expect(lineClient.replyMessage).toHaveBeenCalledWith({
      replyToken: 'token-reminder-confirm',
      messages: [
        {
          type: 'text',
          text: 'ตั้งเตือน "กินยาความดันหลังอาหาร" เวลา 20:00 น. เรียบร้อยแล้วค่ะ',
        },
        {
          type: 'text',
          text: 'หากต้องการให้หนูช่วยจดบันทึกข้อความ หรือตั้งนาฬิกาปลุก บอกหนูได้ตลอดเวลาเลยนะคะ',
        },
      ],
    });

    // 9. Conversation history save
    const messages = inMemoryDb.getMessages(TEST_USER_ID);
    expect(messages.length).toBe(6);
    expect(messages[0].content).toBe('เตือนกินยาความดันตอน 1 ทุ่มด้วยนะ');
    expect(messages[1].content).toContain('ยืนยันเตือน: กินยาความดันหลังอาหาร');
    expect(messages[2].content).toContain('เปลี่ยนเวลาเป็น 2026-10-26T20:00');
    expect(messages[3].content).toContain('20:00 น.');
    expect(messages[4].content).toBe('ยืนยันเตือน');
    expect(messages[5].content).toContain('ตั้งเตือน "กินยาความดันหลังอาหาร" เวลา 20:00 น.');
  });

  it('Flow 3: Note capture & confirmation multi-turn pipeline', async () => {
    // --- Turn 1: Note Draft Capture (produces draft flex card + suggestion bubble) ---
    vi.mocked(jev.classifyIntent).mockResolvedValue({
      intent: 'save_note',
      confidence: 0.92,
      isAmbiguous: false,
    });
    vi.mocked(gemini.generateResponse).mockResolvedValue({
      responseText: 'ได้เลยค่ะคุณยาย เดี๋ยวหนูช่วยบันทึกให้นะคะ',
    });
    vi.mocked(gemini.summarizeNote).mockResolvedValue('หมอนัดวันพุธหน้า เวลา 9 โมงเช้า');

    const draftEvent = createFakeLineMessageEvent(
      'ช่วยจำว่าหมอนัดวันพุธหน้า เวลา 9 โมงเช้า',
      'token-note-draft',
    );
    await processWebhookEvents([draftEvent]);

    // Verify pending action was saved in Firestore
    const pendingActions = inMemoryDb.getPendingActions(TEST_USER_ID);
    const currentAction = pendingActions.get('current');
    expect(currentAction).toBeDefined();
    expect(currentAction.type).toBe('confirm_note');
    expect(currentAction.data.summary).toBe('หมอนัดวันพุธหน้า เวลา 9 โมงเช้า');

    // Verify notes collection is still empty (not confirmed yet)
    expect(inMemoryDb.getNotes(TEST_USER_ID).size).toBe(0);

    // Verify Flex Message confirmation card + suggestion bubble sent to LINE
    expect(lineClient.replyMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        replyToken: 'token-note-draft',
        messages: [
          expect.objectContaining({
            type: 'flex',
            altText: expect.stringContaining('หมอนัดวันพุธหน้า'),
          }),
          {
            type: 'text',
            text: 'หนูยังช่วยตั้งเตือนความจำ (เช่น เตือนกินยา) หรือตั้งนาฬิกาปลุกให้ได้ด้วยนะคะ อยากให้หนูช่วยตั้งเตือนหรือตั้งนาฬิกาปลุกเรื่องนี้ด้วยไหมคะ',
          },
        ],
      }),
    );

    // --- Turn 2: User Confirms ("บันทึกเลย") ---
    const confirmEvent = createFakeLineMessageEvent('บันทึกเลย', 'token-note-confirm');
    await processWebhookEvents([confirmEvent]);

    // Verify pending action was cleared from Firestore
    expect(inMemoryDb.getPendingActions(TEST_USER_ID).has('current')).toBe(false);

    // Verify note is now permanently committed to Firestore notes collection
    const userNotes = inMemoryDb.getNotes(TEST_USER_ID);
    expect(userNotes.size).toBe(1);
    const confirmedNote = Array.from(userNotes.values())[0];
    expect(confirmedNote.summary).toBe('หมอนัดวันพุธหน้า เวลา 9 โมงเช้า');

    // Verify LINE received confirmation reply + suggestion bubble
    expect(lineClient.replyMessage).toHaveBeenCalledWith({
      replyToken: 'token-note-confirm',
      messages: [
        {
          type: 'text',
          text: 'บันทึกโน้ตเรียบร้อยแล้วค่ะ คุณตาคุณยาย',
        },
        {
          type: 'text',
          text: 'หากต้องการให้หนูช่วยตั้งเตือนความจำ หรือตั้งนาฬิกาปลุก บอกหนูได้ตลอดเวลาเลยนะคะ',
        },
      ],
    });

    // Verify complete multi-turn conversation history in Firestore
    const messages = inMemoryDb.getMessages(TEST_USER_ID);
    expect(messages.length).toBe(4);
    expect(messages[0].content).toBe('ช่วยจำว่าหมอนัดวันพุธหน้า เวลา 9 โมงเช้า');
    expect(messages[1].content).toContain('หมอนัดวันพุธหน้า');
    expect(messages[2].content).toBe('บันทึกเลย');
    expect(messages[3].content).toBe('บันทึกโน้ตเรียบร้อยแล้วค่ะ คุณตาคุณยาย');
  });

  it('Flow 4: Elder chit-chat conversation pipeline', async () => {
    vi.mocked(jev.classifyIntent).mockResolvedValue({
      intent: 'general_chat',
      confidence: 0.98,
      isAmbiguous: false,
    });
    vi.mocked(gemini.generateResponse).mockResolvedValue({
      responseText: 'สวัสดีค่ะคุณยาย วันนี้อากาศดีนะคะ คุณยายทานข้าวหรือยังคะ',
    });

    const event = createFakeLineMessageEvent('สวัสดีจ้ะ สบายดีไหม', 'token-chat');
    await processWebhookEvents([event]);

    // Verify intent was classified as general chat
    expect(jev.classifyIntent).toHaveBeenCalled();

    // Verify no schedule or document was created
    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(inMemoryDb.getAlarms(TEST_USER_ID).size).toBe(0);
    expect(inMemoryDb.getReminders(TEST_USER_ID).size).toBe(0);
    expect(inMemoryDb.getNotes(TEST_USER_ID).size).toBe(0);

    // Verify LINE reply sent conversational response
    expect(lineClient.replyMessage).toHaveBeenCalledWith({
      replyToken: 'token-chat',
      messages: [
        {
          type: 'text',
          text: 'สวัสดีค่ะคุณยาย วันนี้อากาศดีนะคะ คุณยายทานข้าวหรือยังคะ',
        },
      ],
    });

    // Verify history recorded
    const messages = inMemoryDb.getMessages(TEST_USER_ID);
    expect(messages.length).toBe(2);
    expect(messages[0].content).toBe('สวัสดีจ้ะ สบายดีไหม');
    expect(messages[1].content).toBe('สวัสดีค่ะคุณยาย วันนี้อากาศดีนะคะ คุณยายทานข้าวหรือยังคะ');
  });
});
