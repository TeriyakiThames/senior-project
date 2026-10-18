'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLiff } from '@/components/liff/LiffProvider';
import type { AlarmDoc, ReminderDoc, NoteDoc } from '@/types/firestore';

export interface LiffItemsData {
  alarms?: (AlarmDoc & { id: string })[];
  reminders?: (ReminderDoc & { id: string })[];
  notes?: (NoteDoc & { id: string })[];
}

export function useLiffData<T = LiffItemsData>(
  type: 'alarms' | 'reminders' | 'notes' | 'all' = 'all',
) {
  const { userId, isReady } = useLiff();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/liff/items?type=${type}`, {
        headers: {
          'x-line-userid': userId,
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch items: ${res.statusText}`);
      }
      const json = await res.json();
      setData(json as T);
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      console.error('useLiffData fetch error:', errorObj);
    } finally {
      setLoading(false);
    }
  }, [userId, type]);

  useEffect(() => {
    if (isReady) {
      refresh();
    }
  }, [isReady, refresh]);

  const deleteItem = useCallback(
    async (id: string, itemType: 'alarm' | 'reminder' | 'note') => {
      if (!userId) return;
      try {
        const res = await fetch(`/api/liff/items/${id}?type=${itemType}`, {
          method: 'DELETE',
          headers: {
            'x-line-userid': userId,
          },
        });
        if (!res.ok) {
          throw new Error(`Failed to delete item: ${res.statusText}`);
        }
        await refresh();
      } catch (err: unknown) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        console.error('useLiffData delete error:', errorObj);
        throw errorObj;
      }
    },
    [userId, refresh],
  );

  return { data, loading, error, refresh, deleteItem };
}
