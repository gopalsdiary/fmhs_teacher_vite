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
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const navigate = useNavigate();
  const supabase = initSupabase();

  useEffect(() => {
    const saved = localStorage.getItem('rememberedEmail');
    if (saved) setEmail(saved);
    const storedEmail = localStorage.getItem('teacherEmail');
    if (storedEmail) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      return setMsg({ type: 'error', text: 'ইমেইল ও পাসওয়ার্ড উভয়ই প্রদান করুন' });
    }

    setLoading(true);
    try {
      // Query teacher_database table by teacher_email_id
      const { data: teacher, error } = await supabase
        .from('teacher_database')
        .select('*')
        .ilike('teacher_email_id', cleanEmail)
        .maybeSingle();

      if (error) {
        console.error('Teacher login error:', error);
        setMsg({ type: 'error', text: 'লগইন করতে ব্যর্থ হয়েছে' });
        setLoading(false);
        return;
      }

      if (!teacher) {
        setMsg({ type: 'error', text: 'ইমেইল বা পাসওয়ার্ড সঠিক নয়' });
        setLoading(false);
        return;
      }

      // login_password empty check (if database login_password is empty or null)
      const dbPassword = teacher.login_password ? String(teacher.login_password).trim() : '';
      if (!dbPassword) {
        setMsg({ type: 'error', text: 'এই অ্যাকাউন্টের পাসওয়ার্ড সেট করা নেই। অফিসে যোগাযোগ করুন।' });
        setLoading(false);
        return;
      }

      // Password comparison
      if (dbPassword !== cleanPassword) {
        setMsg({ type: 'error', text: 'ইমেইল বা পাসওয়ার্ড সঠিক নয়' });
        setLoading(false);
        return;
      }

      // Successful login
      localStorage.setItem('rememberedEmail', cleanEmail);
      const { setSession } = await import('../auth-check');
      setSession(teacher.teacher_email_id || cleanEmail, teacher);
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err);
      setMsg({ type: 'error', text: 'লগইন করতে ব্যর্থ হয়েছে' });
    } finally {
      setLoading(false);
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
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  style={{ width: '100%', padding: '16px 48px 16px 18px', borderRadius: 16, border: '1px solid #f1f5f9', background: '#f8fafc', outline: 'none', fontSize: 14, fontWeight: 700, color: C.text, transition: 'all 0.2s', boxSizing: 'border-box' }} 
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: 15, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', fontSize: 18, color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                >
                  {showPassword ? '👁️' : '🙈'}
                </button>
              </div>
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
            <p style={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>পাসওয়ার্ড ভুলে গেলে অফিসে যোগাযোগ করুন</p>
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
