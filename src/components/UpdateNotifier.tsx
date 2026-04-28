import React, { useState, useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';

const UpdateNotifier: React.FC = () => {
  const [needRefresh, setNeedRefresh] = useState(false);

  const updateSW = registerSW({
    onNeedRefresh() {
      setNeedRefresh(true);
    },
  });

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: 20,
      right: 20,
      zIndex: 10000,
      background: 'rgba(15, 23, 42, 0.9)',
      backdropFilter: 'blur(12px)',
      padding: '16px 20px',
      borderRadius: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.1)',
      animation: 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 24 }}>🚀</div>
        <div>
          <p style={{ margin: 0, color: '#fff', fontSize: 14, fontWeight: 900 }}>New Update Available!</p>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: 700 }}>Reload to get the latest features.</p>
        </div>
      </div>
      <button 
        onClick={() => updateSW(true)}
        style={{
          background: '#f97316',
          color: '#fff',
          border: 'none',
          padding: '10px 20px',
          borderRadius: 14,
          fontWeight: 900,
          fontSize: 13,
          cursor: 'pointer',
          boxShadow: '0 10px 20px rgba(249,115,22,0.3)'
        }}
      >
        RELOAD NOW
      </button>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default UpdateNotifier;
