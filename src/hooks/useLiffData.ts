'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLiff } from '@/components/liff/LiffProvider';
import { isMockAllowed } from '@/lib/utils/env';
import type { AlarmDoc, ReminderDoc, NoteDoc } from '@/types/firestore';

export interface LiffItemsData {
  timers?: (AlarmDoc & { id: string })[];
  alarms?: (AlarmDoc & { id: string })[];
  reminders?: (ReminderDoc & { id: string })[];
  notes?: (NoteDoc & { id: string })[];
}

export function useLiffData<T = LiffItemsData>(
  type: 'timers' | 'timer' | 'reminders' | 'notes' | 'all' | 'alarms' = 'all',
) {
  const { userId, idToken, isReady } = useLiff();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {};
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    } else if (isMockAllowed() && userId?.startsWith('mock-')) {
      headers['x-line-userid'] = userId;
    }
    return headers;
  }, [idToken, userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/liff/items?type=${encodeURIComponent(type)}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const errData = await res.json();
          if (errData?.error) msg = errData.error;
        } catch {
          // Ignore json parse error
        }
        throw new Error(`Failed to fetch items: ${msg || res.status}`);
      }
      const json = await res.json();
      if (json && typeof json === 'object') {
        const record = json as Record<string, unknown>;
        if (record.alarms && !record.timers) {
          record.timers = record.alarms;
        } else if (record.timers && !record.alarms) {
          record.alarms = record.timers;
        }
      }
      setData(json as T);
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      console.error('useLiffData fetch error:', errorObj);
    } finally {
      setLoading(false);
    }
  }, [userId, type, getAuthHeaders]);

  useEffect(() => {
    if (isReady) {
      refresh();
    }
  }, [isReady, refresh]);

  const deleteItem = useCallback(
    async (id: string, itemType: 'timer' | 'reminder' | 'note' | 'alarm') => {
      if (!userId) return;
      try {
        const res = await fetch(
          `/api/liff/items/${encodeURIComponent(id)}?type=${encodeURIComponent(itemType)}`,
          {
            method: 'DELETE',
            headers: getAuthHeaders(),
          },
        );
        if (!res.ok) {
          let msg = res.statusText;
          try {
            const errData = await res.json();
            if (errData?.error) msg = errData.error;
          } catch {
            // Ignore json parse error
          }
          throw new Error(`Failed to delete item: ${msg || res.status}`);
        }
        await refresh();
      } catch (err: unknown) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        console.error('useLiffData delete error:', errorObj);
        throw errorObj;
      }
    },
    [userId, refresh, getAuthHeaders],
  );

  return { data, loading, error, refresh, deleteItem };
}
