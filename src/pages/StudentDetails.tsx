import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { initSupabase, checkAuth } from '../auth-check';
import { cacheGet, cacheSet } from '../cache';
import { getOrFetchPhoto } from '../photoCache';

const C = {
  purple: '#6366f1',
  bg: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#f1f5f9'
};

interface ColumnSpec {
  field: string | null;
  label: string;
}

const StudentDetails: React.FC = () => {
  const { iid } = useParams();
  const navigate = useNavigate();
  const supabase = initSupabase();

  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [columnSpec, setColumnSpec] = useState<ColumnSpec[]>([]);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);

  // IndexedDB থেকে photo load
  useEffect(() => {
    if (!student?.iid) return;
    let cancelled = false;
    getOrFetchPhoto(student.iid, student.student_photo_url).then(url => {
      if (!cancelled) setPhotoSrc(url);
    });
    return () => { cancelled = true; };
  }, [student?.iid, student?.student_photo_url]);

  useEffect(() => {
    const fetchData = async () => {
      if (!iid) return;
      const cacheKey = `student:${iid}`;
      const cached = await cacheGet<any>(cacheKey);
      
      const loadSpec = async () => {
        const specCached = await cacheGet<ColumnSpec[]>('dataorder');
        if (specCached) { setColumnSpec(specCached); return; }
        try {
          const res = await fetch('/dataorder.csv');
          if (res.ok) {
            const txt = await res.text();
            const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            const spec: ColumnSpec[] = [];
            lines.forEach(line => {
              if (line.toLowerCase().includes('colm name')) return;
              const parts = line.split(' > ');
              if (parts.length >= 2) spec.push({ field: parts[0].trim(), label: parts[1].trim() });
              else if (line.startsWith('*')) spec.push({ field: null, label: line });
            });
            cacheSet('dataorder', spec, 3600000);
            setColumnSpec(spec);
          }
        } catch (e) { console.warn(e); }
      };

      if (cached) { setStudent(cached); setLoading(false); loadSpec(); return; }

      setLoading(true);
      try {
        await checkAuth();
        await loadSpec();
        const { data, error: fetchErr } = await supabase.from('student_database').select('*').eq('iid', Number(iid)).single();
        if (fetchErr) throw fetchErr;
        if (!data) throw new Error('Student not found');
        cacheSet(cacheKey, data);
        setStudent(data);
      } catch (err: any) { setError(err.message); }
      finally { setLoading(false); }
    };
    fetchData();
  }, [iid]);

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}><div style={{ width: 32, height: 32, border: '3px solid #eee', borderTopColor: C.purple, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;

  if (error || !student) return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', background: C.bg }}>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: C.text }}>Not Found</h2>
      <button onClick={() => navigate('/students')} style={{ marginTop: 20, padding: '12px 24px', background: C.purple, color: 'white', border: 'none', borderRadius: 12, fontWeight: 800 }}>Go Back</button>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 40 }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #e2e8f0', padding: '10px 16px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => navigate(-1)} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>←</button>
          <h1 style={{ fontSize: 13, fontWeight: 900, color: C.text }}>Student Details</h1>
          <button onClick={() => window.print()} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: '#f5f3ff', color: C.purple, fontSize: 16 }}>⎙</button>
        </div>
      </header>

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '12px' }}>
        {/* Profile Card Horizontal */}
        <div style={{ background: '#fff', borderRadius: 20, padding: '16px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <div style={{ position: 'relative' }}>
            {photoSrc ? (
              <img
                src={photoSrc}
                alt="p"
                onClick={() => setShowPreview(true)}
                style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover', border: '2px solid #fff', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', cursor: 'pointer' }}
              />
            ) : student.student_photo_url ? (
              // URL আছে কিন্তু এখনো load হচ্ছে
              <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 24, height: 24, border: '2px solid #e2e8f0', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👤</div>
            )}
            <div style={{ position: 'absolute', bottom: -5, right: -5, background: C.purple, color: '#fff', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 6, border: '2px solid #fff' }}>#{student.active_roll}</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 15, fontWeight: 900, color: C.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.student_name_en}</h2>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, margin: '2px 0 0' }}>{student.student_name_bn}</p>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: C.purple, background: '#f5f3ff', padding: '2px 8px', borderRadius: 6 }}>Cls {student.active_class}</span>
              <span style={{ fontSize: 9, fontWeight: 900, color: C.purple, background: '#f5f3ff', padding: '2px 8px', borderRadius: 6 }}>Sec {student.active_section}</span>
            </div>
          </div>
        </div>

        {/* Info Rows */}
        <div style={{ background: '#fff', borderRadius: 20, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {(columnSpec.length > 0 ? columnSpec : Object.keys(student).map(k => ({ field: k, label: k }))).map((spec, i) => {
            if (spec.field === 'student_photo_url' || !spec.label) return null;
            if (spec.field === null) return (
              <div key={i} style={{ padding: '12px 16px 4px', background: '#fbfbfb', borderBottom: '1px solid #f1f5f9' }}>
                <h4 style={{ fontSize: 9, fontWeight: 900, color: C.purple, textTransform: 'uppercase', letterSpacing: 1.5 }}>{spec.label.replace(/^\*+/, '').trim()}</h4>
              </div>
            );
            const val = student[spec.field] || '—';
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid #f8fafc' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.muted, flexShrink: 0, paddingRight: 10 }}>{spec.label}</span>
                <span style={{ fontSize: 12, fontWeight: 800, color: C.text, textAlign: 'right', wordBreak: 'break-word' }}>{val}</span>
              </div>
            );
          })}
        </div>
      </main>

      {/* Photo Preview Modal */}
      {showPreview && photoSrc && (
        <div
          onClick={() => setShowPreview(false)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'fadeIn 0.2s ease' }}
        >
          <img
            src={photoSrc}
            alt="Full Profile"
            style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 16, boxShadow: '0 25px 60px rgba(0,0,0,0.5)', border: '4px solid #fff' }}
          />
          <button style={{ position: 'absolute', top: 20, right: 20, width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#fff', color: '#000', fontSize: 24, fontWeight: 900, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>×</button>
        </div>
      )}
    </div>
  );
};

export default StudentDetails;
