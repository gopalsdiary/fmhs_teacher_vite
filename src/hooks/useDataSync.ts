import { useState, useCallback, useEffect } from 'react';
import { initSupabase, checkAuth } from '../auth-check';
import { cacheSet, cacheGet } from '../cache';
import {
  hasPhoto,
  downloadAndSavePhoto,
  isPhotoChanged,
  savePhotoUrlHash,
} from '../photoCache';

// ৫ দিন = 432,000,000 ms
const SYNC_INTERVAL_MS = 5 * 24 * 60 * 60 * 1000;

export function useDataSync() {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [photoProgress, setPhotoProgress] = useState<{ done: number; total: number } | null>(null);

  const syncAllData = useCallback(async (forcePhotoSync = false) => {
    if (!navigator.onLine) return;

    setSyncing(true);
    setProgress(0);
    setPhotoProgress(null);
    const supabase = initSupabase();

    try {
      const teacher = await checkAuth();
      if (!teacher) return;

      const assignments = teacher.allAssignments || [
        { access_class: teacher.access_class, access_section: teacher.access_section },
      ];

      console.log('🔄 Starting Smart Sync (5-day cycle)...');

      // Pre-cache dataorder
      try {
        const res = await fetch('/dataorder.csv');
        if (res.ok) {
          const txt = await res.text();
          const lines = txt.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
          const spec: any[] = [];
          lines.forEach((line: string) => {
            if (line.toLowerCase().includes('colm name')) return;
            const parts = line.split(' > ');
            if (parts.length >= 2) spec.push({ field: parts[0].trim(), label: parts[1].trim() });
            else if (line.startsWith('*')) spec.push({ field: null, label: line });
          });
          await cacheSet('dataorder', spec);
        }
      } catch (e) {
        console.warn('Failed to cache dataorder:', e);
      }

      for (let i = 0; i < assignments.length; i++) {
        const asgn = assignments[i];
        const studentListKey = `students:${asgn.access_class}:${asgn.access_section}`;
        const photosKey = `photos:${asgn.access_class}:${asgn.access_section}`;
        const attKey = `att-students:${asgn.access_class}:${asgn.access_section}`;

        // ১. Supabase থেকে student data fetch
        const { data, error } = await supabase
          .from('student_database')
          .select(
            'iid, student_name_en, student_name_bn, active_roll, active_class, active_section, session, rfid_card_no, student_photo_url, father_name_en, father_mobile, mother_name_en, mother_mobile, guardian_mobile'
          )
          .eq('active_class', asgn.access_class)
          .eq('active_section', asgn.access_section)
          .order('active_roll', { ascending: true });

        if (error) throw error;
        if (!data) continue;

        // ২. Cache-এ সেভ করো
        const unique = data.filter(
          (s: any, idx: number, self: any[]) =>
            idx === self.findIndex((t: any) => t.iid === s.iid)
        );
        await cacheSet(studentListKey, unique);
        await cacheSet(attKey, unique);
        await cacheSet(photosKey, unique);

        for (const student of data) {
          if (student.iid) {
            await cacheSet(`student:${student.iid}`, student);
          }
        }

        // ৩. Smart Photo Sync — শুধু নতুন/পরিবর্তিত photo download করো
        const photosToDownload = await filterPhotosToDownload(data, forcePhotoSync);

        if (photosToDownload.length > 0) {
          console.log(`📸 Downloading ${photosToDownload.length} new/updated photos...`);
          setPhotoProgress({ done: 0, total: photosToDownload.length });

          let done = 0;
          for (const student of photosToDownload) {
            if (!student.student_photo_url) { done++; continue; }

            await downloadAndSavePhoto(student.iid, student.student_photo_url);
            await savePhotoUrlHash(student.iid, student.student_photo_url);

            done++;
            setPhotoProgress({ done, total: photosToDownload.length });

            // Rate limiting রোধে ছোট delay
            await new Promise(r => setTimeout(r, 80));
          }

          console.log(`✅ Photos synced: ${done}/${photosToDownload.length}`);
          setPhotoProgress(null);
        } else {
          console.log('📸 All photos already cached. Skipping photo sync.');
        }

        setProgress(Math.round(((i + 1) / assignments.length) * 100));
      }

      console.log('✅ Sync Complete!');
      localStorage.setItem('last_full_sync', Date.now().toString());
    } catch (err) {
      console.error('❌ Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  }, []);

  // Online হলে auto-sync (৫ দিনের বেশি হলে)
  useEffect(() => {
    const handleOnline = () => {
      const lastSync = localStorage.getItem('last_full_sync');
      const syncAge = lastSync ? Date.now() - parseInt(lastSync) : Infinity;
      if (syncAge > SYNC_INTERVAL_MS) {
        syncAllData();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncAllData]);

  return { syncAllData, syncing, progress, photoProgress };
}

/**
 * কোন photo গুলো download করতে হবে তা filter করে।
 * - IndexedDB-তে নেই → download
 * - URL পরিবর্তন হয়েছে → re-download
 * - আগের মতোই → skip
 */
async function filterPhotosToDownload(
  students: any[],
  forceAll: boolean
): Promise<any[]> {
  if (forceAll) return students.filter(s => s.student_photo_url);

  const toDownload: any[] = [];
  for (const student of students) {
    if (!student.student_photo_url) continue;

    const alreadyCached = await hasPhoto(student.iid);
    if (!alreadyCached) {
      toDownload.push(student);
      continue;
    }

    // URL পরিবর্তন হয়েছে কিনা চেক
    const changed = await isPhotoChanged(student.iid, student.student_photo_url);
    if (changed) {
      toDownload.push(student);
    }
  }
  return toDownload;
}
