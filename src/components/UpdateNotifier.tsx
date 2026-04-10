import React, { useState, useEffect } from 'react';

const UpdateNotifier: React.FC = () => {
  const [show, setShow] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const handleUpdateFound = () => {
      setShow(true);
    };

    window.addEventListener('app-update-found', handleUpdateFound);
    return () => window.removeEventListener('app-update-found', handleUpdateFound);
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);
    // Give it a tiny bit of time for the animation
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10000,
      width: '90%',
      maxWidth: '400px',
      pointerEvents: 'none'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '16px 20px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        border: '1px solid rgba(249, 115, 22, 0.2)',
        pointerEvents: 'auto',
        animation: 'slideDown 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            background: '#fff7ed', 
            color: '#f97316', 
            width: '40px', 
            height: '40px', 
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px'
          }}>
            ✨
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
              Update Available
            </h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              A new version is ready with improvements.
            </p>
          </div>
        </div>
        
        <button 
          onClick={handleUpdate}
          disabled={isUpdating}
          style={{ 
            width: '100%',
            padding: '10px',
            borderRadius: '10px',
            border: 'none',
            background: '#f97316',
            color: '#fff',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(249,115,22,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s'
          }}
        >
          {isUpdating ? (
            <>
              <span className="spinner"></span>
              Updating...
            </>
          ) : (
            'Update Now'
          )}
        </button>
      </div>

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%) translateX(-50%); opacity: 0; }
          to { transform: translateY(0) translateX(-50%); opacity: 1; }
        }
        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default UpdateNotifier;
