import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { initSupabase, checkAuth } from '../auth-check';
import { cacheGet, cacheSet } from '../cache';

const C = {
  purple: '#6366f1',
  bg: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#f1f5f9'
};

const StudentList: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const supabase = initSupabase();

  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [teacher, setTeacher] = useState<any>(null);

  const filterClass   = searchParams.get('class')   || searchParams.get('active_class');
  const filterSection = searchParams.get('section') || searchParams.get('active_section');

  useEffect(() => {
    (async () => {
      const tData = await checkAuth();
      if (!tData) { navigate('/login'); return; }
      setTeacher(tData);

      const assignments = tData.allAssignments || [{ access_class: tData.access_class, access_section: tData.access_section }];
      let finalClass = filterClass;
      let finalSection = filterSection;
      const isAllowed = assignments.some((a: any) => a.access_class == finalClass && a.access_section == finalSection);
      
      if (!isAllowed) {
        finalClass = assignments[0].access_class;
        finalSection = assignments[0].access_section;
      }

      const key = `students:${finalClass}:${finalSection}`;
      const cached = cacheGet<any[]>(key);
      if (cached) { setStudents(cached); setLoading(false); return; }

      setLoading(true);
      const { data } = await supabase.from('student_database').select('*')
        .eq('active_class', finalClass).eq('active_section', finalSection)
        .order('active_roll', { ascending: true });
      
      const res = data || [];
      cacheSet(key, res);
      setStudents(res);
      setLoading(false);
    })();
  }, [filterClass, filterSection]);

  const filtered = useMemo(() => {
    if (!searchTerm) return students;
    const t = searchTerm.toLowerCase();
    return students.filter(s =>
      s.student_name_en?.toLowerCase().includes(t) ||
      String(s.active_roll || '').includes(t) ||
      String(s.iid || '').includes(t)
    );
  }, [students, searchTerm]);

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 40 }}>
      {/* Search Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #e2e8f0', padding: '10px 16px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/dashboard')} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>←</button>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }}>🔍</span>
            <input 
              type="text" placeholder="Roll, ID or Name..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '9px 12px 9px 38px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', fontSize: 14, fontWeight: 600, background: '#fff' }}
            />
          </div>
          <div style={{ fontSize: 11, fontWeight: 900, color: C.purple, background: '#f5f3ff', padding: '4px 10px', borderRadius: 10 }}>{filtered.length}</div>
        </div>
      </div>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '12px' }}>
        {loading ? (
          <div style={{ padding: '80px 0', textAlign: 'center' }}><div style={{ width: 32, height: 32, border: '3px solid #eee', borderTopColor: C.purple, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} /></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((s, idx) => (
              <div 
                key={s.iid} 
                onClick={() => navigate(`/student/${s.iid}`)}
                style={{ background: C.card, borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', border: `1px solid ${C.border}`, animation: `fadeIn 0.2s ease ${idx * 0.01}s both`, WebkitTapHighlightColor: 'transparent' }}
                onTouchStart={e => e.currentTarget.style.background = '#f8fafc'}
                onTouchEnd={e => e.currentTarget.style.background = '#fff'}
              >
                {/* Roll & Avatar Circle */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: '#f1f5f9', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    {s.student_photo_url ? (
                      <img src={s.student_photo_url} alt="portrait" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.currentTarget.style.display='none'} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, background: `linear-gradient(135deg, ${C.purple}, #4f46e5)`, color: '#fff', fontWeight: 900 }}>{s.student_name_en?.[0]}</div>
                    )}
                  </div>
                  <div style={{ position: 'absolute', bottom: -2, right: -4, background: C.purple, color: 'white', borderRadius: 6, padding: '1px 5px', fontSize: 9, fontWeight: 900, border: '2px solid white' }}>{s.active_roll}</div>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                   <h3 style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.student_name_en}</h3>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                     <span style={{ fontSize: 10, fontWeight: 700, color: C.muted }}>ID: {s.iid}</span>
                     <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, background: '#f1f5f9', padding: '1px 6px', borderRadius: 5 }}>Sec {s.active_section}</span>
                   </div>
                </div>

                <span style={{ color: '#cbd5e1', fontSize: 18 }}>›</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default StudentList;
