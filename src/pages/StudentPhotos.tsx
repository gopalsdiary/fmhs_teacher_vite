import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { initSupabase, checkAuth } from '../auth-check';
import { cacheGet, cacheSet } from '../cache';
import { getOrFetchPhoto } from '../photoCache';

const C = {
  orange: '#f97316',
  bg: '#f8fafc',
  card: '#ffffff',
  text: '#1e293b',
  muted: '#64748b',
  border: '#f1f5f9'
};

// Single photo card with IndexedDB-first loading
const PhotoCard: React.FC<{
  student: any;
  onClick: (url: string) => void;
  onNavigate: (iid: string | number) => void;
}> = ({ student, onClick, onNavigate }) => {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const [photoLoaded, setPhotoLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadPhoto = async () => {
      // প্রথমে IndexedDB চেক, না থাকলে Supabase URL download করে সেভ করে
      const url = await getOrFetchPhoto(student.iid, student.student_photo_url);
      if (!cancelled) {
        setPhotoSrc(url);
      }
    };
    loadPhoto();
    return () => { cancelled = true; };
  }, [student.iid, student.student_photo_url]);

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 14,
        overflow: 'hidden',
        border: `1px solid ${C.border}`,
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
      }}
    >
      <div
        onClick={() => photoSrc && onClick(photoSrc)}
        style={{
          position: 'relative',
          width: '100%',
          paddingTop: '110%',
          background: '#f1f5f9',
          cursor: photoSrc ? 'pointer' : 'default',
        }}
      >
        {photoSrc ? (
          <>
            <img
              src={photoSrc}
              alt="p"
              onLoad={() => setPhotoLoaded(true)}
              style={{
                position: 'absolute',
                top: 0, left: 0,
                width: '100%', height: '100%',
                objectFit: 'cover',
                opacity: photoLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease',
              }}
            />
            {/* Loading shimmer */}
            {!photoLoaded && (
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }} />
            )}
          </>
        ) : (
          <div
            style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#cbd5e1', fontSize: 24,
            }}
          >
            {student.student_photo_url ? (
              // URL আছে কিন্তু এখনো loading
              <div style={{
                width: 28, height: 28,
                border: '2px solid #e2e8f0',
                borderTopColor: C.orange,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : '👤'}
          </div>
        )}
        <div style={{
          position: 'absolute', top: 4, left: 4,
          background: 'rgba(255,255,255,0.92)',
          padding: '1px 5px', borderRadius: 6,
          fontSize: 9, fontWeight: 900,
        }}>
          {student.active_roll}
        </div>
        {photoSrc && (
          <div style={{
            position: 'absolute', bottom: 4, right: 4,
            background: 'rgba(0,0,0,0.3)', color: '#fff',
            width: 20, height: 20, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10,
          }}>
            🔍
          </div>
        )}
      </div>
      <div
        onClick={() => onNavigate(student.iid)}
        style={{ padding: '8px 6px', textAlign: 'center', cursor: 'pointer' }}
      >
        <p style={{ fontSize: 10, fontWeight: 800, color: C.text, margin: 0, lineHeight: 1.2 }}>
          {student.student_name_en}
        </p>
        <p style={{ fontSize: 9, fontWeight: 700, color: C.orange, margin: '2px 0 0' }}>
          Session: {student.session}
        </p>
      </div>
    </div>
  );
};

const StudentPhotos: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const supabase = initSupabase();

  const filterClass   = params.get('class')   || params.get('active_class');
  const filterSection = params.get('section') || params.get('active_section');

  const [teacher, setTeacher] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const assignments = teacher?.allAssignments || [{ access_class: teacher?.access_class, access_section: teacher?.access_section }];
  let activeClass = filterClass;
  let activeSection = filterSection;
  const isAllowed = assignments.some((a: any) => String(a.access_class) === String(activeClass) && String(a.access_section) === String(activeSection));
  if (!isAllowed && assignments[0]) {
    activeClass = assignments[0].access_class;
    activeSection = assignments[0].access_section;
  }

  useEffect(() => {
    checkAuth().then(tData => {
      if (!tData) { navigate('/login'); }
      else { setTeacher(tData); }
    });
  }, [navigate]);

  useEffect(() => {
    if (!teacher || !activeClass || !activeSection) return;
    let isCurrent = true;
    setLoading(true);

    const loadPhotos = async () => {
      const cacheKey = `photos:${activeClass}:${activeSection}`;
      const cached = await cacheGet<any[]>(cacheKey);
      if (cached && isCurrent) {
        setStudents(cached);
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from('student_database')
          .select('iid, student_name_en, active_roll, student_photo_url, active_class, active_section, session')
          .eq('active_class', activeClass)
          .eq('active_section', activeSection)
          .order('active_roll', { ascending: true });
        
        const raw = data || [];
        if (isCurrent) {
          cacheSet(cacheKey, raw);
          setStudents(raw);
        }
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    loadPhotos();
    return () => { isCurrent = false; };
  }, [teacher, activeClass, activeSection, supabase]);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return students.filter(
      s =>
        s.student_name_en?.toLowerCase().includes(term) ||
        String(s.active_roll).includes(term)
    );
  }, [students, searchTerm]);

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #e2e8f0', padding: '10px 16px',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                width: 34, height: 34, borderRadius: 10, border: 'none',
                background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ←
            </button>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }}>
                🔍
              </span>
              <input
                type="text"
                placeholder="Gallery Search..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px 9px 38px',
                  borderRadius: 12, border: '1px solid #cbd5e1',
                  outline: 'none', fontSize: 13, fontWeight: 600,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          {teacher?.allAssignments && teacher.allAssignments.length > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f1f5f9', padding: '6px 12px', borderRadius: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: C.muted }}>শ্রেণী নির্বাচন করুন:</span>
              <select 
                value={`${activeClass}:${activeSection}`} 
                onChange={(e) => {
                  const [cls, sec] = e.target.value.split(':');
                  navigate(`?class=${cls}&section=${sec}`);
                }}
                style={{ border: 'none', background: 'transparent', fontSize: 12, fontWeight: 800, color: C.orange, outline: 'none', cursor: 'pointer' }}
              >
                {teacher.allAssignments.map((a: any, idx: number) => (
                  <option key={idx} value={`${a.access_class}:${a.access_section}`}>
                    Class: {a.access_class} • Section: {a.access_section}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '12px' }}>
        {loading ? (
          <div style={{ padding: '100px 0', textAlign: 'center' }}>
            <div style={{
              width: 28, height: 28, border: '2px solid #eee',
              borderTopColor: C.orange, borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto',
            }} />
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
            gap: 10,
          }}>
            {filtered.map(s => (
              <PhotoCard
                key={s.iid}
                student={s}
                onClick={url => setSelectedPhoto(url)}
                onNavigate={iid => navigate(`/student/${iid}`)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Photo Preview Modal */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.9)', zIndex: 2000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, animation: 'fadeIn 0.2s ease',
          }}
        >
          <img
            src={selectedPhoto}
            alt="Full"
            style={{
              maxWidth: '100%', maxHeight: '90vh',
              borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              border: '3px solid #fff',
            }}
          />
          <button style={{
            position: 'absolute', top: 20, right: 20,
            width: 40, height: 40, borderRadius: '50%',
            border: 'none', background: '#fff', color: '#000',
            fontSize: 20, fontWeight: 900, cursor: 'pointer',
          }}>
            ×
          </button>
        </div>
      )}
    </div>
  );
};

export default StudentPhotos;
