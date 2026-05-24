import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { checkAuth, logout as authLogout, initSupabase } from '../auth-check';
import { cacheGet, cacheSet } from '../cache';
import { useDataSync } from '../hooks/useDataSync';

const C = {
  purple: '#f97316', 
  orange: '#fb923c',
  blue: '#ea580c',   
  green: '#10b981',
  bg: '#fff7ed',     
  text: '#431407',   
  muted: '#9a3412',
  primary: '#f97316'
};

const Dashboard: React.FC = () => {
  const [teacher, setTeacher] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [dashboardLinks, setDashboardLinks] = useState<any[]>([]);
  const [enabledExams, setEnabledExams] = useState<any[]>([]);
  const navigate = useNavigate();

  const getIcon = (name: string) => {
    if (name.toLowerCase().includes('website')) return '🌐';
    if (name.toLowerCase().includes('portal')) return '👨‍🎓';
    if (name.toLowerCase().includes('admission')) return '📝';
    if (name.toLowerCase().includes('board')) return '🏛️';
    if (name.toLowerCase().includes('facebook')) return '📱';
    if (name.toLowerCase().includes('মাউশি')) return '📖';
    if (name.toLowerCase().includes('মুক্তপাঠ')) return '🎓';
    if (name.toLowerCase().includes('mpo')) return '📄';
    return '🔗';
  };

  const getColor = (name: string) => {
    if (name.toLowerCase().includes('website')) return C.blue;
    if (name.toLowerCase().includes('portal')) return C.orange;
    if (name.toLowerCase().includes('admission')) return C.purple;
    if (name.toLowerCase().includes('board')) return C.green;
    if (name.toLowerCase().includes('facebook')) return '#1877F2';
    return C.purple;
  };

  const { syncAllData, syncing, progress } = useDataSync();

  useEffect(() => {
    fetch('/dashboard_link.csv')
      .then(res => res.text())
      .then(text => {
        const lines = text.trim().split('\n');
        if (lines.length > 1) {
          const links = lines.slice(1)
            .map(line => {
              const parts = line.split(',');
              if (parts.length < 3) return null;
              const name = parts[1].trim();
              const url = parts[2].trim();
              return { title: name, url, icon: getIcon(name), color: getColor(name) };
            })
            .filter((link): link is any => link !== null);
          setDashboardLinks(links);
        }
      })
      .catch(e => console.error('Error loading links', e));

    const fetchEnabledExams = async () => {
      // 1. Try local cache first for instant display
      const cached = await cacheGet<any[]>('enabled_exams');
      if (cached) {
        setEnabledExams(cached);
      }

      // 2. Fetch from Supabase if online
      if (navigator.onLine) {
        try {
          const supabase = initSupabase();
          const { data, error } = await supabase
            .from('FMHS_exams_names')
            .select('*')
            .eq('teacher_entry_enabled', true);
          if (error) throw error;
          if (data) {
            setEnabledExams(data);
            await cacheSet('enabled_exams', data);
          }
        } catch (e) {
          console.error('Error fetching enabled exams:', e);
        }
      }
    };

    fetchEnabledExams();

    checkAuth().then(d => {
      if (!d) navigate('/login');
      else { 
        setTeacher(d); 
        setLoading(false); 
        
        // Automated background sync
        const lastSync = localStorage.getItem('last_full_sync');
        const syncAge = lastSync ? Date.now() - parseInt(lastSync) : Infinity;
        
        // Sync if older than 1 hour or never synced
        if (syncAge > 3600000) {
          syncAllData();
        }
      }
    });
  }, [navigate, syncAllData]);


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
      to: '/my-info', 
      color: C.orange,
    },
    { title: 'Messaging', icon: '💬', to: '/messages', color: C.green },
    { title: 'Message to Student', icon: '👨‍🎓', to: '/student-chat', color: '#1877F2' },
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
                ⚙️ Settings
              </button>
              <button 
                onClick={async () => { if(confirm('Confirm Logout?')) { await authLogout(); navigate('/login'); } }} 
                style={{ display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 10px', borderRadius: 10, border: 'none', background: 'rgba(255,50,50,0.25)', color: '#fff', fontSize: 11, fontWeight: 900, backdropFilter: 'blur(10px)', cursor: 'pointer' }}
              >
                🚪 Logout
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
          {syncing && (
            <div style={{ marginTop: 15, background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 15px', border: '1px solid rgba(255,255,255,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>SYNCING STUDENT DATA...</span>
                <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>{progress}%</span>
              </div>
              <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#fff', transition: 'width 0.3s' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '28px 16px' }}>
        {enabledExams.length > 0 && (
          <div style={{ 
            background: 'linear-gradient(135deg, #f97316, #fb923c)',
            borderRadius: 28, 
            padding: '24px', 
            marginBottom: 24, 
            border: '1px solid rgba(255, 255, 255, 0.2)', 
            boxShadow: '0 12px 30px rgba(249, 115, 22, 0.15)',
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
            animation: 'fadeIn 0.5s ease-out'
          }}>
            <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.12)', filter: 'blur(10px)' }} />
            <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)', filter: 'blur(5px)' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ 
                display: 'inline-block', 
                width: 8, 
                height: 8, 
                backgroundColor: '#10b981', 
                borderRadius: '50%', 
                boxShadow: '0 0 10px #10b981, 0 0 20px #10b981',
                animation: 'pulse 1.5s infinite'
              }} />
              <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255, 255, 255, 0.9)' }}>
                TEACHER ENTRY ACCESS ENABLED
              </span>
            </div>

            {enabledExams.map((exam, i) => (
              <div key={exam.id || i} style={{ 
                marginTop: i > 0 ? 20 : 0, 
                borderTop: i > 0 ? '1px solid rgba(255, 255, 255, 0.2)' : 'none',
                paddingTop: i > 0 ? 16 : 0
              }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, lineHeight: 1.3, letterSpacing: '-0.02em' }}>
                  {exam.exam_name} {exam.year ? exam.year : ''}
                </h3>
                <p style={{ margin: '6px 0 16px', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.95)', lineHeight: 1.4 }}>
                  এই পরীক্ষার রেজাল্ট এন্ট্রি দেওয়ার এক্সেস চালু আছে। রেজাল্ট সাবমিট করতে নিচের বাটনে ক্লিক করুন।
                </p>
                <Link 
                  to="/teacher-exam-dashboard" 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: 8, 
                    height: 42, 
                    padding: '0 24px', 
                    borderRadius: 14, 
                    background: '#fff', 
                    color: '#ea580c', 
                    fontSize: 13, 
                    fontWeight: 900, 
                    textDecoration: 'none', 
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.08)',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.12)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.08)';
                  }}
                >
                  ✍️ রেজাল্ট এন্ট্রি দিন (Enter Results)
                </Link>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {apps.map((app, i) => {
            const isExt = app.to.startsWith('http');
            const style = { background: '#fff', borderRadius: 28, padding: '24px 12px', textAlign: 'center', textDecoration: 'none', border: '1px solid #f1f5f9', boxShadow: '0 8px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 };
            const content = (
              <>
                <div style={{ width: 56, height: 56, borderRadius: 20, background: `${app.color}15`, color: app.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: `0 8px 166px ${app.color}10` }}>{app.icon}</div>
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

        {/* Attendance Tool Section Card */}
        <div style={{ background: '#fff', borderRadius: 28, padding: '24px 20px', border: '1px solid #f1f5f9', boxShadow: '0 8px 30px rgba(0,0,0,0.02)', marginTop: 32 }}>
           <h4 style={{ fontSize: 13, fontWeight: 900, color: C.purple, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 4, height: 18, background: C.purple, borderRadius: 2 }} />
              Attendance Tools
           </h4>
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {[
                { title: "Today's", to: '/attendance?view=today', icon: '📅', color: C.purple },
                { title: 'History', to: '/attendance?view=history', icon: '🕒', color: C.green },
                { title: 'Class', to: '/attendance?view=history', icon: '🏫', color: C.blue },
                { title: 'Teacher', to: '/attendance?view=my', icon: '👨‍🏫', color: C.orange },
              ].map((item, i) => (
                <Link key={i} to={item.to} style={{ background: `${item.color}08`, borderRadius: 16, padding: '16px', display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', border: `1px solid ${item.color}15` }}>
                   <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fff', color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>{item.icon}</div>
                   <span style={{ color: C.text, fontSize: 13, fontWeight: 800 }}>{item.title}</span>
                </Link>
              ))}
           </div>
        </div>

        {/* Results Archive Section Card */}
        <div style={{ background: '#fff', borderRadius: 28, padding: '24px 20px', border: '1px solid #f1f5f9', boxShadow: '0 8px 30px rgba(0,0,0,0.02)', marginTop: 24 }}>
           <h4 style={{ fontSize: 13, fontWeight: 900, color: C.primary || C.purple, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 4, height: 18, background: C.primary || C.purple, borderRadius: 2 }} />
              Results Archive
           </h4>
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
                <div key={i} style={{ background: '#f8fafc', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #f1f5f9', opacity: 0.8 }}>
                   <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, boxShadow: '0 2px 5px rgba(0,0,0,0.02)' }}>📜</div>
                   <span style={{ color: C.text, fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{item.title}</span>
                </div>
              ))}
           </div>
        </div>

        {/* Resources Section Card */}
        <div style={{ background: '#fff', borderRadius: 28, padding: '24px 20px', border: '1px solid #f1f5f9', boxShadow: '0 8px 30px rgba(0,0,0,0.02)', marginTop: 24 }}>
           <h4 style={{ fontSize: 13, fontWeight: 900, color: C.primary || C.purple, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 4, height: 18, background: C.primary || C.purple, borderRadius: 2 }} />
              Quick Resources
           </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {dashboardLinks.length > 0 ? (
                dashboardLinks.map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noreferrer" style={{ background: `${link.color}08`, borderRadius: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none', border: `1px solid ${link.color}15` }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fff', color: link.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>{link.icon}</div>
                    <span style={{ color: C.text, fontSize: 14, fontWeight: 800, flex: 1 }}>{link.title}</span>
                    <span style={{ color: link.color, fontSize: 18, opacity: 0.5 }}>›</span>
                  </a>
                ))
              ) : (
                [
                  { title: 'School Website', url: 'https://fmhs.edu.bd/', icon: '🌐', color: C.blue },
                  { title: 'Student Portal', url: 'https://app.fmhs.edu.bd/', icon: '👨‍🎓', color: C.orange }
                ].map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noreferrer" style={{ background: `${link.color}08`, borderRadius: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, textDecoration: 'none', border: `1px solid ${link.color}15` }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fff', color: link.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>{link.icon}</div>
                    <span style={{ color: C.text, fontSize: 14, fontWeight: 800, flex: 1 }}>{link.title}</span>
                    <span style={{ color: link.color, fontSize: 18, opacity: 0.5 }}>›</span>
                  </a>
                ))
              )}
            </div>
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
           <div style={{ background: '#fff', borderRadius: 32, width: '100%', maxWidth: 400, padding: 30, position: 'relative', border: '1px solid #ffedd5' }}>
              <button onClick={() => setShowSettings(false)} style={{ position: 'absolute', top: 20, right: 20, border: 'none', background: '#f1f5f9', width: 32, height: 32, borderRadius: '50%', fontSize: 18, fontWeight: 900 }}>×</button>
              <h2 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 24px', color: C.text }}>App Settings</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                 <button 
                  onClick={async () => { 
                    if (!confirm('Are you sure you want to reset the system? This will clear cache and refresh everything.')) return;
                    
                    // 1. Clear session cache
                    const keys = Object.keys(sessionStorage);
                    keys.forEach(k => { if(k.startsWith('cache:')) sessionStorage.removeItem(k); });
                    
                    // 2. Clear Service Worker caches
                    if ('serviceWorker' in navigator) {
                      const swKeys = await caches.keys();
                      await Promise.all(swKeys.map(key => caches.delete(key)));
                      
                      const registrations = await navigator.serviceWorker.getRegistrations();
                      for (const registration of registrations) {
                        await registration.unregister();
                      }
                    }

                    // 3. Clear local storage specific to app
                    localStorage.removeItem('app_version');
                    
                    alert('System reset successfully! The app will now reload.');
                    window.location.reload();
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: 20, cursor: 'pointer', textAlign: 'left' }}
                 >
                    <div style={{ fontSize: 24 }}>🔄</div>
                    <div>
                       <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.text }}>System Reset</p>
                       <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, color: C.muted }}>Clear cache and refresh data</p>
                    </div>
                 </button>
 
                 <button 
                  onClick={() => { syncAllData(); setShowSettings(false); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: 20, cursor: 'pointer', textAlign: 'left' }}
                 >
                    <div style={{ fontSize: 24 }}>☁️</div>
                    <div>
                       <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.text }}>Sync Data</p>
                       <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, color: C.muted }}>Force sync all student records</p>
                    </div>
                 </button>

                 <button 
                  onClick={() => navigate('/reset-password')}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 20, cursor: 'pointer', textAlign: 'left' }}
                 >
                    <div style={{ fontSize: 24 }}>🔐</div>
                    <div>
                       <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: C.text }}>Password Reset</p>
                       <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, color: C.muted }}>Change password to keep it secure</p>
                    </div>
                 </button>

                 <div style={{ marginTop: 12, padding: '12px 16px', background: '#f8fafc', borderRadius: 16, border: '1px solid #f1f5f9' }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 900, color: C.muted, textTransform: 'uppercase' }}>Current Version</p>
                    <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 800, color: C.text }}>v2.4.0 (React App)</p>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
