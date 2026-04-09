import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { initSupabase } from '../auth-check';

const C = {
  purple: '#6366f1',
  bg: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  red: '#ef4444',
  green: '#10b981'
};

const ResetPassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [isSessionValid, setIsSessionValid] = useState(true);
  
  const navigate = useNavigate();
  const supabase = initSupabase();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (!session) { setIsSessionValid(false); setMessage({ type: 'error', text: 'Invalid link' }); }
    });
  }, [supabase.auth]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword !== confirmPassword) { notify('error', 'Check passwords'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) notify('error', error.message);
      else { notify('success', '✓ Updated!'); setTimeout(() => navigate('/login'), 1500); }
    } catch { notify('error', 'Error'); }
    finally { setLoading(false); }
  };

  const notify = (type: string, text: string) => setMessage({ type, text });

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
           <h1 style={{ fontSize: 24, fontWeight: 900, color: C.text, margin: 0 }}>Reset Securely</h1>
           <p style={{ color: C.muted, fontWeight: 700, fontSize: 13, marginTop: 4 }}>Enter your new teacher password</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 24, padding: 24, border: '1px solid #f1f5f9', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
          {isSessionValid ? (
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
               <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New Password" style={{ padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 14, fontWeight: 700, outline: 'none' }} />
               <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm Password" style={{ padding: 14, borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 14, fontWeight: 700, outline: 'none' }} />
               
               {message.text && (
                 <div style={{ fontSize: 13, fontWeight: 800, color: message.type === 'error' ? C.red : C.green, textAlign: 'center' }}>{message.text}</div>
               )}

               <button type="submit" disabled={loading} style={{ background: C.purple, color: '#fff', padding: 16, borderRadius: 14, border: 'none', fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 8px 20px rgba(99,102,241,0.3)' }}>{loading ? 'Wait...' : 'Save Password'}</button>
            </form>
          ) : (
             <div style={{ textAlign: 'center' }}><p style={{ color: C.red, fontWeight: 800 }}>Invalid Link</p><Link to="/login" style={{ fontSize: 14, color: C.purple, textDecoration: 'none', fontWeight: 800 }}>← Go Back</Link></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
