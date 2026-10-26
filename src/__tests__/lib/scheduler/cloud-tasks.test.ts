import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cloudTasksClient,
  getCloudTasksClientOptions,
  scheduleNotification,
  cancelScheduledTask,
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
        payload: { extraInfo: 'wake up' },
        client: mockClient,
        projectId: 'test-project',
        location: 'asia-southeast1',
        queueId: 'reminder-queue',
        appUrl: 'https://app.example.com/',
        webhookSecret: 'secret-123',
      });

      expect(taskName).toBe(
        'projects/test-project/locations/asia-southeast1/queues/reminder-queue/tasks/task-123',
      );
      expect(mockQueuePath).toHaveBeenCalledWith(
        'test-project',
        'asia-southeast1',
        'reminder-queue',
      );

      expect(mockCreateTask).toHaveBeenCalledTimes(1);
      const callArg = mockCreateTask.mock.calls[0][0];

      expect(callArg.parent).toBe(
        'projects/test-project/locations/asia-southeast1/queues/reminder-queue',
      );
      expect(callArg.task.scheduleTime).toEqual({ seconds: expectedSeconds });

      const httpRequest = callArg.task.httpRequest;
      expect(httpRequest.httpMethod).toBe('POST');
      expect(httpRequest.url).toBe('https://app.example.com/api/notify');
      expect(httpRequest.headers).toEqual({
        'Content-Type': 'application/json',
        'X-Webhook-Secret': 'secret-123',
      });

      const decodedBody = JSON.parse(Buffer.from(httpRequest.body, 'base64').toString('utf8'));
      expect(decodedBody).toEqual({
        userId: 'user-001',
        itemId: 'alarm-001',
        itemType: 'alarm',
        extraInfo: 'wake up',
      });
    });

    it('falls back to default environment variables when optional args are omitted', async () => {
      process.env.GOOGLE_CLOUD_PROJECT_ID = 'env-project';
      process.env.GCP_LOCATION = 'asia-southeast1';
      process.env.CLOUD_TASKS_QUEUE_ID = 'env-queue';
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
      process.env.WEBHOOK_SECRET = 'env-secret';

      const fireAt = new Date('2026-10-16T10:00:00.000Z');
      const mockCreateTask = vi.fn().mockResolvedValue([{ name: 'task-fallback' }]);
      const mockQueuePath = vi.fn().mockReturnValue('projects/env-project/...');

      const mockClient = {
        createTask: mockCreateTask,
        queuePath: mockQueuePath,
      } as unknown as CloudTasksClient;

      const taskName = await scheduleNotification({
        userId: 'user-002',
        itemId: 'rem-001',
        itemType: 'reminder',
        fireAt,
        client: mockClient,
      });

      expect(taskName).toBe('task-fallback');
      expect(mockQueuePath).toHaveBeenCalledWith('env-project', 'asia-southeast1', 'env-queue');
      expect(mockCreateTask).toHaveBeenCalledTimes(1);
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

    it('rejects with error when fireAt exceeds 30-day schedule limit (R4)', async () => {
      const farFutureDate = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
      const mockClient = {
        createTask: vi.fn(),
        queuePath: vi.fn(),
      } as unknown as CloudTasksClient;

      await expect(
        scheduleNotification({
          userId: 'u1',
          itemId: 'i1',
          itemType: 'reminder',
          fireAt: farFutureDate,
          client: mockClient,
        }),
      ).rejects.toThrow('Cloud Tasks scheduleTime cannot exceed 30 days in the future');
    });
  });

  describe('cancelScheduledTask', () => {
    it('deletes task by identifier successfully', async () => {
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
