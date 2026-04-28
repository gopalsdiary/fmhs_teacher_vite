import { useState, useCallback } from 'react';
import { initSupabase, checkAuth } from '../auth-check';
import { cacheSet, cacheGet } from '../cache';

export function useDataSync() {
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);

  const syncAllData = useCallback(async () => {
    setSyncing(true);
    setProgress(0);
    const supabase = initSupabase();
    
    try {
      const teacher = await checkAuth();
      if (!teacher) return;

      const assignments = teacher.allAssignments || [
        { access_class: teacher.access_class, access_section: teacher.access_section }
      ];

      console.log('🔄 Starting Full Background Sync...');

      // Pre-cache dataorder for student details
      try {
        const res = await fetch('/dataorder.csv');
        if (res.ok) {
          const txt = await res.text();
          const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const spec: any[] = [];
          lines.forEach(line => {
            if (line.toLowerCase().includes('colm name')) return;
            const parts = line.split(' > ');
            if (parts.length >= 2) spec.push({ field: parts[0].trim(), label: parts[1].trim() });
            else if (line.startsWith('*')) spec.push({ field: null, label: line });
          });
          await cacheSet('dataorder', spec);
        }
      } catch (e) { console.warn('Failed to cache dataorder:', e); }

      for (let i = 0; i < assignments.length; i++) {
        const asgn = assignments[i];
        const studentListKey = `students:${asgn.access_class}:${asgn.access_section}`;
        const photosKey = `photos:${asgn.access_class}:${asgn.access_section}`;
        const attKey = `att-students:${asgn.access_class}:${asgn.access_section}`;
        
        // 1. Fetch Students from Supabase
        const { data, error } = await supabase
          .from('student_database')
          .select('*')
          .eq('active_class', asgn.access_class)
          .eq('active_section', asgn.access_section)
          .order('active_roll', { ascending: true });

        if (error) throw error;

        if (data) {
          // 2. Save the List to IndexedDB Cache (for Student List, Attendance, and Photos)
          await cacheSet(studentListKey, data);
          await cacheSet(attKey, data);
          
          // 3. Save to Photos Cache (for Gallery)
          const uniqueForPhotos = data.filter((s, idx, self) => idx === self.findIndex((t) => t.iid === s.iid));
          await cacheSet(photosKey, uniqueForPhotos);
          
          // 4. Save INDIVIDUAL students to cache for the /student/:iid page
          // This fixes the "data not showing offline" issue for student details
          for (const student of data) {
            if (student.iid) {
              await cacheSet(`student:${student.iid}`, student);
            }
          }
          
          // 5. Prefetch Images
          const photos = data
            .map((s: any) => s.student_photo_url)
            .filter((url: string) => url && url.startsWith('http'));
            
          if (photos.length > 0 && 'caches' in window) {
            const photoCache = await caches.open('student-photos-cache');
            await Promise.allSettled(
              photos.map(async (url: string) => {
                try {
                  const response = await fetch(url, { mode: 'no-cors' });
                  await photoCache.put(url, response);
                } catch (e) {
                  // Silently fail for individual images
                }
              })
            );
          }
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

  return { syncAllData, syncing, progress };
}
