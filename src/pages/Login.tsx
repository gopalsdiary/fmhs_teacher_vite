import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { initSupabase } from '../auth-check';

const C = { purple: '#6366f1', bg: '#f8fafc', text: '#0f172a', muted: '#64748b' };

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
    supabase.auth.getSession().then(({ data: { session } }: any) => { if (session) navigate('/dashboard'); });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setMsg({ type: 'error', text: 'All fields required' });
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setMsg({ type: 'error', text: 'Invalid Info' }); setLoading(false); }
    else { localStorage.setItem('teacherEmail', email); navigate('/dashboard'); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>🏛️</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: C.text, margin: 0 }}>Feni Model High</h1>
          <p style={{ fontSize: 13, color: C.muted, fontWeight: 700, marginTop: 4 }}>Teacher Access Portal</p>
        </div>

        <div style={{ background: '#fff', borderRadius: 28, padding: 28, border: '1px solid #f1f5f9', boxShadow: '0 10px 40px rgba(0,0,0,0.03)' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 14, borderRadius: 14, border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', fontSize: 14, fontWeight: 700 }} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: 14, borderRadius: 14, border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', fontSize: 14, fontWeight: 700 }} />
            
            {msg.text && <p style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', textAlign: 'center', margin: 0 }}>{msg.text}</p>}

            <button disabled={loading} style={{ background: C.purple, color: '#fff', padding: 16, borderRadius: 14, border: 'none', fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 10px 25px rgba(99,102,241,0.35)', marginTop: 10 }}>{loading ? 'Entering...' : 'Sign In Portal'}</button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
