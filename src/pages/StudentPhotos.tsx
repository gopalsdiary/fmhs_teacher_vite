import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { initSupabase, checkAuth } from '../auth-check';
import { cacheGet, cacheSet } from '../cache';

const C = {
  orange: '#f97316',
  bg: '#f8fafc',
  card: '#ffffff',
  text: '#1e293b',
  muted: '#64748b',
  border: '#f1f5f9'
};

const StudentPhotos: React.FC = () => {
  const navigate = useNavigate();
  const supabase = initSupabase();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    checkAuth().then(async (tData) => {
      if (!tData) { navigate('/login'); return; }
      const cacheKey = `photos:${tData.access_class}:${tData.access_section}`;
      const cached = await cacheGet<any[]>(cacheKey);
      if (cached) { setStudents(cached); setLoading(false); return; }

      try {
        const assignments = tData.allAssignments || [{ access_class: tData.access_class, access_section: tData.access_section }];
        let all: any[] = [];
        for (const entry of assignments) {
          const { data } = await supabase.from('student_database').select('iid, student_name_en, active_roll, student_photo_url, active_class, active_section, session')
            .eq('active_class', entry.access_class).eq('active_section', entry.access_section)
            .order('active_roll', { ascending: true });
          if (data) all = [...all, ...data];
        }
        const unique = all.filter((s, idx, self) => idx === self.findIndex((t) => t.iid === s.iid));
        cacheSet(cacheKey, unique);
        setStudents(unique);
      } finally { setLoading(false); }
    });
  }, [navigate]);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return students.filter(s => s.student_name_en?.toLowerCase().includes(term) || String(s.active_roll).includes(term));
  }, [students, searchTerm]);

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #e2e8f0', padding: '10px 16px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/dashboard')} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }}>🔍</span>
            <input 
              type="text" placeholder="Gallery Search..."
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', padding: '9px 12px 9px 38px', borderRadius: 12, border: '1px solid #cbd5e1', outline: 'none', fontSize: 13, fontWeight: 600 }}
            />
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '12px' }}>
        {loading ? (
          <div style={{ padding: '100px 0', textAlign: 'center' }}><div style={{ width: 28, height: 28, border: '2px solid #eee', borderTopColor: C.orange, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 10 }}>
            {filtered.map((s, idx) => (
              <div 
                key={s.iid} 
                style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: `1px solid ${C.border}`, animation: `fadeIn 0.2s ease ${idx * 0.01}s both`, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
              >
                <div 
                  onClick={() => s.student_photo_url && setSelectedPhoto(s.student_photo_url)}
                  style={{ position: 'relative', width: '100%', paddingTop: '110%', background: '#f1f5f9', cursor: 'pointer' }}
                >
                  {s.student_photo_url ? (
                    <img src={s.student_photo_url} alt="p" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.currentTarget.style.display='none'} />
                  ) : <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', fontSize: 24 }}>👤</div>}
                  <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(255,255,255,0.9)', padding: '1px 5px', borderRadius: 6, fontSize: 9, fontWeight: 900 }}>{s.active_roll}</div>
                  <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.3)', color: '#fff', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>🔍</div>
                </div>
                <div onClick={() => navigate(`/student/${s.iid}`)} style={{ padding: '8px 6px', textAlign: 'center', cursor: 'pointer' }}>
                  <p style={{ fontSize: 10, fontWeight: 800, color: C.text, margin: 0, lineHeight: 1.2 }}>{s.student_name_en}</p>
                  <p style={{ fontSize: 9, fontWeight: 700, color: C.orange, margin: '2px 0 0' }}>Session: {s.session}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Photo Preview Modal */}
      {selectedPhoto && (
        <div 
          onClick={() => setSelectedPhoto(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fadeIn 0.2s ease' }}
        >
          <img 
            src={selectedPhoto} 
            alt="Full" 
            style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '3px solid #fff' }} 
          />
          <button style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#fff', color: '#000', fontSize: 20, fontWeight: 900, cursor: 'pointer' }}>×</button>
        </div>
      )}
    </div>
  );
};

export default StudentPhotos;
