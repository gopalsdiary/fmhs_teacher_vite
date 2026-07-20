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
      const parsed = JSON.parse(stored);
      if (parsed && parsed.allAssignments && Array.isArray(parsed.allAssignments)) {
        cachedTeacher = parsed;
        return cachedTeacher; // Return instantly for UI speed
      }
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
      // 1. Primary Source: teacher_database profile data
      let dbData: any = null;
      const { data: d1 } = await supabase
        .from('teacher_database')
        .select('*')
        .ilike('teacher_email_id', email)
        .maybeSingle();

      dbData = d1;

      if (!dbData && !isNaN(Number(email))) {
        const { data: d2 } = await supabase
          .from('teacher_database')
          .select('*')
          .eq('iid', Number(email))
          .maybeSingle();
        dbData = d2;
      }

      // 2. Secondary Source: admin_teacher for allAssignments or extra permissions
      let adminData: any = null;

      const { data: a1 } = await supabase
        .from('admin_teacher')
        .select('*')
        .ilike('teacher_email', email)
        .maybeSingle();
      adminData = a1;

      if (!adminData && dbData?.iid) {
        const { data: a2 } = await supabase
          .from('admin_teacher')
          .select('*')
          .eq('iid', dbData.iid)
          .maybeSingle();
        adminData = a2;
      }

      if (!dbData && !adminData) {
        localStorage.removeItem('teacherEmail');
        localStorage.removeItem('teacherProfile');
        authPromise = null;
        return null;
      }

      // teacher_database is primary source for teacher_name_en, access_class, access_section
      const combinedData = {
        ...(adminData || {}),
        ...(dbData || {}),
        teacher_name_en: dbData?.teacher_name_en || adminData?.teacher_name_en || adminData?.teacher_name || email.split('@')[0].toUpperCase(),
        access_class: dbData?.access_class || adminData?.access_class || '',
        access_section: dbData?.access_section || adminData?.access_section || '',
        allAssignments: adminData?.allAssignments || dbData?.allAssignments || null,
        teacher_email: email,
        teacher_email_id: dbData?.teacher_email_id || email,
        iid: dbData?.iid || adminData?.iid
      };

      // Extract array elements from access_class and access_section JSONB
      let classes: any[] = [];
      let sections: any[] = [];

      try {
        const cVal = combinedData.access_class;
        classes = Array.isArray(cVal) ? cVal : (typeof cVal === 'string' ? JSON.parse(cVal) : [cVal]);
      } catch (e) {
        classes = combinedData.access_class ? [combinedData.access_class] : [];
      }

      try {
        const sVal = combinedData.access_section;
        sections = Array.isArray(sVal) ? sVal : (typeof sVal === 'string' ? JSON.parse(sVal) : [sVal]);
      } catch (e) {
        sections = combinedData.access_section ? [combinedData.access_section] : [];
      }

      // Flatten arrays and generate allAssignments
      const assignments: any[] = [];
      const maxLength = Math.max(classes.length, sections.length);
      for (let i = 0; i < maxLength; i++) {
        const c = classes[i] !== undefined ? String(classes[i]) : (classes[0] !== undefined ? String(classes[0]) : '');
        const s = sections[i] !== undefined ? String(sections[i]) : (sections[0] !== undefined ? String(sections[0]) : '');
        if (c && s) {
          assignments.push({ access_class: c, access_section: s });
        }
      }

      // De-duplicate assignments
      const uniqueAssignments = assignments.filter((item, index, self) =>
        index === self.findIndex((t) => t.access_class === item.access_class && t.access_section === item.access_section)
      );

      combinedData.allAssignments = uniqueAssignments.length > 0 ? uniqueAssignments : (combinedData.allAssignments || null);
      // Set access_class and access_section properties to the first element if available for single-string fallbacks
      combinedData.access_class = uniqueAssignments[0]?.access_class || '';
      combinedData.access_section = uniqueAssignments[0]?.access_section || '';

      cachedTeacher = combinedData;
      localStorage.setItem('teacherProfile', JSON.stringify(combinedData));
      authPromise = null;
      return combinedData;
    } catch (e) {
      console.error('Auth check failed:', e);
      authPromise = null;
      return null;
    }
  })();

  return authPromise;
};

export const setSession = (email: string, _teacherProfile?: any) => {
  const cleanEmail = email.trim().toLowerCase();
  localStorage.setItem('teacherEmail', cleanEmail);
  localStorage.removeItem('teacherProfile'); // Clear cache so checkAuth fetches fresh admin_teacher data
  cachedTeacher = null;
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
