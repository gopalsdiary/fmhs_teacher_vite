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
    const email = emailFromStorage ? emailFromStorage.trim().toLowerCase() : null;

    if (!email) {
      authPromise = null;
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('teacher_database')
        .select('*')
        .ilike('teacher_email_id', email)
        .maybeSingle();

      if (error || !data) {
        localStorage.removeItem('teacherEmail');
        localStorage.removeItem('teacherProfile');
        authPromise = null;
        return null;
      }

      const normalizedData = {
        ...data,
        teacher_email: data.teacher_email_id || data.teacher_email || email
      };

      cachedTeacher = normalizedData;
      localStorage.setItem('teacherProfile', JSON.stringify(normalizedData));
      authPromise = null;
      return normalizedData;
    } catch (e) {
      console.error('Auth check failed:', e);
      authPromise = null;
      return null;
    }
  })();

  return authPromise;
};

export const setSession = (email: string, teacherProfile?: any) => {
  const cleanEmail = email.trim().toLowerCase();
  localStorage.setItem('teacherEmail', cleanEmail);
  if (teacherProfile) {
    const normalized = {
      ...teacherProfile,
      teacher_email: teacherProfile.teacher_email_id || teacherProfile.teacher_email || cleanEmail
    };
    cachedTeacher = normalized;
    localStorage.setItem('teacherProfile', JSON.stringify(normalized));
  } else {
    cachedTeacher = null;
  }
  authPromise = null;
};

export const logout = async () => {
  localStorage.removeItem('teacherEmail');
  localStorage.removeItem('teacherProfile');
  cachedTeacher = null;
  authPromise = null;
  // Clear any data caches too
  const keys = Object.keys(sessionStorage);
  keys.forEach(k => { if (k.startsWith('cache:')) sessionStorage.removeItem(k); });
};
