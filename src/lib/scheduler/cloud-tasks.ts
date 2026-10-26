import { CloudTasksClient } from '@google-cloud/tasks';

export interface ScheduleNotificationOptions {
  userId: string;
  itemId: string;
  itemType: 'alarm' | 'reminder';
  fireAt: Date;
  payload?: Record<string, unknown>;
  client?: CloudTasksClient;
  projectId?: string;
  location?: string;
  queueId?: string;
  appUrl?: string;
  webhookSecret?: string;
  serviceAccountEmail?: string;
}

export interface CancelScheduledTaskOptions {
  client?: CloudTasksClient;
}

/**
 * Derives configuration options for CloudTasksClient initialization,
 * ingesting JSON credentials if provided.
 */
export function getCloudTasksClientOptions() {
  const options: {
    credentials?: Record<string, unknown>;
  } = {};

  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (credentialsJson) {
    try {
      options.credentials = JSON.parse(credentialsJson) as Record<string, unknown>;
    } catch {
      // Ignore parse failure and fall back to GCP default application credentials
    }
  }

  return options;
}

const globalForTasks = globalThis as unknown as {
  cloudTasksClient?: CloudTasksClient;
};

export const cloudTasksClient =
  globalForTasks.cloudTasksClient ?? new CloudTasksClient(getCloudTasksClientOptions());

if (process.env.NODE_ENV !== 'production') {
  globalForTasks.cloudTasksClient = cloudTasksClient;
}

export const CLOUD_TASKS_MAX_SCHEDULE_LIMIT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Enqueues a delayed HTTP POST task targeting /api/notify.
 *
 * @param opts Options including userId, itemId, itemType, fireAt, and optional overrides
 * @returns Fully qualified task resource name
 */
export async function scheduleNotification(opts: ScheduleNotificationOptions): Promise<string> {
  const {
    userId,
    itemId,
    itemType,
    fireAt,
    payload,
    client = cloudTasksClient,
    projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'senior-project-dummy',
    location = process.env.GCP_LOCATION || 'asia-southeast1',
    queueId = process.env.CLOUD_TASKS_QUEUE_ID || 'reminder-queue',
    appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  } = opts;

  const now = Date.now();
  if (fireAt.getTime() - now > CLOUD_TASKS_MAX_SCHEDULE_LIMIT_MS) {
    throw new Error('Cloud Tasks scheduleTime cannot exceed 30 days in the future');
  }

  const rawWebhookSecret = opts.webhookSecret ?? process.env.WEBHOOK_SECRET ?? '';
  // When multiple secrets are configured for rotation (comma-separated), use the primary secret
  const webhookSecret = rawWebhookSecret.split(',')[0].trim();

  const serviceAccountEmail =
    opts.serviceAccountEmail ||
    process.env.CLOUD_TASKS_SERVICE_ACCOUNT_EMAIL ||
    process.env.GCP_SERVICE_ACCOUNT_EMAIL;

  const parent = client.queuePath(projectId, location, queueId);
  const sanitizedAppUrl = appUrl.replace(/\/$/, '');
  const url = `${sanitizedAppUrl}/api/notify`;

  const taskPayload = {
    userId,
    itemId,
    itemType,
    ...(payload ?? {}),
  };

  const body = Buffer.from(JSON.stringify(taskPayload)).toString('base64');

  const httpRequest: Record<string, unknown> = {
    httpMethod: 'POST',
    url,
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Secret': webhookSecret,
    },
    body,
  };

  if (serviceAccountEmail) {
    httpRequest.oidcToken = {
      serviceAccountEmail,
      audience: sanitizedAppUrl,
    };
  }

  const [task] = await client.createTask({
    parent,
    task: {
      httpRequest: httpRequest as any,
      scheduleTime: {
        seconds: Math.floor(fireAt.getTime() / 1000),
      },
    },
  });

  return task.name ?? '';
}

/**
 * Deletes a scheduled task by task identifier/resource name.
 * Safely swallows NOT_FOUND (code 5 or HTTP 404) errors if the task has already executed or was deleted.
 *
 * @param taskName Full resource name of the task to delete
 * @param options Optional client override
 */
export async function cancelScheduledTask(
  taskName: string,
  options?: CancelScheduledTaskOptions,
): Promise<void> {
  const client = options?.client ?? cloudTasksClient;

  try {
    await client.deleteTask({ name: taskName });
  } catch (error: unknown) {
    const err = error as { code?: number; status?: number; message?: string };
    // gRPC NOT_FOUND code is 5; HTTP 404
    if (err?.code === 5 || err?.status === 404 || err?.message?.includes('NOT_FOUND')) {
      return;
    }
    throw error;
  }
}
