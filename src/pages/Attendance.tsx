import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { initSupabase, checkAuth } from '../auth-check';
import { cacheGet, cacheSet } from '../cache';
import { useOfflineSync } from '../hooks/useOfflineSync';
import { useOfflineMutation } from '../hooks/useOfflineMutation';

const C = { 
  purple: '#6366f1', 
  green: '#10b981', 
  red: '#ef4444', 
  bg: '#f8fafc', 
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#f1f5f9',
  orange: '#f97316',
  blue: '#3b82f6'
};

const isGeneric = (c: any) => {
  const s = String(c || '').trim().toLowerCase();
  return !s || s === '0' || s === 'null' || s === 'undefined' || s === 'n/a' || s === 'none';
};

const fmtTime = (t: string) => {
  if (!t) return '–';
  try { return new Date('1970-01-01T' + t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }); }
  catch { return t; }
};
const fmtDate = (d: string) => {
  try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
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
  const [iidMap, setIidMap]       = useState<Record<string, any>>({});

  const [selStud, setSelStud]             = useState<any>(null);
  const [studHistory, setStudHistory]     = useState<any[]>([]);
  const [studHistoryLoad, setStudHistoryLoad] = useState(false);

  const [hData, setHData]     = useState<any[]>([]);
  const [gData, setGData]     = useState<any[]>([]);
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
      let unique = await cacheGet<any[]>(studKey);
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
        await cacheSet(studKey, unique);
      }

      setStudents(unique);

      const rfidCards = unique.map(s => s.rfid_card_no ? String(s.rfid_card_no).trim() : '').filter(Boolean);
      const manualIds = unique.map(s => `MANUAL-${s.iid}`);
      const allIdentities = [...rfidCards, ...manualIds];
      
      let rfidMap: Record<string, any> = {};
      let iidMap: Record<string, any> = {};

      if (allIdentities.length) {
        const { data: rd } = await supabase.from('attendence_entry').select('*').eq('attendence_date', d)
          .in('rfid_card_no', allIdentities).order('attendence_time', { ascending: true });

        (rd || []).forEach((e: any) => {
          const card = String(e.rfid_card_no || '').trim();
          if (card.startsWith('MANUAL-')) {
            const sid = card.replace('MANUAL-', '');
            if (!iidMap[sid]) iidMap[sid] = { firstScan: e.attendence_time, status: e.attendence_status };
          } else if (!isGeneric(card)) {
            if (!rfidMap[card]) rfidMap[card] = { firstScan: e.attendence_time, status: e.attendence_status };
          }
        });
      }
      setRfid(rfidMap);
      setIidMap(iidMap);
      const init: Record<string, 'present' | 'absent'> = {};
      unique.forEach(s => { 
        const card = s.rfid_card_no ? String(s.rfid_card_no).trim() : '';
        const sid = String(s.iid);
        // A student is present if they have an iid record OR they have a non-generic RFID record
        const isPresent = iidMap[sid] || (card && !isGeneric(card) && rfidMap[card]);
        init[s.iid] = isPresent ? 'present' : 'absent'; 
      });
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
      const rfidCards = students.map(s => s.rfid_card_no ? String(s.rfid_card_no).trim() : '').filter(Boolean);
      const manualIds = students.map(s => `MANUAL-${s.iid}`);
      const allIdentities = [...rfidCards, ...manualIds];

      supabase.from('attendence_entry').select('attendence_date, rfid_card_no, attendence_status')
        .in('rfid_card_no', allIdentities)
        .order('attendence_date', { ascending: false }).limit(5000)
        .then(({ data, error }: any) => {
          if (error) notify('error', 'Failed to fetch logs.');
          const group: Record<string, { presentSet: Set<string> }> = {};
          (data || []).forEach((entry: any) => {
            const d = entry.attendence_date;
            if (!group[d]) group[d] = { presentSet: new Set() };
            group[d].presentSet.add(String(entry.rfid_card_no).trim());
          });
          
          const historyArr = Object.keys(group).map(d => {
            const g = group[d];
            const presentCount = students.filter(s => {
              const sid = `MANUAL-${s.iid}`;
              const card = s.rfid_card_no ? String(s.rfid_card_no).trim() : '';
              return g.presentSet.has(sid) || (card && g.presentSet.has(card));
            }).length;
            return { date: d, present: presentCount, total: students.length, percent: Math.round((presentCount / students.length) * 100) };
          }).sort((a,b) => b.date.localeCompare(a.date));
          setGData(historyArr);
        });
    }
  }, [tab, teacher, students.length]);

  const isToday = date === new Date().toISOString().split('T')[0];
  const mark = (id: string, status: 'present' | 'absent') => { if(isToday) setAtt(p => ({ ...p, [id]: status })); };

  const { mutate: performSave, isSyncing, pendingCount } = useOfflineMutation({
    action: 'save-attendance',
    executor: async (payload: any) => {
      const { toInsert, toDelete, date } = payload;
      const now = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour12: false });
      
      if (toInsert.length > 0) {
        const ins = toInsert.map((s: any) => ({ 
          rfid_card_no: `MANUAL-${s.iid}`, 
          attendence_date: date, 
          attendence_time: now,
          attendence_status: 'M'
        }));
        await supabase.from('attendence_entry').insert(ins);
      }
      
      if (toDelete.length > 0) {
        const manualCards = toDelete.map((s: any) => `MANUAL-${s.iid}`);
        await supabase.from('attendence_entry').delete()
          .eq('attendence_date', date)
          .eq('attendence_status', 'M')
          .in('rfid_card_no', manualCards);
      }
      return { success: true };
    },
    onSuccess: (res: any) => {
      if (res?.queued) {
        notify('success', 'Saved offline! Will sync when online.');
      } else {
        notify('success', '✓ Synced with server!');
        loadData(date);
      }
    },
    onError: (err) => notify('error', 'Failed to save: ' + err.message)
  });

  const save = async () => {
    if (!isToday) { notify('error', 'Only today!'); return; }
    
    const toInsert = students.filter(s => {
      const isMarked = att[s.iid] === 'present';
      const alreadyInDb = iidMap[String(s.iid)] || (s.rfid_card_no && !isGeneric(s.rfid_card_no) && rfid[String(s.rfid_card_no).trim()]);
      return isMarked && !alreadyInDb;
    });

    const toDelete = students.filter(s => {
      const isAbsent = att[s.iid] === 'absent';
      const manualRecord = iidMap[String(s.iid)];
      return isAbsent && manualRecord && manualRecord.status === 'M';
    });

    if (toInsert.length === 0 && toDelete.length === 0) {
      notify('success', 'No manual changes to save.');
      return;
    }

    setSaving(true);
    try {
      await performSave({ toInsert, toDelete, date });
    } catch (e: any) {
      // Error handled by mutation hook
    } finally {
      setSaving(false);
    }
  };


  const reset = async () => {
    if (!isToday) { notify('error', 'Only today!'); return; }
    if (!confirm('This will ONLY reset manual attendance.')) return;
    setSaving(true);
    try {
      const manualCards = students.map(s => `MANUAL-${s.iid}`);
      await supabase.from('attendence_entry').delete()
        .eq('attendence_date', date)
        .eq('attendence_status', 'M')
        .in('rfid_card_no', manualCards);
      
      notify('success', 'Manual Attendance Reset!');
      loadData(date);
    } catch (e: any) { notify('error', e.message); }
    finally { setSaving(false); }
  };

  const statVals = { total: students.length, present: Object.values(att).filter(v => v === 'present').length, absent: students.length - Object.values(att).filter(v => v === 'present').length };
  const unsavedCount = students.filter(s => {
    const sid = String(s.iid);
    const card = s.rfid_card_no ? String(s.rfid_card_no).trim() : '';
    
    const isMarked = att[s.iid] === 'present';
    const isInDb = iidMap[sid] || (card && !isGeneric(card) && rfid[card]);
    
    const isAbsent = att[s.iid] === 'absent';
    const isManual = iidMap[sid] && iidMap[sid].status === 'M';
    
    // Unsaved if: Marked present but not in DB OR Marked absent but manual record exists in DB
    return (isMarked && !isInDb) || (isAbsent && isManual);
  }).length;

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
          {pendingCount > 0 && (
            <div style={{ background: C.orange, color: 'white', borderRadius: 10, padding: '4px 10px', fontSize: 10, fontWeight: 900, animation: 'pulse 2s infinite' }}>
              SYNCING ({pendingCount})
            </div>
          )}
        </div>
        <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', padding: '0 8px' }}>
          {['today', 'history', 'students', 'my'].map(t => (
            <button key={t} onClick={() => { setTab(t); if(t !== 'students') setSelStud(null); }} style={{ flex: 1, padding: '12px 0', border: 'none', background: 'none', fontWeight: 900, fontSize: 11, color: tab === t ? C.purple : C.muted, borderBottom: `2.5px solid ${tab === t ? C.purple : 'transparent'}`, transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t === 'my' ? 'Self' : (t === 'history' ? 'Logs' : (t === 'students' ? 'Students' : 'Mark'))}</button>
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
            <div style={{ 
              background: `linear-gradient(135deg, ${C.orange}, #fb923c)`, 
              borderRadius: 20, 
              padding: '16px 20px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 15, 
              marginBottom: 12,
              boxShadow: '0 10px 25px rgba(249,115,22,0.2)',
              border: 'none'
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>📅</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 900, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: 1 }}>Attendance Date</p>
                <input 
                  type="date" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  max={new Date().toISOString().split('T')[0]} 
                  style={{ 
                    width: '100%',
                    border: 'none', 
                    background: 'transparent', 
                    fontSize: 18, 
                    fontWeight: 900, 
                    color: '#fff', 
                    outline: 'none',
                    marginTop: 2
                  }} 
                />
              </div>
            </div>

            {loading ? <div style={{ padding: '80px 0', textAlign: 'center' }}><div style={{ width: 28, height: 28, border: '2px solid #eee', borderTopColor: C.purple, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} /></div> : (
              students.map((s, idx) => (
                <div key={s.iid} style={{ background: '#fff', borderRadius: 16, padding: '12px 14px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, animation: `fadeIn 0.2s ease ${idx * 0.01}s both` }}>
                   <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: C.purple, flexShrink: 0 }}>{s.active_roll}</div>
                   <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.student_name_en}</h4>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: (iidMap[String(s.iid)] || rfid[String(s.rfid_card_no).trim()]) ? C.green : C.muted, margin: 0 }}>
                          {(iidMap[String(s.iid)] || rfid[String(s.rfid_card_no).trim()]) ? `IN: ${fmtTime((iidMap[String(s.iid)] || rfid[String(s.rfid_card_no).trim()]).firstScan)}` : 'Manual'}
                        </p>
                        {isGeneric(s.rfid_card_no) && <span style={{ fontSize: 8, color: C.red, fontWeight: 900, background: '#fee2e2', padding: '1px 4px', borderRadius: 4 }}>NO UNIQUE CARD</span>}
                      </div>
                   </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                       {['present', 'absent'].map(st => {
                         const isRfidOnly = !iidMap[String(s.iid)] && (s.rfid_card_no && !isGeneric(s.rfid_card_no) && rfid[String(s.rfid_card_no).trim()]);
                         const canChange = isToday && !(isRfidOnly && st === 'absent');
                         return (
                           <button 
                             key={st} 
                             onClick={() => canChange && mark(s.iid, st as any)} 
                             style={{ 
                               width: 40, height: 40, borderRadius: 10, border: 'none', 
                               background: att[s.iid] === st ? (st === 'present' ? C.green : C.red) : '#f1f5f9', 
                               color: att[s.iid] === st ? '#fff' : '#cbd5e1', 
                               fontSize: 16, fontWeight: 800, transition: 'all 0.15s', 
                               opacity: canChange ? 1 : 0.35, 
                               cursor: canChange ? 'pointer' : 'not-allowed',
                               position: 'relative'
                             }}
                             title={!canChange ? 'RFID record cannot be absent' : ''}
                           >
                             {st === 'present' ? '✓' : '✗'}
                             {!canChange && <div style={{ position: 'absolute', top: -4, right: -4, fontSize: 8 }}>🔒</div>}
                           </button>
                         );
                       })}
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
                 <div key={i} 
                    onClick={() => {
                      setDate(d.date);
                      setTab('today');
                    }}
                    style={{ padding: '12px 16px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                   <div>
                     <div style={{ fontWeight: 800, fontSize: 14, color: C.orange }}>{fmtDate(d.date)}</div>
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
                   <div style={{ fontWeight: 800, fontSize: 13, color: C.orange }}>{fmtDate(r.attendence_date)}</div>
                   <div style={{ fontWeight: 900, color: C.green, fontSize: 13 }}>{fmtTime(r.attendence_time)}</div>
                 </div>
               ))}
             </div>
          </div>
        )}

        {/* STUDENTS SECTION */}
        {tab === 'students' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!selStud ? (
              students.map((s, idx) => (
                <div key={s.iid} onClick={async () => {
                  setSelStud(s);
                  setStudHistoryLoad(true);
                  const { data } = await supabase.from('attendence_entry').select('*')
                    .in('rfid_card_no', [`MANUAL-${s.iid}`, String(s.rfid_card_no||'').trim()])
                    .order('attendence_date', { ascending: false }).order('attendence_time', { ascending: false }).limit(50);
                  setStudHistory(data || []);
                  setStudHistoryLoad(false);
                }} style={{ background: '#fff', borderRadius: 16, padding: '12px 14px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', animation: `fadeIn 0.2s ease ${idx * 0.01}s both` }}>
                   <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: C.purple }}>{s.active_roll}</div>
                   <div style={{ flex: 1 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: 0 }}>{s.student_name_en}</h4>
                      <p style={{ fontSize: 10, color: C.muted, margin: 0 }}>IID: {s.iid}</p>
                   </div>
                   <div style={{ color: C.purple, fontWeight: 900, fontSize: 18 }}>›</div>
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button onClick={() => setSelStud(null)} style={{ alignSelf: 'flex-start', border: 'none', background: 'none', color: C.purple, fontWeight: 900, fontSize: 12, marginBottom: 5 }}>← Back to List</button>
                
                <div style={{ background: '#fff', borderRadius: 20, padding: 20, border: `1px solid ${C.border}`, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 15 }}>
                      <div style={{ width: 50, height: 50, borderRadius: 15, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👤</div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.text }}>{selStud.student_name_en}</h3>
                        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.muted }}>Roll {selStud.active_roll} • Section {selStud.active_section}</p>
                      </div>
                   </div>
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: '#f8fafc', padding: 10, borderRadius: 12 }}>
                        <p style={{ margin: 0, fontSize: 8, fontWeight: 900, color: C.muted }}>FATHER</p>
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 800 }}>{selStud.father_name_en || '--'}</p>
                      </div>
                      <div style={{ background: '#f8fafc', padding: 10, borderRadius: 12 }}>
                        <p style={{ margin: 0, fontSize: 8, fontWeight: 900, color: C.muted }}>MOTHER</p>
                        <p style={{ margin: 0, fontSize: 10, fontWeight: 800 }}>{selStud.mother_name_en || '--'}</p>
                      </div>
                   </div>
                   <button onClick={() => navigate(`/student-info?iid=${selStud.iid}`)} style={{ width: '100%', marginTop: 12, padding: '10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 10, fontWeight: 900, color: C.purple }}>VIEW FULL PROFILE</button>
                </div>

                <div style={{ background: '#fff', borderRadius: 20, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
                       <span style={{ fontSize: 11, fontWeight: 900 }}>ATTENDANCE HISTORY</span>
                       <span style={{ fontSize: 10, fontWeight: 900, color: C.purple }}>Total: {studHistory.length}</span>
                    </div>
                    {studHistoryLoad ? <div style={{ padding: 40, textAlign: 'center' }}><div style={{ width: 22, height: 22, border: '2px solid #eee', borderTopColor: C.purple, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} /></div> : (
                      studHistory.length > 0 ? studHistory.map((r, i) => (
                        <div key={i} style={{ padding: '12px 18px', borderBottom: '1px solid #f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                           <div>
                             <div style={{ fontWeight: 800, fontSize: 13, color: C.orange }}>{fmtDate(r.attendence_date)}</div>
                             <div style={{ fontSize: 9, fontWeight: 700, color: C.muted }}>{r.attendence_status === 'M' ? 'Manual Entry' : 'RFID Scan'}</div>
                           </div>
                           <div style={{ textAlign: 'right' }}>
                             <div style={{ fontWeight: 900, color: C.green, fontSize: 13 }}>{fmtTime(r.attendence_time)}</div>
                             <div style={{ fontSize: 8, fontWeight: 900, background: '#dcfce7', color: '#166534', padding: '1px 5px', borderRadius: 4, display: 'inline-block' }}>PRESENT</div>
                           </div>
                        </div>
                      )) : <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: C.muted, fontWeight: 700 }}>No records found</div>
                    )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {tab === 'today' && isToday && unsavedCount > 0 && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', width: 'auto', zIndex: 200, display: 'flex', gap: 10, background: 'rgba(255,255,255,0.8)', padding: '8px 12px', borderRadius: 24, backdropFilter: 'blur(15px)', border: '1px solid rgba(255,255,255,0.3)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
          <button onClick={reset} disabled={saving || loading} style={{ width: 44, height: 44, borderRadius: 18, border: 'none', background: '#fee2e2', color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, transition: 'all 0.2s', opacity: (saving || loading) ? 0.7 : 1 }}>🗑️</button>
          <button onClick={save} disabled={saving || loading} style={{ height: 44, padding: '0 24px', borderRadius: 18, border: 'none', background: `linear-gradient(135deg, ${C.purple}, ${C.blue || '#6366f1'})`, color: '#fff', fontWeight: 900, fontSize: 14, boxShadow: '0 4px 12px rgba(99,102,241,0.3)', transition: 'all 0.2s', opacity: (saving || loading) ? 0.7 : 1 }}>{saving ? 'UPDATING...' : `SAVE (${unsavedCount} CHANGES)`}</button>
        </div>
      )}
    </div>
  );
};

export default Attendance;
