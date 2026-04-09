// teacher_dashboard.ts - compiled to teacher_login/dist/teacher_dashboard.js

// Minimal types for the teacher data we use
interface TeacherData {
  teacher_email?: string;
  access_class?: string;
  access_section?: string;
  iid?: string;
  teacher_id?: string;
  [key: string]: any;
}

declare global {
  interface Window { authCheck?: any; }
}

let teacherData: TeacherData | null = null;
let deferredInstallPrompt: any = null;
let isAppInstalled = false;

function checkIfInstalled() {
  if ((window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (window.navigator as any).standalone === true) {
    isAppInstalled = true;
    return true;
  }
  return false;
}

window.addEventListener('beforeinstallprompt', (e: Event & { prompt?: any; userChoice?: any }) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const section = document.getElementById('installSection');
  if (section && document.getElementById('dashboard') && (document.getElementById('dashboard')!.style.display !== 'none') && !isAppInstalled) {
    section.style.display = 'block';
  }
});

window.addEventListener('appinstalled', () => {
  isAppInstalled = true;
  const section = document.getElementById('installSection');
  if (section) {
    section.classList.add('install-installed');
    const title = document.getElementById('installTitle');
    const desc = document.getElementById('installDesc');
    const btnText = document.getElementById('installBtnText');
    const btn = document.getElementById('installActionBtn') as HTMLButtonElement | null;
    if (title) title.innerHTML = '<i class="fas fa-check-circle"></i> Installation Successful!';
    if (desc) desc.textContent = 'App has been installed. You can now use it from your home screen.';
    if (btnText) btnText.textContent = 'Installed';
    if (btn) btn.disabled = true;
    setTimeout(() => { section.style.display = 'none'; }, 3000);
  }
});

function hideMessages() {
  const e = document.getElementById('errorMessage');
  const s = document.getElementById('successMessage');
  if (e) e.style.display = 'none';
  if (s) s.style.display = 'none';
}

function showError(message: string) {
  const errorDiv = document.getElementById('errorMessage');
  if (errorDiv) { errorDiv.textContent = message; errorDiv.style.display = 'block'; }
  const successDiv = document.getElementById('successMessage'); if (successDiv) successDiv.style.display = 'none';
}

function showSuccess(message: string) {
  const successDiv = document.getElementById('successMessage');
  if (successDiv) { successDiv.textContent = message; successDiv.style.display = 'block'; }
  const errorDiv = document.getElementById('errorMessage'); if (errorDiv) errorDiv.style.display = 'none';
}

async function changePassword(ev?: Event) {
  if (ev && ev.preventDefault) ev.preventDefault();
  hideMessages();

  const currentPassword = (document.getElementById('currentPassword') as HTMLInputElement | null)?.value.trim() || '';
  const newPassword = (document.getElementById('newPassword') as HTMLInputElement | null)?.value.trim() || '';
  const retypePassword = (document.getElementById('retypePassword') as HTMLInputElement | null)?.value.trim() || '';
  const submitBtn = document.getElementById('submitBtn') as HTMLButtonElement | null;

  if (!currentPassword || !newPassword || !retypePassword) { showError('Please fill in all fields'); return; }
  if (newPassword.length < 6) { showError('New password must be at least 6 characters long'); return; }
  if (newPassword !== retypePassword) { showError('New passwords do not match'); return; }
  if (currentPassword === newPassword) { showError('New password must be different from current password'); return; }

  try {
    if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Changing...'; }

    const supabase = (window as any).authCheck.getSupabaseClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) throw new Error('Unable to verify current user');
    const userEmail = userData.user.email;

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: userEmail, password: currentPassword });
    if (signInError) throw new Error('Current password is incorrect');

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw new Error(updateError.message || 'Failed to update password');

    showSuccess('Password changed successfully!');
    (document.getElementById('changePasswordForm') as HTMLFormElement | null)?.reset();
    setTimeout(closeModal, 2000);
  } catch (error: any) {
    console.error('Password change error:', error);
    showError(error?.message || 'Failed to change password. Please try again.');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<i class="fas fa-check"></i> Change Password'; }
  }
}

function openSettingsModal() {
  const modal = document.getElementById('changePasswordModal');
  if (modal) modal.style.display = 'block';
  (document.getElementById('changePasswordForm') as HTMLFormElement | null)?.reset();
  hideMessages();
}

function closeModal() {
  const modal = document.getElementById('changePasswordModal');
  if (modal) modal.style.display = 'none';
  (document.getElementById('changePasswordForm') as HTMLFormElement | null)?.reset();
  hideMessages();
}

function logout() {
  if (confirm('Are you sure you want to logout?')) {
    (window as any).authCheck.logout();
  }
}

function disableClassSpecificElements() {
  const alertMessage = 'Class and section not assigned. Please contact admin.';
  const studentListCard = document.getElementById('studentListCard');
  if (studentListCard) {
    studentListCard.style.opacity = '0.5';
    studentListCard.style.cursor = 'not-allowed';
    studentListCard.onclick = (e) => { e.preventDefault(); alert(alertMessage); };
  }
  const classPhotoCard = document.getElementById('classPhotoCard');
  if (classPhotoCard) {
    classPhotoCard.style.opacity = '0.5';
    classPhotoCard.style.cursor = 'not-allowed';
    classPhotoCard.onclick = (e) => { e.preventDefault(); alert(alertMessage); };
  }
  const attendanceCard = document.querySelector('a[href="attendence.html"]') as HTMLElement | null;
  if (attendanceCard) {
    attendanceCard.style.opacity = '0.5';
    attendanceCard.style.cursor = 'not-allowed';
    attendanceCard.onclick = (e) => { e.preventDefault(); alert(alertMessage); };
  }
}

