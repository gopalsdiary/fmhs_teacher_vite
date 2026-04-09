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
  const [teacher, setTeacher] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    checkAuth().then(async tData => {
      if (!tData) { navigate('/login'); return; }
      setTeacher(tData);
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
    <div style={{ minHeight: '100vh', background: C.orangeLight }}>
      
      <div style={{ maxWidth: 500, margin: '0 auto', padding: '16px 12px 0' }}>
        {/* New Header Design */}
        <div style={{ background: '#fff', borderRadius: 32, padding: '24px 20px', border: '1px solid #ffedd5', boxShadow: '0 10px 30px rgba(249,115,22,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
             <div style={{ display: 'flex', gap: 12 }}>
                <span style={{ fontSize: 24, color: C.orange }}>📞</span>
                <h1 style={{ fontSize: 20, fontWeight: 900, color: '#431407', margin: 0, lineHeight: 1.2 }}>ছাত্র-ছাত্রীদের<br/>সাথে যোগাযোগ</h1>
             </div>
             <button onClick={() => navigate('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: '#fff7ed', color: '#9a3412', padding: '10px 14px', borderRadius: 16, fontWeight: 800, fontSize: 13, borderBottom: '3px solid #ffedd5', textAlign: 'left' }}>
               <span>←</span> <span>ড্যাশবোর্ড</span>
             </button>
          </div>

          <div style={{ background: `linear-gradient(135deg, ${C.orange}, #f97316)`, borderRadius: 24, padding: '16px 20px', color: '#fff' }}>
             <div style={{ display: 'flex', gap: 15, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                   <span style={{ fontSize: 16 }}>🏫</span>
                   <span style={{ fontSize: 13, fontWeight: 900 }}>শ্রেণি: {teacher?.access_class || '–'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                   <span style={{ fontSize: 16 }}>👥</span>
                   <span style={{ fontSize: 13, fontWeight: 900 }}>শাখা: {teacher?.access_section || '–'}</span>
                </div>
             </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.9 }}>
                <span style={{ fontSize: 16 }}>👤</span>
                <span style={{ fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>শিক্ষক: {teacher?.teacher_email}</span>
             </div>
          </div>
        </div>

        {/* Stats and Search */}
        <div style={{ marginTop: 20 }}>
           <div style={{ background: '#fff7ed', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 14, color: '#9a3412', marginBottom: 15 }}>
              <span style={{ fontSize: 16 }}>🎓</span>
              <span style={{ fontSize: 14, fontWeight: 900 }}>মোট: {filtered.length}</span>
           </div>

           <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="নাম, রোল বা মোবাইল দিয়ে খুঁজুন..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '16px 45px 16px 20px', borderRadius: 20, border: '1px solid #ffedd5', background: '#fff', fontSize: 14, fontWeight: 800, color: '#431407', outline: 'none', boxShadow: '0 4px 12px rgba(249,115,22,0.03)' }}
              />
              <span style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', fontSize: 18, opacity: 0.4 }}>🔍</span>
           </div>
        </div>
      </div>

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
