/**
 * photoCache.ts
 * 
 * ছাত্রের ছবি IndexedDB-তে স্থায়ীভাবে সেভ করে।
 * - একবার download হলে, device-এ থাকে (ডিলিট হয় না)
 * - Offline-এ blob:// URL দিয়ে দেখানো যায়
 * - Supabase bucket থেকে fetch করে ArrayBuffer হিসেবে সেভ
 */

import { get, set } from 'idb-keyval';

const PHOTO_PREFIX = 'photo:';

// In-memory blob URL cache (tab session পর্যন্ত valid)
const blobUrlCache = new Map<string, string>();

/**
 * IndexedDB-তে photo blob আছে কিনা চেক করে
 */
export async function hasPhoto(iid: string | number): Promise<boolean> {
  try {
    const key = `${PHOTO_PREFIX}${iid}`;
    if (blobUrlCache.has(key)) return true;
    const blob = await get(key);
    return blob instanceof Blob;
  } catch {
    return false;
  }
}

/**
 * IndexedDB থেকে photo-র blob URL দেয়
 * Tab session শেষ হলে blob URL revoke হয়, কিন্তু IndexedDB data থাকে
 */
export async function getPhotoUrl(iid: string | number): Promise<string | null> {
  try {
    const key = `${PHOTO_PREFIX}${iid}`;
    
    // In-memory cache hit
    if (blobUrlCache.has(key)) return blobUrlCache.get(key)!;
    
    const blob = await get(key);
    if (!(blob instanceof Blob)) return null;
    
    const url = URL.createObjectURL(blob);
    blobUrlCache.set(key, url);
    return url;
  } catch {
    return null;
  }
}

/**
 * Supabase URL থেকে photo download করে IndexedDB-তে সেভ করে
 * Returns: blob URL বা null (failure-এ)
 */
export async function downloadAndSavePhoto(
  iid: string | number,
  photoUrl: string
): Promise<string | null> {
  try {
    if (!photoUrl || !photoUrl.startsWith('http')) return null;

    const key = `${PHOTO_PREFIX}${iid}`;

    // ইতোমধ্যে cache-এ আছে কিনা চেক
    const existing = await get(key);
    if (existing instanceof Blob) {
      const url = URL.createObjectURL(existing);
      blobUrlCache.set(key, url);
      return url;
    }

    // Supabase URL থেকে fetch করো
    // Authorization header সহ fetch (Supabase anon key দরকার হলে)
    const response = await fetch(photoUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    if (blob.size === 0) return null;

    // IndexedDB-তে সেভ করো (স্থায়ী)
    await set(key, blob);

    const blobUrl = URL.createObjectURL(blob);
    blobUrlCache.set(key, blobUrl);
    return blobUrl;
  } catch (e) {
    console.warn(`Photo download failed for iid ${iid}:`, e);
    return null;
  }
}

/**
 * একটি ছাত্রের photo URL আছে কিনা verify করে:
 * 1. প্রথমে IndexedDB চেক
 * 2. না থাকলে download করে সেভ করে
 * 3. ব্যর্থ হলে original URL ফিরিয়ে দেয় (fallback)
 */
export async function getOrFetchPhoto(
  iid: string | number,
  remoteUrl: string | null | undefined
): Promise<string | null> {
  if (!remoteUrl) return null;

  // প্রথমে IndexedDB চেক
  const cached = await getPhotoUrl(iid);
  if (cached) return cached;

  // না থাকলে download করো
  if (navigator.onLine) {
    return await downloadAndSavePhoto(iid, remoteUrl);
  }

  // Offline + no cache → original URL (may fail)
  return remoteUrl;
}

/**
 * Multiple photos batch download (background sync-এর জন্য)
 * Returns: { success: number, failed: number }
 */
export async function batchDownloadPhotos(
  students: Array<{ iid: string | number; student_photo_url?: string }>,
  onProgress?: (done: number, total: number) => void
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  const total = students.filter(s => s.student_photo_url).length;
  let done = 0;

  // Sequential download (parallel হলে Supabase rate limit হতে পারে)
  for (const student of students) {
    if (!student.student_photo_url) continue;

    const alreadyHas = await hasPhoto(student.iid);
    if (alreadyHas) {
      success++;
      done++;
      onProgress?.(done, total);
      continue;
    }

    const result = await downloadAndSavePhoto(student.iid, student.student_photo_url);
    if (result) {
      success++;
    } else {
      failed++;
    }
    done++;
    onProgress?.(done, total);

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 50));
  }

  return { success, failed };
}

/**
 * একটি ছাত্রের photo URL হয়েছে কিনা detect করে (URL পরিবর্তন)
 * Key: `photo_url_hash:${iid}` → stored URL string
 */
export async function isPhotoChanged(
  iid: string | number,
  newUrl: string | null | undefined
): Promise<boolean> {
  if (!newUrl) return false;
  try {
    const storedUrl = await get(`photo_url_hash:${iid}`);
    return storedUrl !== newUrl;
  } catch {
    return true;
  }
}

export async function savePhotoUrlHash(
  iid: string | number,
  url: string
): Promise<void> {
  try {
    await set(`photo_url_hash:${iid}`, url);
  } catch {}
}
