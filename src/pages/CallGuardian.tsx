import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { initSupabase, checkAuth } from '../auth-check';
import { cacheGet, cacheSet } from '../cache';

const C = {
  green: '#10b981',
  blue: '#3b82f6',
  orange: '#f97316', // Vibrant Orange requested
  bg: '#f8fafc',
  card: '#ffffff',
  blueLight: '#f0f9ff',
  orangeLight: '#fff7ed',
  border: '#f1f5f9',
  text: '#0f172a',
  muted: '#64748b'
};

const fmtMobile = (num: any): string => {
  if (!num) return '';
  let c = String(num).replace(/[^0-9]/g, '');
  if (c.length === 10) c = '880' + c;
  else if (c.length === 11 && c.startsWith('0')) c = '880' + c.slice(1);
  return '+' + c;
};

const CallGuardian: React.FC = () => {
  const navigate = useNavigate();
  const supabase = initSupabase();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    checkAuth().then(async tData => {
      if (!tData) { navigate('/login'); return; }
      const cacheKey = `guardian:${tData.access_class}:${tData.access_section}`;
      const cached = cacheGet<any[]>(cacheKey);
      if (cached) { setStudents(cached); setLoading(false); return; }

      const assignments = tData.allAssignments || [{ access_class: tData.access_class, access_section: tData.access_section }];
      let all: any[] = [];
      for (const a of assignments) {
        const { data } = await supabase.from('student_database')
          .select('iid, active_roll, student_name_en, father_name_en, father_mobile, active_class, active_section')
          .eq('active_class', a.access_class).eq('active_section', a.access_section)
          .order('active_roll', { ascending: true });
        if (data) all = [...all, ...data];
      }
      const unique = all.filter((s, i, self) => i === self.findIndex(t => t.iid === s.iid));
      cacheSet(cacheKey, unique);
      setStudents(unique);
      setLoading(false);
    });
  }, [navigate]);

  const filtered = useMemo(() => {
    if (!search) return students;
    const t = search.toLowerCase();
    return students.filter(s =>
      s.student_name_en?.toLowerCase().includes(t) ||
      String(s.active_roll || '').includes(t) ||
      String(s.father_mobile || '').includes(t)
    );
  }, [students, search]);

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #e2e8f0', padding: '10px 16px' }}>
        <div style={{ maxWidth: 500, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/dashboard')} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }}>🔍</span>
            <input 
              type="text" placeholder="Search contacts..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', fontSize: 13, fontWeight: 700, background: '#fff' }}
            />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 500, margin: '0 auto', padding: '12px' }}>
        {loading ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}><div style={{ width: 28, height: 28, border: '2px solid #eee', borderTopColor: C.blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filtered.map((s, idx) => {
              const mobile = fmtMobile(s.father_mobile);
              const waLink = mobile ? `https://wa.me/${mobile.replace(/\D/g, '')}` : null;
              return (
                <div key={s.iid || idx} style={{ background: '#fff', borderRadius: 20, border: `1px solid ${C.border}`, padding: '12px 14px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', animation: `fadeIn 0.2s ease ${idx * 0.01}s both` }}>
                  
                  {/* Name Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 900, color: C.text, margin: 0 }}>{s.student_name_en}</h3>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 900, background: C.blueLight, color: C.blue, padding: '2px 8px', borderRadius: 6 }}>Roll {s.active_roll}</span>
                      <span style={{ fontSize: 9, fontWeight: 900, background: C.orangeLight, color: C.orange, padding: '2px 8px', borderRadius: 6 }}>{s.active_section}</span>
                    </div>
                  </div>

                  {/* Guardian Box */}
                  <div style={{ background: C.blueLight, borderRadius: 12, padding: '10px 14px', marginBottom: 12, border: '1px solid #e0f2fe' }}>
                    <p style={{ fontSize: 8, fontWeight: 900, color: C.blue, textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 3px' }}>👨 Father / Guardian</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>{s.father_name_en}</span>
                      <span style={{ fontSize: 12, fontWeight: 900, color: C.blue }}>{mobile || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Modern Action Buttons */}
                  {mobile ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <a href={`tel:${mobile}`} style={{ background: `linear-gradient(135deg, ${C.green}, #059669)`, color: '#fff', padding: '12px 0', borderRadius: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 900, boxShadow: `0 4px 12px rgba(16,185,129,0.25)` }}>
                        📞 Call
                      </a>
                      {waLink && (
                        <a href={waLink} target="_blank" rel="noreferrer" style={{ background: `linear-gradient(135deg, ${C.orange}, #ea580c)`, color: '#fff', padding: '12px 0', borderRadius: 12, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 900, boxShadow: `0 4px 12px rgba(249,115,22,0.25)` }}>
                          💬 WhatsApp
                        </a>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '10px', background: '#f8fafc', borderRadius: 12, fontSize: 11, fontWeight: 700, color: C.muted }}>Mobile number not available</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default CallGuardian;
