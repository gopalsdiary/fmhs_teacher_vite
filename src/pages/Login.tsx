import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { initSupabase } from '../auth-check';

const C = { 
  primary: '#f97316', 
  secondary: '#fb923c',
  bg: '#fff7ed', 
  text: '#431407', 
  muted: '#9a3412',
  inputBg: '#fff' 
};

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const navigate = useNavigate();
  const supabase = initSupabase();

  useEffect(() => {
    const saved = localStorage.getItem('rememberedEmail');
    if (saved) setEmail(saved);
    supabase.auth.getSession().then(({ data: { session } }: any) => { 
      if (session && localStorage.getItem('teacherEmail')) navigate('/dashboard'); 
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setMsg({ type: 'error', text: 'All fields required' });
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMsg({ type: 'error', text: 'Invalid Info' }); setLoading(false); }
    else { 
      // Use helper to set session and clear stale promises
      const { setSession } = await import('../auth-check');
      setSession(email);
      navigate('/dashboard'); 
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 20 }}>
      {/* Decorative items */}
      <div style={{ position: 'fixed', top: -100, right: -100, width: 300, height: 300, borderRadius: '50%', background: 'linear-gradient(135deg, #ffedd5 0%, transparent 100%)', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: -50, left: -50, width: 200, height: 200, borderRadius: '50%', background: 'linear-gradient(135deg, #ffedd5 0%, transparent 100%)', zIndex: 0 }} />

      <div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, background: '#fff', margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48, boxShadow: '0 10px 30px rgba(249,115,22,0.1)', border: '1px solid #ffedd5' }}>🏛️</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: C.text, margin: 0, letterSpacing: -0.5 }}>FMHS Teacher Portal</h1>
          <p style={{ fontSize: 13, color: C.muted, fontWeight: 800, marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 }}>শিক্ষক এক্সেস পোর্টাল</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 32, padding: '36px 28px', border: '1px solid #ffedd5', boxShadow: '0 20px 50px rgba(67,20,7,0.05)' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 900, color: C.muted, marginLeft: 4 }}>ইমেইল অ্যাড্রেস</label>
              <input 
                type="email" 
                placeholder="teacher@fmhs.edu.bd" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                style={{ padding: '16px 18px', borderRadius: 16, border: '1px solid #f1f5f9', background: '#f8fafc', outline: 'none', fontSize: 14, fontWeight: 700, color: C.text, transition: 'all 0.2s' }} 
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: 11, fontWeight: 900, color: C.muted, marginLeft: 4 }}>পাসওয়ার্ড</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                style={{ padding: '16px 18px', borderRadius: 16, border: '1px solid #f1f5f9', background: '#f8fafc', outline: 'none', fontSize: 14, fontWeight: 700, color: C.text, transition: 'all 0.2s' }} 
              />
            </div>
            
            {msg.text && (
              <div style={{ padding: '12px', background: '#fef2f2', borderRadius: 12, border: '1px solid #fee2e2' }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', textAlign: 'center', margin: 0 }}>⚠️ {msg.text}</p>
              </div>
            )}

            <button 
              disabled={loading} 
              style={{ 
                background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, 
                color: '#fff', 
                padding: '18px', 
                borderRadius: 18, 
                border: 'none', 
                fontWeight: 900, 
                fontSize: 16, 
                cursor: 'pointer', 
                boxShadow: '0 10px 25px rgba(249,115,22,0.3)', 
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10
              }}
            >
              {loading ? (
                <>
                  <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  প্রবেশ করছি...
                </>
              ) : 'পোর্টালে প্রবেশ করুন'}
            </button>
          </form>
          
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <p style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>পাসওয়ার্ড ভুলে গেলে অ্যাডমিনের সাথে যোগাযোগ করুন</p>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <p style={{ fontSize: 11, color: C.muted, fontWeight: 800 }}>© 2026 FENI MODEL HIGH SCHOOL</p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { border-color: ${C.primary} !important; background: #fff !important; box-shadow: 0 0 0 4px rgba(249,115,22,0.1); }
      `}</style>
    </div>
  );
};

export default Login;
