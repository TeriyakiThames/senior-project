import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cloudTasksClient,
  getCloudTasksClientOptions,
  scheduleNotification,
  cancelScheduledTask,
  saveAndScheduleTask,
} from '@/lib/scheduler/cloud-tasks';
import { CloudTasksClient } from '@google-cloud/tasks';
import { createMockCloudTasksClient } from '@/__tests__/mocks';

describe('Google Cloud Tasks Scheduling Client (SCHED-01)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe('Client configuration & options', () => {
    it('initializes cloudTasksClient as an instance of CloudTasksClient', () => {
      expect(cloudTasksClient).toBeInstanceOf(CloudTasksClient);
    });

    it('returns empty credentials when GOOGLE_APPLICATION_CREDENTIALS_JSON is unset', () => {
      delete process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
      const options = getCloudTasksClientOptions();
      expect(options.credentials).toBeUndefined();
    });

    it('parses valid GOOGLE_APPLICATION_CREDENTIALS_JSON', () => {
      const mockCreds = {
        client_email: 'tasks-service-account@test.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----',
      };
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = JSON.stringify(mockCreds);

      const options = getCloudTasksClientOptions();
      expect(options.credentials).toEqual(mockCreds);
    });

    it('falls back gracefully when GOOGLE_APPLICATION_CREDENTIALS_JSON is invalid JSON', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON = 'invalid-json';

      const options = getCloudTasksClientOptions();
      expect(options.credentials).toBeUndefined();
    });
  });

  describe('scheduleNotification', () => {
    it('enqueues delayed HTTP POST task with base64 payload and scheduleTime seconds', async () => {
      const fireAt = new Date('2026-10-16T08:00:00.000Z');
      const expectedSeconds = Math.floor(fireAt.getTime() / 1000);

      const mockCreateTask = vi.fn().mockResolvedValue([
        {
          name: 'projects/test-project/locations/asia-southeast1/queues/reminder-queue/tasks/task-123',
        },
      ]);
      const mockQueuePath = vi
        .fn()
        .mockReturnValue('projects/test-project/locations/asia-southeast1/queues/reminder-queue');

      const mockClient = {
        createTask: mockCreateTask,
        queuePath: mockQueuePath,
      } as unknown as CloudTasksClient;

      const taskName = await scheduleNotification({
        userId: 'user-001',
        itemId: 'alarm-001',
        itemType: 'alarm',
        fireAt,
        client: mockClient,
        projectId: 'test-project',
        location: 'asia-southeast1',
        queueId: 'reminder-queue',
        appUrl: 'https://test-app.com',
        webhookSecret: 'secret-xyz',
      });

      expect(taskName).toBe(
        'projects/test-project/locations/asia-southeast1/queues/reminder-queue/tasks/task-123',
      );
      expect(mockQueuePath).toHaveBeenCalledWith(
        'test-project',
        'asia-southeast1',
        'reminder-queue',
      );
      expect(mockCreateTask).toHaveBeenCalledWith({
        parent: 'projects/test-project/locations/asia-southeast1/queues/reminder-queue',
        task: {
          httpRequest: {
            httpMethod: 'POST',
            url: 'https://test-app.com/api/notify',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Secret': 'secret-xyz',
            },
            body: Buffer.from(
              JSON.stringify({ userId: 'user-001', itemId: 'alarm-001', itemType: 'alarm' }),
            ).toString('base64'),
          },
          scheduleTime: {
            seconds: expectedSeconds,
          },
        },
      });
    });

    it('sanitizes trailing slash in appUrl', async () => {
      const fireAt = new Date('2026-10-16T08:00:00.000Z');
      const mockCreateTask = vi.fn().mockResolvedValue([{ name: 'task-1' }]);
      const mockClient = {
        createTask: mockCreateTask,
        queuePath: vi.fn().mockReturnValue('queue-path'),
      } as unknown as CloudTasksClient;

      await scheduleNotification({
        userId: 'user-001',
        itemId: 'rem-001',
        itemType: 'reminder',
        fireAt,
        client: mockClient,
        appUrl: 'https://test-app.com///',
      });

      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.objectContaining({
            httpRequest: expect.objectContaining({
              url: 'https://test-app.com/api/notify',
            }),
          }),
        }),
      );
    });
  });

  describe('saveAndScheduleTask', () => {
    it('saves doc to Firestore, schedules task, updates cloudTaskName, and returns result', async () => {
      const fireAt = new Date('2026-10-16T08:00:00.000Z');
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockDocRef = {
        id: 'doc-123',
        update: mockUpdate,
        delete: mockDelete,
      };

      const mockCollectionRef = {
        add: vi.fn().mockResolvedValue(mockDocRef),
      };

      const mockScheduleFn = vi.fn().mockResolvedValue('projects/test/tasks/task-999');

      const result = await saveAndScheduleTask({
        collectionRef: mockCollectionRef,
        data: { message: 'เตือนกินยา' },
        schedule: {
          userId: 'user-001',
          itemType: 'reminder',
          fireAt,
        },
        scheduleNotificationFn: mockScheduleFn,
      });

      expect(mockCollectionRef.add).toHaveBeenCalledWith({ message: 'เตือนกินยา' });
      expect(mockScheduleFn).toHaveBeenCalledWith({
        userId: 'user-001',
        itemId: 'doc-123',
        itemType: 'reminder',
        fireAt,
        payload: undefined,
      });
      expect(mockUpdate).toHaveBeenCalledWith({ cloudTaskName: 'projects/test/tasks/task-999' });
      expect(mockDelete).not.toHaveBeenCalled();
      expect(result).toEqual({
        docRef: mockDocRef,
        taskName: 'projects/test/tasks/task-999',
      });
    });

    it('rolls back created document by calling docRef.delete() when scheduling throws', async () => {
      const fireAt = new Date('2026-10-16T08:00:00.000Z');
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockDocRef = {
        id: 'doc-rollback-1',
        update: mockUpdate,
        delete: mockDelete,
      };

      const mockCollectionRef = {
        add: vi.fn().mockResolvedValue(mockDocRef),
      };

      const scheduleError = new Error('Cloud Tasks rate limited');
      const mockScheduleFn = vi.fn().mockRejectedValue(scheduleError);

      await expect(
        saveAndScheduleTask({
          collectionRef: mockCollectionRef,
          data: { time: '08:00' },
          schedule: {
            userId: 'user-001',
            itemType: 'alarm',
            fireAt,
          },
          scheduleNotificationFn: mockScheduleFn,
        }),
      ).rejects.toThrow('Cloud Tasks rate limited');

      expect(mockCollectionRef.add).toHaveBeenCalledWith({ time: '08:00' });
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('rolls back document when docRef.update throws after scheduling', async () => {
      const fireAt = new Date('2026-10-16T08:00:00.000Z');
      const mockUpdate = vi.fn().mockRejectedValue(new Error('Firestore update failed'));
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      const mockDocRef = {
        id: 'doc-rollback-2',
        update: mockUpdate,
        delete: mockDelete,
      };

      const mockCollectionRef = {
        add: vi.fn().mockResolvedValue(mockDocRef),
      };

      const mockScheduleFn = vi.fn().mockResolvedValue('projects/test/tasks/task-999');

      await expect(
        saveAndScheduleTask({
          collectionRef: mockCollectionRef,
          data: { time: '08:00' },
          schedule: {
            userId: 'user-001',
            itemType: 'alarm',
            fireAt,
          },
          scheduleNotificationFn: mockScheduleFn,
        }),
      ).rejects.toThrow('Firestore update failed');

      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it('swallows rollback failure without masking the original schedule error', async () => {
      const fireAt = new Date('2026-10-16T08:00:00.000Z');
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      const mockDelete = vi.fn().mockRejectedValue(new Error('Rollback delete failed'));
      const mockDocRef = {
        id: 'doc-rollback-3',
        update: mockUpdate,
        delete: mockDelete,
      };

      const mockCollectionRef = {
        add: vi.fn().mockResolvedValue(mockDocRef),
      };

      const scheduleError = new Error('Cloud Tasks unavailable');
      const mockScheduleFn = vi.fn().mockRejectedValue(scheduleError);

      await expect(
        saveAndScheduleTask({
          collectionRef: mockCollectionRef,
          data: { time: '08:00' },
          schedule: {
            userId: 'user-001',
            itemType: 'alarm',
            fireAt,
          },
          scheduleNotificationFn: mockScheduleFn,
        }),
      ).rejects.toThrow('Cloud Tasks unavailable');

      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it('extracts primary secret when WEBHOOK_SECRET is comma-separated (S5 rotation)', async () => {
      process.env.WEBHOOK_SECRET = 'primary-secret-key, secondary-rotated-key';

      const mockCreateTask = vi.fn().mockResolvedValue([{ name: 'task-rot' }]);
      const mockClient = {
        createTask: mockCreateTask,
        queuePath: vi.fn().mockReturnValue('projects/p/locations/l/queues/q'),
      } as unknown as CloudTasksClient;

      await scheduleNotification({
        userId: 'u1',
        itemId: 'i1',
        itemType: 'alarm',
        fireAt: new Date(),
        client: mockClient,
      });

      const callArg = mockCreateTask.mock.calls[0][0];
      expect(callArg.task.httpRequest.headers['X-Webhook-Secret']).toBe('primary-secret-key');
    });

    it('attaches oidcToken when serviceAccountEmail is configured (S5 task identity)', async () => {
      process.env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL = 'sa@gcp.iam.gserviceaccount.com';
      process.env.NEXT_PUBLIC_APP_URL = 'https://senior.app';

      const mockCreateTask = vi.fn().mockResolvedValue([{ name: 'task-oidc' }]);
      const mockClient = {
        createTask: mockCreateTask,
        queuePath: vi.fn().mockReturnValue('projects/p/locations/l/queues/q'),
      } as unknown as CloudTasksClient;

      await scheduleNotification({
        userId: 'u1',
        itemId: 'i1',
        itemType: 'reminder',
        fireAt: new Date(),
        client: mockClient,
      });

      const callArg = mockCreateTask.mock.calls[0][0];
      expect(callArg.task.httpRequest.oidcToken).toEqual({
        serviceAccountEmail: 'sa@gcp.iam.gserviceaccount.com',
        audience: 'https://senior.app',
      });
    });
  });

  describe('cancelScheduledTask', () => {
    it('deletes scheduled task by resource name', async () => {
      const mockDeleteTask = vi.fn().mockResolvedValue([{}]);
      const mockClient = {
        deleteTask: mockDeleteTask,
      } as unknown as CloudTasksClient;

      await expect(
        cancelScheduledTask(
          'projects/test-project/locations/asia-southeast1/queues/reminder-queue/tasks/task-123',
          {
            client: mockClient,
          },
        ),
      ).resolves.toBeUndefined();

      expect(mockDeleteTask).toHaveBeenCalledWith({
        name: 'projects/test-project/locations/asia-southeast1/queues/reminder-queue/tasks/task-123',
      });
    });

    it('safely swallows gRPC NOT_FOUND code 5 error if task already executed', async () => {
      const notFoundError = new Error('Task not found');
      (notFoundError as any).code = 5;

      const mockDeleteTask = vi.fn().mockRejectedValue(notFoundError);
      const mockClient = {
        deleteTask: mockDeleteTask,
      } as unknown as CloudTasksClient;

      await expect(
        cancelScheduledTask('task-already-fired', { client: mockClient }),
      ).resolves.toBeUndefined();
    });

    it('safely swallows HTTP 404 error if task already executed', async () => {
      const notFoundError = new Error('Task not found');
      (notFoundError as any).status = 404;

      const mockDeleteTask = vi.fn().mockRejectedValue(notFoundError);
      const mockClient = {
        deleteTask: mockDeleteTask,
      } as unknown as CloudTasksClient;

      await expect(
        cancelScheduledTask('task-already-fired', { client: mockClient }),
      ).resolves.toBeUndefined();
    });

    it('rethrows unexpected error (e.g. code 7 PERMISSION_DENIED)', async () => {
      const permError = new Error('Permission denied');
      (permError as any).code = 7;

      const mockDeleteTask = vi.fn().mockRejectedValue(permError);
      const mockClient = {
        deleteTask: mockDeleteTask,
      } as unknown as CloudTasksClient;

      await expect(
        cancelScheduledTask('task-unauthorized', { client: mockClient }),
      ).rejects.toThrow('Permission denied');
    });
  });
});
