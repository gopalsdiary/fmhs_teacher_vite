import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

let supabaseInstance: any = null;

export const initSupabase = () => {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase env vars missing!');
    }
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseInstance;
};

// Singleton cache for teacher data
let cachedTeacher: any = null;
let authPromise: Promise<any> | null = null;

export const checkAuth = async () => {
  if (cachedTeacher) return cachedTeacher;
  
  // Deduplicate inflight requests
  if (authPromise) return authPromise;

  authPromise = (async () => {
    const supabase = initSupabase();
    const email = localStorage.getItem('teacherEmail');

    if (!email) {
      authPromise = null;
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('admin_teacher')
        .select('*')
        .eq('teacher_email', email)
        .single();

      if (error || !data) {
        localStorage.removeItem('teacherEmail');
        authPromise = null;
        return null;
      }

      // Add assignments logic if needed or just return raw data
      // (assuming data already has access_class, access_section, and allAssignments JSON)
      cachedTeacher = data;
      authPromise = null;
      return data;
    } catch (e) {
      console.error('Auth check failed:', e);
      authPromise = null;
      return null;
    }
  })();

  return authPromise;
};

export const logout = () => {
  localStorage.removeItem('teacherEmail');
  cachedTeacher = null;
  // Clear any data caches too
  const keys = Object.keys(sessionStorage);
  keys.forEach(k => { if (k.startsWith('cache:')) sessionStorage.removeItem(k); });
};
