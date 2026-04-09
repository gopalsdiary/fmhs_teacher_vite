/* Simple in-memory / session cache for high speed navigation */

const TTL = 5 * 60 * 1000; // 5 minutes

export function cacheSet<T>(key: string, data: T, customTTL?: number) {
  const expiry = Date.now() + (customTTL || TTL);
  const payload = JSON.stringify({ data, expiry });
  try {
    sessionStorage.setItem(`cache:${key}`, payload);
  } catch (e) {
    console.warn('Cache write failed:', e);
  }
}

export function cacheGet<T>(key: string): T | null {
  const raw = sessionStorage.getItem(`cache:${key}`);
  if (!raw) return null;

  try {
    const payload = JSON.parse(raw);
    if (Date.now() > payload.expiry) {
      sessionStorage.removeItem(`cache:${key}`);
      return null;
    }
    return payload.data as T;
  } catch (e) {
    return null;
  }
}

export function cacheClear() {
  const keys = Object.keys(sessionStorage);
  keys.forEach(k => {
    if (k.startsWith('cache:')) sessionStorage.removeItem(k);
  });
}
