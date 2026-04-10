import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { checkAuth, logout as authLogout, initSupabase } from '../auth-check';
import { cacheGet, cacheSet } from '../cache';

const C = {
  purple: '#f97316', 
  orange: '#fb923c',
  blue: '#ea580c',   
  green: '#10b981',
  bg: '#fff7ed',     
  text: '#431407',   
  muted: '#9a3412'   
};

const Dashboard: React.FC = () => {
  const [teacher, setTeacher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
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
               const { data } = await supabase.from('student_database')
                 .select('iid, student_name_en, student_name_bn, active_roll, student_photo_url, active_class, active_section, session, father_name_en, father_mobile')
                 .eq('active_class', a.access_class).eq('active_section', a.access_section)
                 .order('active_roll', { ascending: true });
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
    { title: 'Attendance', icon: '✅', to: '/attendance', color: C.green },
    { title: 'Photos', icon: '📸', to: '/photos', color: C.orange },
    { title: 'Call Guardian', icon: '📞', to: '/calls', color: C.blue },
    { title: 'Data Edit', icon: '📝', to: '/students', color: C.purple },
    { 
      title: 'My Info', 
      icon: '👤', 
      to: teacher?.iid ? `https://admin.fmhs.edu.bd/login/teacher_view.html?iid=${teacher.iid}` : '#', 
      color: C.orange,
      onClick: !teacher?.iid ? () => alert('Teacher IID not found. Please contact admin.') : undefined 
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Dynamic Banner */}
      <div style={{ background: `linear-gradient(135deg, ${C.purple}, ${C.blue})`, padding: '28px 20px 24px', borderRadius: '0 0 32px 32px', boxShadow: '0 10px 25px rgba(99,102,241,0.15)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.5 }}>FMHS Teacher Portal</p>
              <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 900, margin: '2px 0 0' }}>Dashboard</h1>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => setShowSettings(true)} 
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 10px', borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 11, fontWeight: 900, backdropFilter: 'blur(10px)', cursor: 'pointer' }}
              >
                ⚙️ সেটিংস
              </button>
              <button 
                onClick={async () => { if(confirm('লগআউট করবেন?')) { await authLogout(); navigate('/login'); } }} 
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 10px', borderRadius: 10, border: 'none', background: 'rgba(255,50,50,0.25)', color: '#fff', fontSize: 11, fontWeight: 900, backdropFilter: 'blur(10px)', cursor: 'pointer' }}
              >
                🚪 লগআউট
              </button>
            </div>
          </div>
          <div style={{ marginTop: 18, padding: '12px 16px', background: 'rgba(255,255,255,0.15)', borderRadius: 16, backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 15 }}>
             <div style={{ width: 44, height: 44, borderRadius: 14, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>👨‍🏫</div>
             <div>
                <p style={{ color: '#fff', fontSize: 14, fontWeight: 900, margin: 0 }}>{teacher?.teacher_email?.split('@')[0].toUpperCase()}</p>
                <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 700, margin: '2px 0 0' }}>Class: {teacher?.access_class} • Sec: {teacher?.access_section}</p>
             </div>
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '28px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {apps.map((app, i) => {
            const isExt = app.to.startsWith('http');
            const style = { background: '#fff', borderRadius: 28, padding: '24px 12px', textAlign: 'center', textDecoration: 'none', border: '1px solid #f1f5f9', boxShadow: '0 8px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 };
            const content = (
              <>
                <div style={{ width: 56, height: 56, borderRadius: 20, background: `${app.color}15`, color: app.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: `0 8px 16px ${app.color}10` }}>{app.icon}</div>
                <span style={{ color: C.text, fontSize: 13, fontWeight: 900 }}>{app.title}</span>
              </>
            );

            if (isExt) return <a key={i} href={app.to} target="_blank" rel="noreferrer" style={style as React.CSSProperties}>{content}</a>;
            return (
              <Link key={i} to={app.to} onClick={(app as any).onClick} style={style as React.CSSProperties} onTouchStart={e => e.currentTarget.style.transform = 'scale(0.96)'} onTouchEnd={e => e.currentTarget.style.transform = 'scale(1)'}>
                {content}
              </Link>
            );
          })}
        </div>

        {/* Attendance Quick Access */}
        <div style={{ marginTop: 32 }}>
           <h4 style={{ fontSize: 11, fontWeight: 900, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16, paddingLeft: 8 }}>Attendance Tools</h4>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[
                { title: "Today's", to: '/attendance?view=today', icon: '📅', color: C.purple },
                { title: 'History', to: '/attendance?view=history', icon: '🕒', color: C.green },
                { title: 'Class', to: '/attendance?view=history', icon: '🏫', color: C.blue },
                { title: 'Teacher', to: '/attendance?view=my', icon: '👨‍🏫', color: C.orange },
              ].map((item, i) => (
                <Link key={i} to={item.to} style={{ background: '#fff', borderRadius: 20, padding: '16px', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', border: '1px solid #f1f5f9', boxShadow: '0 4px 10px rgba(0,0,0,0.02)' }}>
                   <div style={{ width: 36, height: 36, borderRadius: 10, background: `${item.color}15`, color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{item.icon}</div>
                   <span style={{ color: C.text, fontSize: 13, fontWeight: 800 }}>{item.title}</span>
                </Link>
              ))}
           </div>
        </div>

        {/* Results Archive */}
        <div style={{ marginTop: 32 }}>
           <h4 style={{ fontSize: 11, fontWeight: 900, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16, paddingLeft: 8 }}>Results Archive</h4>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[
                { title: 'Annual 2022' },
                { title: 'Half Yearly 2023' },
                { title: 'Annual 2023' },
                { title: 'Half Yearly 2024' },
                { title: 'Annual 2024' },
                { title: 'Half Yearly 2025' },
                { title: 'Pre-Test 2025' },
                { title: '9-10 Annual/Test 2025' },
                { title: '6,7,8 Annual 2025' },
              ].map((item, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 20, padding: '16px', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #f1f5f9', opacity: 0.7 }}>
                   <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📜</div>
                   <span style={{ color: C.text, fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{item.title}</span>
                </div>
              ))}
           </div>
        </div>

        <div style={{ marginTop: 32 }}>
           <h4 style={{ fontSize: 11, fontWeight: 900, color: C.muted, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 16, paddingLeft: 8 }}>Resources</h4>
           <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { title: 'School Website', url: 'https://fmhs.edu.bd/', icon: '🌐', color: C.blue },
                { title: 'Student Portal', url: 'https://app.fmhs.edu.bd/', icon: '👨‍🎓', color: C.orange }
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

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
           <div style={{ background: '#fff', borderRadius: 32, width: '100%', maxWidth: 400, padding: 30, position: 'relative', border: '1px solid #ffedd5' }}>
              <button onClick={() => setShowSettings(false)} style={{ position: 'absolute', top: 20, right: 20, border: 'none', background: '#f1f5f9', width: 32, height: 32, borderRadius: '50%', fontSize: 18, fontWeight: 900 }}>×</button>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 24px', color: C.text }}>অ্যাপ সেটিংস</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                 <button 
                  onClick={() => { 
                    const keys = Object.keys(sessionStorage);
                    keys.forEach(k => { if(k.startsWith('cache:')) sessionStorage.removeItem(k); });
                    alert('সিস্টেম রিসেট হয়েছে!');
                    window.location.reload();
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: 20, cursor: 'pointer', textAlign: 'left' }}
                 >
                    <div style={{ fontSize: 24 }}>🔄</div>
                    <div>
                       <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.text }}>সিস্টেম রিসেট</p>
                       <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, color: C.muted }}>ক্যাশ ক্লিয়ার এবং ডেটা রিফ্রেশ করুন</p>
                    </div>
                 </button>

                 <button 
                  onClick={() => navigate('/reset-password')}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 20, cursor: 'pointer', textAlign: 'left' }}
                 >
                    <div style={{ fontSize: 24 }}>🔐</div>
                    <div>
                       <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.text }}>পাসওয়ার্ড রিসেট</p>
                       <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, color: C.muted }}>নিরাপদ রাখতে পাসওয়ার্ড পরিবর্তন করুন</p>
                    </div>
                 </button>

                 <div style={{ marginTop: 12, padding: '12px 16px', background: '#f8fafc', borderRadius: 16, border: '1px solid #f1f5f9' }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 900, color: C.muted, textTransform: 'uppercase' }}>Current Version</p>
                    <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 800, color: C.text }}>v2.4.0 (Vite React)</p>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
