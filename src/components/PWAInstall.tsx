import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PWAInstall: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPopup, setShowPopup] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // If we are already on dashboard, show it immediately (case for fresh login)
      // Otherwise it will show when user navigates to dashboard
      if (window.location.pathname === '/dashboard') {
        checkAndShow();
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    
    // Check if app is already installed
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
      setShowPopup(false);
      localStorage.setItem('pwa_installed', 'true');
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (location.pathname === '/dashboard') {
      checkAndShow();
    }
  }, [location.pathname, deferredPrompt]);

  const checkAndShow = () => {
    const isInstalled = localStorage.getItem('pwa_installed') === 'true' || 
                        window.matchMedia('(display-mode: standalone)').matches;
    
    // If not installed and prompt is available, show it
    if (!isInstalled && deferredPrompt) {
      setShowPopup(true);
    }
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      localStorage.setItem('pwa_installed', 'true');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // Reset state so it can show again on reload/navigation if they didn't install
    setDeferredPrompt(null);
    setShowPopup(false);
  };

  const handleDismiss = () => {
    setShowPopup(false);
  };

  if (!showPopup) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'none',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
      padding: '0 16px 30px',
      pointerEvents: 'none'
    }}>
      <div style={{
        pointerEvents: 'auto',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        width: 'calc(100% - 32px)',
        maxWidth: 360,
        borderRadius: 20,
        padding: '12px 16px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        border: '1px solid rgba(255,255,255,0.5)',
        animation: 'slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      }}>
        <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #f97316, #fb923c)', color: '#fff', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0, boxShadow: '0 4px 10px rgba(249,115,22,0.3)' }}>🏛️</div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 900, color: '#431407' }}>Install Teacher App</h3>
          <p style={{ margin: 0, fontSize: 10, color: '#9a3412', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Fast, offline & light</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button 
            onClick={handleDismiss}
            style={{ border: 'none', background: '#f1f5f9', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#64748b' }}
          >
            ×
          </button>
          <button 
            onClick={handleInstall}
            style={{ padding: '8px 16px', borderRadius: 12, border: 'none', background: '#f97316', color: '#fff', fontWeight: 900, cursor: 'pointer', fontSize: 12, boxShadow: '0 4px 12px rgba(249,115,22,0.2)' }}
          >
            Install
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default PWAInstall;
