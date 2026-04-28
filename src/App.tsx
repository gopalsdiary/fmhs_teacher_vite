import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { checkAuth } from './auth-check';

// Lazy load all pages for code splitting
const Login         = lazy(() => import('./pages/Login'));
const Dashboard     = lazy(() => import('./pages/Dashboard'));
const Attendance    = lazy(() => import('./pages/Attendance'));
const StudentList   = lazy(() => import('./pages/StudentList'));
const StudentDetails = lazy(() => import('./pages/StudentDetails'));
const StudentPhotos = lazy(() => import('./pages/StudentPhotos'));
const CallGuardian  = lazy(() => import('./pages/CallGuardian'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Messaging     = lazy(() => import('./pages/Messaging'));
const StudentChat   = lazy(() => import('./pages/StudentChat'));
const MyInfo        = lazy(() => import('./pages/MyInfo'));
import PWAInstall from './components/PWAInstall';
import UpdateNotifier from './components/UpdateNotifier';

// Minimal inline spinner – no external dependency
const Spinner = () => (
  <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#f8faff' }}>
    <div style={{ width: 44, height: 44, border: '4px solid rgba(102,126,234,0.2)', borderTop: '4px solid #667eea', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <p style={{ color: '#667eea', fontWeight: 600, fontSize: 14 }}>Loading…</p>
  </div>
);
const OfflineStatus = () => {
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    // Prevent refresh while offline logic
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!navigator.onLine) {
        e.preventDefault();
        e.returnValue = ''; // Shows the browser confirmation dialog
      }
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (!navigator.onLine) {
        // F5, Ctrl+R, Cmd+R
        if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key === 'r')) {
          e.preventDefault();
          alert('Refreshing while offline is disabled to prevent data loss. Please wait for connection.');
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('keydown', handleKeydown);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleKeydown);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      background: '#ef4444', color: 'white', padding: '8px 16px', borderRadius: 20,
      fontSize: 12, fontWeight: 700, boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
      zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8,
      animation: 'slideUp 0.3s ease-out'
    }}>
      <span style={{ width: 8, height: 8, background: 'white', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
      Offline. Don't Refresh.
    </div>
  );
};

const App: React.FC = () => {
  // Kick off auth fetch immediately so it's cached by the time any page loads
  useEffect(() => {
    const email = localStorage.getItem('teacherEmail');
    if (email) checkAuth(); // fire-and-forget – warms the cache
  }, []);

  return (
    <Router>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/login"          element={<Login />} />
          <Route path="/dashboard"      element={<Dashboard />} />
          <Route path="/attendance"     element={<Attendance />} />
          <Route path="/students"       element={<StudentList />} />
          <Route path="/student/:iid"   element={<StudentDetails />} />
          <Route path="/photos"         element={<StudentPhotos />} />
          <Route path="/calls"          element={<CallGuardian />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/messages"       element={<Messaging />} />
          <Route path="/student-chat"   element={<StudentChat />} />
          <Route path="/my-info"        element={<MyInfo />} />
          <Route path="/"               element={<Navigate to="/login" replace />} />
          <Route path="*"               element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
      <PWAInstall />
      <UpdateNotifier />
      <OfflineStatus />
    </Router>
  );
};

export default App;
