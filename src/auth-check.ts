import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;
const msgUrl = import.meta.env.VITE_SUPABASE_MSG_URL;
const msgKey = import.meta.env.VITE_SUPABASE_MSG_KEY;

let supabaseInstance: any = null;
let msgSupabaseInstance: any = null;

export const initSupabase = () => {
  if (!supabaseInstance) {
    if (!supabaseUrl || !supabaseKey) console.error('Supabase main env vars missing!');
    supabaseInstance = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseInstance;
};

export const initMsgSupabase = () => {
  if (!msgSupabaseInstance) {
    if (!msgUrl || !msgKey) console.error('Supabase messaging env vars missing!');
    msgSupabaseInstance = createClient(msgUrl, msgKey);
  }
  return msgSupabaseInstance;
};

// Singleton cache for teacher data
let cachedTeacher: any = null;
let authPromise: Promise<any> | null = null;

export const checkAuth = async () => {
  if (cachedTeacher) return cachedTeacher;
  
  // Try loading from localStorage for instant boot
  const stored = localStorage.getItem('teacherProfile');
  if (stored) {
    try {
      cachedTeacher = JSON.parse(stored);
      return cachedTeacher; // Return instantly for UI speed
    } catch (e) {}
  }
  
  // Deduplicate inflight requests
  if (authPromise) return authPromise;

  authPromise = (async () => {
    const supabase = initSupabase();
    const emailFromStorage = localStorage.getItem('teacherEmail');
    const email = emailFromStorage ? emailFromStorage.toLowerCase() : null;

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
      localStorage.setItem('teacherProfile', JSON.stringify(data));
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

export const setSession = (email: string) => {
  localStorage.setItem('teacherEmail', email.toLowerCase());
  cachedTeacher = null;
  authPromise = null;
};

export const logout = async () => {
  const supabase = initSupabase();
  await supabase.auth.signOut();
  localStorage.removeItem('teacherEmail');
  localStorage.removeItem('teacherProfile');
  cachedTeacher = null;
  authPromise = null;
  // Clear any data caches too
  const keys = Object.keys(sessionStorage);
  keys.forEach(k => { if (k.startsWith('cache:')) sessionStorage.removeItem(k); });
};
