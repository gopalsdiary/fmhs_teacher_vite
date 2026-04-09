import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { checkAuth, logout as authLogout, initSupabase } from '../auth-check';
import { cacheGet, cacheSet } from '../cache';

const C = {
  purple: '#6366f1',
  orange: '#f97316',
  blue: '#3b82f6',
  green: '#10b981',
  bg: '#f8fafc',
  text: '#0f172a',
  muted: '#64748b'
};

const Dashboard: React.FC = () => {
  const [teacher, setTeacher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth().then(d => {
      if (!d) navigate('/login');
      else { 
        setTeacher(d); 
        setLoading(false); 
        const supabase = initSupabase();
        const asgn = d.allAssignments || [{ access_class: d.access_class, access_section: d.access_section }];
        const cacheKey = `students:${d.access_class}:${d.access_section}`;
        if (!cacheGet(cacheKey)) {
          (async () => {
             let all: any[] = [];
             for (const a of asgn) {
               const { data } = await supabase.from('student_database').select('*').eq('active_class', a.access_class).eq('active_section', a.access_section).order('active_roll', { ascending: true });
               if (data) all = [...all, ...data];
             }
             const unique = all.filter((s, i, self) => i === self.findIndex(t => t.iid === s.iid));
             cacheSet(cacheKey, unique);
          })();
        }
      }
    });
  }, [navigate]);

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}><div style={{ width: 32, height: 32, border: '3px solid #eee', borderTopColor: C.purple, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;

  const apps = [
    { title: 'Student List', icon: '👥', to: '/students', color: C.purple },
    { title: 'Photos', icon: '📸', to: '/photos', color: C.orange },
    { title: 'Attendance', icon: '✅', to: '/attendance', color: C.green },
    { title: 'Call Guardian', icon: '📞', to: '/calls', color: C.blue },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Dynamic Banner */}
      <div style={{ background: `linear-gradient(135deg, ${C.purple}, ${C.blue})`, padding: '40px 20px', borderRadius: '0 0 40px 40px', boxShadow: '0 15px 35px rgba(99,102,241,0.2)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.5 }}>FMHS Teacher Portal</p>
              <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 900, margin: '4px 0 0' }}>Dashboard</h1>
            </div>
            <button onClick={() => { if(confirm('Logout?')) { authLogout(); navigate('/login'); } }} style={{ width: 40, height: 40, borderRadius: 14, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 18 }}>🚪</button>
          </div>
          <div style={{ marginTop: 28, padding: '16px 20px', background: 'rgba(255,255,255,0.15)', borderRadius: 20, backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 15 }}>
             <div style={{ width: 48, height: 48, borderRadius: 16, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👨‍🏫</div>
             <div>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 900, margin: 0 }}>{teacher?.teacher_email?.split('@')[0].toUpperCase()}</p>
                <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 700, margin: '2px 0 0' }}>Class: {teacher?.access_class} • Sec: {teacher?.access_section}</p>
             </div>
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '28px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {apps.map((app, i) => (
            <Link key={i} to={app.to} style={{ background: '#fff', borderRadius: 28, padding: '24px 12px', textAlign: 'center', textDecoration: 'none', border: '1px solid #f1f5f9', boxShadow: '0 8px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }} onTouchStart={e => e.currentTarget.style.transform = 'scale(0.96)'} onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}>
              <div style={{ width: 56, height: 56, borderRadius: 20, background: `${app.color}15`, color: app.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: `0 8px 16px ${app.color}10` }}>{app.icon}</div>
              <span style={{ color: C.text, fontSize: 13, fontWeight: 900 }}>{app.title}</span>
            </Link>
          ))}
        </div>

        <div style={{ marginTop: 32 }}>
           <h4 style={{ fontSize: 11, fontWeight: 900, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16, paddingLeft: 8 }}>Resources</h4>
           <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { title: 'School Website', url: 'https://fmhs.edu.bd/', icon: '🌐', color: C.blue },
                { title: 'Results Portal', url: 'https://modelresult.netlify.app/', icon: '🎓', color: C.orange }
              ].map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noreferrer" style={{ background: '#fff', borderRadius: 20, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none', border: '1px solid #f1f5f9', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `${link.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{link.icon}</div>
                  <span style={{ color: C.text, fontSize: 14, fontWeight: 800, flex: 1 }}>{link.title}</span>
                  <span style={{ color: '#cbd5e1', fontSize: 18 }}>›</span>
                </a>
              ))}
           </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
