import { get, set, del, keys, clear } from 'idb-keyval';

/* Advanced persistent cache using IndexedDB */
const DEFAULT_TTL = 7 * 24 * 60 * 60 * 1000; // 1 week

export async function cacheSet<T>(key: string, data: T, customTTL?: number) {
  const expiry = Date.now() + (customTTL || DEFAULT_TTL);
  const payload = { 
    data, 
    expiry, 
    timestamp: Date.now(),
    version: '2.0' 
  };
  try {
    await set(`cache:${key}`, payload);
  } catch (e) {
    console.warn('Cache write failed:', e);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const payload: any = await get(`cache:${key}`);
    if (!payload) return null;
    
    // If expired but offline, return stale data
    if (Date.now() > payload.expiry && navigator.onLine) {
      // await del(`cache:${key}`); // Don't delete, just return null so it refetches
      return payload.data as T;
    }
    return payload.data as T;
  } catch (e) {
    return null;
  }
}

export async function cacheClear() {
  await clear();
}

/* Mutation Queue for Offline Writes */
export interface PendingMutation {
  id: string;
  action: string;
  payload: any;
  timestamp: number;
}

export async function addToSyncQueue(mutation: Omit<PendingMutation, 'id' | 'timestamp'>) {
  const queue: PendingMutation[] = (await get('sync_queue')) || [];
  const newMutation = {
    ...mutation,
    id: Math.random().toString(36).substr(2, 9),
    timestamp: Date.now()
  };
  queue.push(newMutation);
  await set('sync_queue', queue);
  window.dispatchEvent(new CustomEvent('sync-queue-updated', { detail: queue.length }));
}

export async function getSyncQueue(): Promise<PendingMutation[]> {
  return (await get('sync_queue')) || [];
}

export async function removeFromSyncQueue(id: string) {
  const queue: PendingMutation[] = (await get('sync_queue')) || [];
  const filtered = queue.filter(m => m.id !== id);
  await set('sync_queue', filtered);
  window.dispatchEvent(new CustomEvent('sync-queue-updated', { detail: filtered.length }));
}