async function initDashboard() {
  try {
    teacherData = await (window as any).authCheck.checkAuth();
    if (!teacherData) { console.error('No teacher data returned'); return; }

    const teacherEmailEl = document.getElementById('teacherEmail');
    const teacherClassEl = document.getElementById('teacherClass');
    const teacherSectionEl = document.getElementById('teacherSection');

    if (teacherEmailEl) teacherEmailEl.textContent = teacherData.teacher_email || 'N/A';
    if (teacherClassEl) teacherClassEl.textContent = teacherData.access_class || 'N/A';
    if (teacherSectionEl) teacherSectionEl.textContent = teacherData.access_section || 'N/A';

    if (teacherData.access_class && teacherData.access_section) {
      localStorage.setItem('teacherClass', teacherData.access_class);
      localStorage.setItem('teacherSection', teacherData.access_section);
    } else {
      localStorage.removeItem('teacherClass');
      localStorage.removeItem('teacherSection');
    }

    const hasClassAccess = !!(teacherData.access_class && teacherData.access_section);
    const dashboardTitle = document.getElementById('dashboardTitle');
    if (dashboardTitle) dashboardTitle.textContent = hasClassAccess ? 'Class Teacher Dashboard' : 'Teacher Dashboard';

    if (!hasClassAccess) disableClassSpecificElements();
    else {
      const studentListCard = document.getElementById('studentListCard') as HTMLAnchorElement | null;
      if (studentListCard) studentListCard.href = `class_data.html?class=${teacherData.access_class}&section=${teacherData.access_section}`;
    }

    try {
      const teacherInfoCard = document.getElementById('teacherInfoCard') as HTMLAnchorElement | null;
      const tid = teacherData.iid ?? teacherData.teacher_id ?? '';
      if (teacherInfoCard) {
        if (tid) teacherInfoCard.href = `https://fenimodel.netlify.app/login/teacher_view.html?iid=${encodeURIComponent(tid)}`;
        else {
          teacherInfoCard.style.opacity = '0.6';
          teacherInfoCard.onclick = (ev) => { ev.preventDefault(); alert('Teacher IID not available. Please contact admin.'); };
        }
      }
    } catch (e) { console.warn('Failed to set teacher info link', e); }

    const loading = document.getElementById('loading');
    const dashboard = document.getElementById('dashboard');
    if (loading) loading.style.display = 'none';
    if (dashboard) dashboard.style.display = 'block';

    try {
      if (checkIfInstalled()) {
        const section = document.getElementById('installSection'); if (section) section.style.display = 'none';
      } else {
        const section = document.getElementById('installSection');
        const btn = document.getElementById('installActionBtn') as HTMLButtonElement | null;
        if (section && btn) {
          if (deferredInstallPrompt) section.style.display = 'block';
          btn.addEventListener('click', async (ev) => {
            ev.preventDefault();
            if (!deferredInstallPrompt) { alert('Installation is not available at this time. Try using Chrome or Edge browser.'); return; }
            const origText = (document.getElementById('installBtnText')?.textContent) || 'Install Now';
            (document.getElementById('installBtnText') as HTMLElement | null)!.textContent = 'Installing...';
            btn.disabled = true;
            try {
              deferredInstallPrompt.prompt();
              const choice = await deferredInstallPrompt.userChoice;
              if (choice.outcome === 'accepted') {
                // appinstalled will handle UI
              } else {
                (document.getElementById('installBtnText') as HTMLElement | null)!.textContent = origText;
                btn.disabled = false;
              }
            } catch (e) {
              console.error('Install error:', e);
              (document.getElementById('installBtnText') as HTMLElement | null)!.textContent = origText;
              btn.disabled = false;
            }
            deferredInstallPrompt = null;
          });
        }
      }
    } catch (e) { console.warn('Failed to wire install section', e); }

  } catch (error) {
    console.error('Error initializing dashboard:', error);
    alert('Error loading dashboard: ' + ((error as any)?.message || 'Unknown error. Please try again.'));
    window.location.href = 'index.html';
  }
}

async function waitForAuthSystem() {
  // Wait until Supabase exists
  for (let i=0;i<100;i++) {
    if ((window as any).supabase && (window as any).supabase.createClient) break;
    if (i === 99) { alert('Failed to load Supabase library. Please check your internet connection and refresh.'); return; }
    await new Promise(r => setTimeout(r, 50));
  }

  // Wait for auth-check to expose window.authCheck
  for (let i=0;i<100;i++) {
    if ((window as any).authCheck && (window as any).authCheck.checkAuth) { await initDashboard(); return; }
    await new Promise(r => setTimeout(r, 50));
  }

  alert('Failed to load authentication system. Please refresh the page.');
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => console.log('Service Worker registered:', reg.scope)).catch(err => console.warn('Service Worker registration failed:', err));
  });
}

// Make functions available globally for existing inline handlers
(window as any).openSettingsModal = openSettingsModal;
(window as any).closeModal = closeModal;
(window as any).logout = logout;
(window as any).changePassword = changePassword;

window.addEventListener('DOMContentLoaded', waitForAuthSystem);

export {};
