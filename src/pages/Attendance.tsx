import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { initSupabase, checkAuth } from '../auth-check';
import { cacheGet, cacheSet } from '../cache';

const C = { 
  purple: '#6366f1', 
  green: '#10b981', 
  red: '#ef4444', 
  bg: '#f8fafc', 
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#f1f5f9'
};

const fmtTime = (t: string) => {
  if (!t) return '–';
  try { return new Date('1970-01-01T' + t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }); }
  catch { return t; }
};
const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  catch { return d; }
};

const Attendance: React.FC = () => {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const supabase   = initSupabase();

  const [tab, setTab]             = useState(params.get('view') || 'today');
  const [teacher, setTeacher]     = useState<any>(null);
  const [students, setStudents]   = useState<any[]>([]);
  const [att, setAtt]             = useState<Record<string, 'present' | 'absent'>>({});
  const [rfid, setRfid]           = useState<Record<string, any>>({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0]);
  const [toast, setToast]         = useState({ type: '', text: '' });

  const [hStudId, setHStudId] = useState('');
  const [hData, setHData]     = useState<any[]>([]);
  const [hLoad, setHLoad]     = useState(false);
  const [gData, setGData]     = useState<any[]>([]);
  const [gLoad, setGLoad]     = useState(false);
  const [myAttData, setMyAttData] = useState<any[]>([]);
  const [myAttLoad, setMyAttLoad] = useState(false);

  const notify = (type: 'success' | 'error', text: string) => {
    setToast({ type, text } as any);
    setTimeout(() => setToast({ type: '', text: '' } as any), 3000);
  };

  const loadData = useCallback(async (d: string) => {
    if (!teacher) return;
    setLoading(true);
    try {
      const studKey = `att-students:${teacher.access_class}:${teacher.access_section}`;
      let unique = cacheGet<any[]>(studKey);
      if (!unique) {
        const asgn = teacher.allAssignments || [{ access_class: teacher.access_class, access_section: teacher.access_section }];
        let all: any[] = [];
        for (const a of asgn) {
          const { data } = await supabase.from('student_database').select('*')
            .eq('active_class', a.access_class).eq('active_section', a.access_section)
            .order('active_roll', { ascending: true });
          if (data) all = [...all, ...data];
        }
        unique = all.filter((s, i, self) => i === self.findIndex(t => t.iid === s.iid));
        cacheSet(studKey, unique);
      }
      setStudents(unique);

      const rfidCards = unique.map(s => s.rfid_card_no).filter(Boolean);
      let rfidMap: Record<string, any> = {};
      if (rfidCards.length) {
        const { data: rd } = await supabase.from('attendence_entry').select('*')
          .eq('attendence_date', d).in('rfid_card_no', rfidCards).order('attendence_time', { ascending: true });
        (rd || []).forEach((e: any) => {
          if (!rfidMap[e.rfid_card_no]) rfidMap[e.rfid_card_no] = { firstScan: e.attendence_time, lastScan: e.attendence_time, totalScans: 1 };
          else { rfidMap[e.rfid_card_no].lastScan = e.attendence_time; rfidMap[e.rfid_card_no].totalScans++; }
        });
      }
      setRfid(rfidMap);
      const init: Record<string, 'present' | 'absent'> = {};
      unique.forEach(s => { init[s.iid] = (s.rfid_card_no && rfidMap[s.rfid_card_no]) ? 'present' : 'absent'; });
      setAtt(init);
    } finally { setLoading(false); }
  }, [teacher, supabase]);

  useEffect(() => { checkAuth().then(d => { if (!d) navigate('/login'); else setTeacher(d); }); }, [navigate]);
  useEffect(() => { if (teacher && tab === 'today') loadData(date); }, [teacher, date, loadData, tab]);

  useEffect(() => {
    if (tab === 'my' && teacher) {
      if (!teacher.teacher_rfid) {
        setMyAttData([]);
        setMyAttLoad(false);
        return;
      }
      setMyAttLoad(true);
      supabase.from('attendence_entry').select('*').eq('rfid_card_no', teacher.teacher_rfid).order('attendence_date', { ascending: false }).limit(25)
        .then(({ data, error }: any) => { 
          if (error) notify('error', 'Update Failed: Connection timed out.');
          setMyAttData(data || []); 
          setMyAttLoad(false); 
        });
    }
    if (tab === 'history' && students.length) {
      setGLoad(true);
      const rfidCards = students.map(s => s.rfid_card_no).filter(Boolean);
      if (!rfidCards.length) {
        setGData([]);
        setGLoad(false);
        return;
      }
      supabase.from('attendence_entry').select('attendence_date, rfid_card_no').in('rfid_card_no', rfidCards).order('attendence_date', { ascending: false }).limit(1000)
        .then(({ data, error }: any) => {
          if (error) notify('error', 'Failed to fetch logs. Check connection.');
          const group: Record<string, Set<string>> = {};
          (data || []).forEach((entry: any) => {
            if (!group[entry.attendence_date]) group[entry.attendence_date] = new Set();
            group[entry.attendence_date].add(entry.rfid_card_no);
          });
          setGData(Object.keys(group).map(d => ({ date: d, present: group[d].size, total: students.length, percent: Math.round((group[d].size / students.length) * 100) })));
          setGLoad(false);
        });
    }
  }, [tab, teacher, students.length]);

  const mark = (id: string, status: 'present' | 'absent') => setAtt(p => ({ ...p, [id]: status }));

  const save = async () => {
    const today = new Date().toISOString().split('T')[0];
    if (date !== today) { notify('error', 'Only today!'); return; }
    const present = Object.keys(att).filter(id => att[id] === 'present');
    if (!present.length) { notify('error', 'Select students!'); return; }
    setSaving(true);
    try {
      const now = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour12: false });
      const entries = present.map(id => {
        const s = students.find(st => st.iid == id);
        return s?.rfid_card_no ? { rfid_card_no: s.rfid_card_no, attendence_date: date, attendence_time: now } : null;
      }).filter(Boolean);
      const { error } = await supabase.from('attendence_entry').insert(entries);
      if (error) throw error;
      notify('success', '✓ Updated!');
      loadData(date);
    } catch (e: any) { notify('error', e.message); }
    finally { setSaving(false); }
  };

  const statVals = { total: students.length, present: Object.values(att).filter(v => v === 'present').length, absent: students.length - Object.values(att).filter(v => v === 'present').length };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 110 }}>
      {/* Dynamic Glass Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', borderBottom: '1px solid #e2e8f0' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate('/dashboard')} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 15, fontWeight: 900, color: C.text }}>Attendance</h1>
            <p style={{ fontSize: 10, fontWeight: 700, color: C.muted }}>Cls {teacher?.access_class || '–'} • Sec {teacher?.access_section || '–'}</p>
          </div>
          <div style={{ background: '#fff', borderRadius: 10, padding: '4px 10px', display: 'flex', gap: 8, border: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 11, fontWeight: 900, color: C.green }}>{statVals.present}</span>
            <span style={{ fontSize: 11, fontWeight: 900, color: C.red }}>{statVals.absent}</span>
          </div>
        </div>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', padding: '0 8px' }}>
          {['today', 'history', 'my'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '12px 0', border: 'none', background: 'none', fontWeight: 900, fontSize: 12, color: tab === t ? C.purple : C.muted, borderBottom: `2.5px solid ${tab === t ? C.purple : 'transparent'}`, transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t === 'my' ? 'Self' : (t === 'history' ? 'Logs' : 'Mark')}</button>
          ))}
        </div>
      </header>

      {toast.text && (
        <div style={{ position: 'fixed', top: 100, left: '50%', transform: 'translateX(-50%)', background: toast.type === 'success' ? '#059669' : '#dc2626', color: '#fff', padding: '10px 20px', borderRadius: 12, fontWeight: 800, fontSize: 13, zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>{toast.text}</div>
      )}

      <main style={{ maxWidth: 600, margin: '0 auto', padding: '12px' }}>

        {/* TODAY */}
        {tab === 'today' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '12px 16px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 20 }}>🗓️</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} max={new Date().toISOString().split('T')[0]} style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 15, fontWeight: 800, color: C.text, outline: 'none' }} />
            </div>

            {loading ? <div style={{ padding: '80px 0', textAlign: 'center' }}><div style={{ width: 28, height: 28, border: '2px solid #eee', borderTopColor: C.purple, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} /></div> : (
              students.map((s, idx) => (
                <div key={s.iid} style={{ background: '#fff', borderRadius: 16, padding: '12px 14px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, animation: `fadeIn 0.2s ease ${idx * 0.01}s both` }}>
                   <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: C.purple, flexShrink: 0 }}>{s.active_roll}</div>
                   <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.student_name_en}</h4>
                      <p style={{ fontSize: 10, fontWeight: 700, color: rfid[s.rfid_card_no] ? C.green : C.muted, margin: 0 }}>{rfid[s.rfid_card_no] ? `IN: ${fmtTime(rfid[s.rfid_card_no].firstScan)}` : 'Manual'}</p>
                   </div>
                   <div style={{ display: 'flex', gap: 4 }}>
                      {['present', 'absent'].map(st => (
                        <button key={st} onClick={() => mark(s.iid, st as any)} style={{ width: 44, height: 44, borderRadius: 12, border: 'none', background: att[s.iid] === st ? (st === 'present' ? C.green : C.red) : '#f1f5f9', color: att[s.iid] === st ? '#fff' : '#cbd5e1', fontSize: 18, fontWeight: 800, transition: 'all 0.15s' }}>{st === 'present' ? '✓' : '✗'}</button>
                      ))}
                   </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* LOGS */}
        {tab === 'history' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
               <div style={{ background: '#fff', borderRadius: 16, padding: 12, border: `1px solid ${C.border}`, textAlign: 'center' }}>
                 <p style={{ fontSize: 9, fontWeight: 900, color: C.muted, margin: '0 0 2px', textTransform: 'uppercase' }}>Classes</p>
                 <h3 style={{ fontSize: 24, fontWeight: 900, color: C.purple, margin: 0 }}>{gData.length}</h3>
               </div>
               <div style={{ background: '#fff', borderRadius: 16, padding: 12, border: `1px solid ${C.border}`, textAlign: 'center' }}>
                 <p style={{ fontSize: 9, fontWeight: 900, color: C.muted, margin: '0 0 2px', textTransform: 'uppercase' }}>Avg Rate</p>
                 <h3 style={{ fontSize: 24, fontWeight: 900, color: C.green, margin: 0 }}>{gData.length ? Math.round(gData.reduce((a,b)=>a+b.percent,0)/gData.length) : 0}%</h3>
               </div>
             </div>
             <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
               {gData.map((d, i) => (
                 <div key={i} style={{ padding: '12px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div>
                     <div style={{ fontWeight: 800, fontSize: 14 }}>{fmtDate(d.date)}</div>
                     <div style={{ fontSize: 10, fontWeight: 700, color: C.muted }}>{d.present}/{d.total} students</div>
                   </div>
                   <div style={{ fontWeight: 900, fontSize: 15, color: d.percent > 90 ? C.green : (d.percent > 70 ? '#f59e0b' : C.red) }}>{d.percent}%</div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* SELF */}
        {tab === 'my' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
             <div style={{ background: '#fff', borderRadius: 18, padding: 20, textAlign: 'center', border: `1px solid ${C.border}` }}>
                <p style={{ fontSize: 10, fontWeight: 900, color: C.muted, textTransform: 'uppercase' }}>MY RFID</p>
                <h3 style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: '2px 0 0' }}>{teacher?.teacher_rfid || 'Not Assigned'}</h3>
             </div>
             <div style={{ background: '#fff', borderRadius: 18, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
               {myAttData.map((r, i) => (
                 <div key={i} style={{ padding: '12px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ fontWeight: 800, fontSize: 13 }}>{fmtDate(r.attendence_date)}</div>
                   <div style={{ fontWeight: 900, color: C.green, fontSize: 13 }}>{fmtTime(r.attendence_time)}</div>
                 </div>
               ))}
             </div>
          </div>
        )}
      </main>

      {tab === 'today' && date === new Date().toISOString().split('T')[0] && (
        <div style={{ position: 'fixed', bottom: 16, left: 16, right: 16, maxWidth: 568, margin: '0 auto', zIndex: 200 }}>
          <button onClick={save} disabled={saving || loading} style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', background: C.purple, color: '#fff', fontWeight: 900, fontSize: 16, boxShadow: '0 8px 24px rgba(99,102,241,0.4)', transition: 'all 0.2s', opacity: (saving || loading) ? 0.7 : 1 }}>{saving ? 'UPDATING...' : `SAVE (${statVals.present})`}</button>
        </div>
      )}
    </div>
  );
};

export default Attendance;
