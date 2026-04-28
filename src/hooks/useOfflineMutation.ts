import { useState, useCallback, useEffect } from 'react';
import { addToSyncQueue, getSyncQueue, removeFromSyncQueue } from '../cache';

interface UseOfflineMutationOptions<T, R> {
  action: string;
  executor: (payload: T) => Promise<R>;
  onSuccess?: (result: R) => void;
  onError?: (error: Error) => void;
}

export function useOfflineMutation<T, R>({
  action,
  executor,
  onSuccess,
  onError
}: UseOfflineMutationOptions<T, R>) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Load initial pending count
  useEffect(() => {
    getSyncQueue().then(queue => {
      const count = queue.filter(m => m.action === action).length;
      setPendingCount(count);
    });

    const handleSyncUpdate = (e: any) => {
      // Logic to re-check queue if needed
    };
    window.addEventListener('sync-queue-updated', handleSyncUpdate);
    return () => window.removeEventListener('sync-queue-updated', handleSyncUpdate);
  }, [action]);

  const mutate = useCallback(async (payload: T) => {
    if (navigator.onLine) {
      setIsSyncing(true);
      try {
        const result = await executor(payload);
        if (onSuccess) onSuccess(result);
        return result;
      } catch (err: any) {
        const error = err instanceof Error ? err : new Error('Mutation failed');
        if (onError) onError(error);
        
        // If it failed because of network, queue it anyway
        if (!navigator.onLine || (err && err.message?.includes('fetch'))) {
          await addToSyncQueue({ action, payload });
          setPendingCount(prev => prev + 1);
        }
        throw error;
      } finally {
        setIsSyncing(false);
      }
    } else {
      // Offline: Queue it
      await addToSyncQueue({ action, payload });
      setPendingCount(prev => prev + 1);
      if (onSuccess) onSuccess({ queued: true } as any);
      return { queued: true };
    }
  }, [action, executor, onSuccess, onError]);

  // Background sync logic
  useEffect(() => {
    const processQueue = async () => {
      if (!navigator.onLine || isSyncing) return;
      
      const queue = await getSyncQueue();
      const myMutations = queue.filter(m => m.action === action);
      
      if (myMutations.length === 0) return;

      setIsSyncing(true);
      for (const mutation of myMutations) {
        try {
          await executor(mutation.payload);
          await removeFromSyncQueue(mutation.id);
          setPendingCount(prev => Math.max(0, prev - 1));
        } catch (err) {
          console.error(`Failed to sync mutation ${mutation.id}:`, err);
          // Stop processing if one fails (might be a conflict or permanent error)
          break;
        }
      }
      setIsSyncing(false);
    };

    window.addEventListener('online', processQueue);
    processQueue(); // Try processing on mount if online

    return () => window.removeEventListener('online', processQueue);
  }, [action, executor, isSyncing]);

  return { mutate, isSyncing, pendingCount };
}
