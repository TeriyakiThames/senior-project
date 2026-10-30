export interface MockAlarm {
  id: string;
  time: string;
  label: string;
  recurrence: string;
  enabled: boolean;
}

export interface MockReminder {
  id: string;
  message: string;
  status: 'pending' | 'snoozed' | 'done';
  nextFireAt: string;
  scheduledAt?: string;
  recurrence?: string;
}

export interface MockNote {
  id: string;
  summary: string;
  content: string;
  source: 'text' | 'voice';
  createdAt: string;
}

export interface MockStore {
  alarms: MockAlarm[];
  reminders: MockReminder[];
  notes: MockNote[];
}

function getDefaultMockStore(): MockStore {
  const now = new Date();
  const nextHour = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    alarms: [
      {
        id: 'mock-alarm-1',
        time: '07:00',
        label: 'Alarm 1',
        recurrence: 'daily',
        enabled: true,
      },
      {
        id: 'mock-alarm-2',
        time: '12:30',
        label: 'Alarm 2',
        recurrence: 'once',
        enabled: true,
      },
    ],
    reminders: [
      {
        id: 'mock-reminder-1',
        message: 'โทรหาลูกหลาน',
        status: 'snoozed',
        scheduledAt: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          14,
          30,
        ).toISOString(),
        nextFireAt: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          14,
          45,
        ).toISOString(),
        recurrence: 'once',
      },
      {
        id: 'mock-reminder-2',
        message: 'กินยาความดัน มื้อเย็น',
        status: 'pending',
        scheduledAt: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          20,
          0,
        ).toISOString(),
        nextFireAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0).toISOString(),
        recurrence: 'daily',
      },
      {
        id: 'mock-reminder-3',
        message: 'กินยาความดัน มื้อเช้า',
        status: 'pending',
        scheduledAt: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
          8,
          30,
        ).toISOString(),
        nextFireAt: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
          8,
          30,
        ).toISOString(),
        recurrence: 'daily',
      },
      {
        id: 'mock-reminder-4',
        message: 'ไปตรวจเลือด\nงดอาหารตั้งแต่สองทุ่มคืนก่อน',
        status: 'pending',
        scheduledAt: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 3,
          7,
          0,
        ).toISOString(),
        nextFireAt: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 3,
          7,
          0,
        ).toISOString(),
        recurrence: 'once',
      },
    ],
    notes: [
      {
        id: 'mock-note-1',
        summary: 'Note 1',
        content: 'Note 1 content',
        source: 'text',
        createdAt: now.toISOString(),
      },
      {
        id: 'mock-note-2',
        summary: 'Note 2',
        content: 'Note 2 content',
        source: 'voice',
        createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };
}

let mockStore: MockStore = getDefaultMockStore();

export function getMockItems(type: string = 'all'): Record<string, unknown[]> {
  const result: Record<string, unknown[]> = {};
  if (type === 'alarms' || type === 'all') {
    result.alarms = mockStore.alarms.filter((a) => a.enabled);
  }
  if (type === 'reminders' || type === 'all') {
    result.reminders = mockStore.reminders.filter(
      (r) => r.status === 'pending' || r.status === 'snoozed',
    );
  }
  if (type === 'notes' || type === 'all') {
    result.notes = [...mockStore.notes];
  }
  return result;
}

export function deleteMockItem(id: string, type: string): boolean {
  if (type === 'alarm') {
    const item = mockStore.alarms.find((a) => a.id === id);
    if (!item) return false;
    item.enabled = false;
    return true;
  }
  if (type === 'reminder') {
    const item = mockStore.reminders.find((r) => r.id === id);
    if (!item) return false;
    item.status = 'done';
    return true;
  }
  if (type === 'note') {
    const initialLen = mockStore.notes.length;
    mockStore.notes = mockStore.notes.filter((n) => n.id !== id);
    return mockStore.notes.length < initialLen;
  }
  return false;
}

export function resetMockStore(): void {
  mockStore = getDefaultMockStore();
}
