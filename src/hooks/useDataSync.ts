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

      for (let i = 0; i < assignments.length; i++) {
        const asgn = assignments[i];
        const key = `students:${asgn.access_class}:${asgn.access_section}`;
        
        // 1. Fetch Students from Supabase
        const { data, error } = await supabase
          .from('student_database')
          .select('*')
          .eq('active_class', asgn.access_class)
          .eq('active_section', asgn.access_section)
          .order('active_roll', { ascending: true });

        if (error) throw error;

        if (data) {
          // 2. Save to IndexedDB Cache
          await cacheSet(key, data);
          
          // 3. Prefetch Images
          const photos = data
            .map((s: any) => s.student_photo_url)
            .filter((url: string) => url && url.startsWith('http'));
            
          if (photos.length > 0 && 'caches' in window) {
            const photoCache = await caches.open('student-photos-cache');
            // We use a safe approach to add images to cache
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
