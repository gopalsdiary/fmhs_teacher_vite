// Supabase configuration
console.log('auth-check.js loading...');
const supabaseUrl = 'https://rtfefxghfbtirfnlbucb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0ZmVmeGdoZmJ0aXJmbmxidWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1MDg3OTcsImV4cCI6MjA1NjA4NDc5N30.fb7_myCmFzbV7WPNjFN_NEl4z0sOmRCefnkQbk6c10w';

// Wait for Supabase library to load
let supabaseClient = null;

function initSupabase() {
  if (!supabaseClient && window.supabase && window.supabase.createClient) {
    // Keep a reference to the library (which has createClient) so we can preserve it
    const supabaseLib = window.supabase;
    supabaseClient = supabaseLib.createClient(supabaseUrl, supabaseKey);

    // Export the initialized client and preserve the library API
    try {
      // Set the convenience alias for the initialized client
      window.supabaseClient = supabaseClient;
      // For backward compatibility, set window.supabase to the client but restore createClient
      // so code that checks for window.supabase.createClient still works
      window.supabase = supabaseClient;
      if (supabaseLib && typeof supabaseLib.createClient === 'function') {
        window.supabase.createClient = supabaseLib.createClient.bind(supabaseLib);
      }
      console.log('Supabase client initialized (window.supabase is client) and library API preserved');
    } catch (e) {
      console.warn('Failed to export supabase client to window:', e);
    }

    // Handle invalid refresh token errors on initialization
    supabaseClient.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session ? 'Session exists' : 'No session');
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        // Clear any invalid tokens from localStorage
        try {
          localStorage.removeItem('sb-rtfefxghfbtirfnlbucb-auth-token');
        } catch (e) {
          console.warn('Failed to clear token:', e);
        }
      }
    });
  }
  return supabaseClient;
}

// Check authentication and get teacher data
async function checkAuth() {
  try {
    console.log('Starting auth check...');
    
    // Initialize Supabase if not already done
    const client = initSupabase();
    if (!client) {
      console.error('Supabase client not available');
      throw new Error('Database connection failed');
    }
    
    // Get email from localStorage (set from index.html after login)
    const teacherEmail = localStorage.getItem('teacherEmail');
    console.log('Teacher email from localStorage:', teacherEmail);
    
    if (!teacherEmail) {
      console.log('No teacher email found, redirecting to login');
      window.location.href = 'index.html';
      return null;
    }

    console.log('Fetching teacher data from database...');
    // Fetch teacher data from admin_teacher table (may return multiple rows for multiple class-section assignments)
    const { data: teacherData, error } = await client
      .from('admin_teacher')
      .select('*')
      .eq('teacher_email', teacherEmail);

    console.log('Database response:', { teacherData, error });

    // Only show error if there's a database error
    if (error) {
      console.error('Error fetching teacher data:', error);
      alert('Teacher access not found. Please contact admin.');
      window.location.href = 'index.html';
      return null;
    }

    // If no data returned (teacher not in database)
    if (!teacherData || teacherData.length === 0) {
      console.warn('No teacher data found for email:', teacherEmail);
      alert('Teacher access not found. Please contact admin.');
      window.location.href = 'index.html';
      return null;
    }

    console.log('Teacher data found:', teacherData.length, 'record(s)');
    // Return all teacher data (array of assignments) if multiple class-sections
    // or single object with all classes merged
    // For multiple assignments, merge them into a single teacher object with all classes
    if (teacherData.length > 1) {
      const mergedData = {
        ...teacherData[0], // Base teacher info from first record
        access_class: teacherData.map(t => t.access_class).filter(c => c).join(', '),
        access_section: teacherData.map(t => t.access_section).filter(s => s).join(', '),
        allAssignments: teacherData // Keep all assignments for reference
      };
      return mergedData;
    }
    
    // Return single teacher data even if access_class/access_section are not assigned
    // Dashboard will handle display logic based on these fields
    return teacherData[0];
  } catch (err) {
    console.error('Authentication error:', err);
    window.location.href = 'index.html';
    return null;
  }
}

// Logout function
function logout() {
  localStorage.removeItem('teacherEmail');
  window.location.href = 'index.html';
}

// Get Supabase client
function getSupabaseClient() {
  return initSupabase();
}

// Export for use in other files
window.authCheck = {
  checkAuth,
  logout,
  get supabase() { return initSupabase(); },
  getSupabaseClient
};

// Try to initialize Supabase now so legacy pages can use `supabase.from(...)` directly
try {
  const client = initSupabase();
  if (client) {
    console.log('Supabase auto-initialized on load');
  }
} catch (e) {
  console.warn('Auto initSupabase failed:', e);
}

console.log('auth-check.js loaded successfully, window.authCheck available');
