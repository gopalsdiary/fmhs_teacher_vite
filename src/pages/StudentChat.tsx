import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { initSupabase, initMsgSupabase, checkAuth } from '../auth-check';

// Facebook/Messenger Colors
const C = {
  fbBlue: '#1877F2',
  msgIncoming: '#E4E6EB',
  msgOutgoing: '#0084FF',
  bg: '#F0F2F5',
  card: '#ffffff',
  text: '#050505',
  muted: '#65676B',
  green: '#31A24C',
  border: '#CED0D4'
};

const StudentChat: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [myStudents, setMyStudents] = useState<any[]>([]);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [presence, setPresence] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [view, setView] = useState<'list' | 'chat' | 'contacts' | 'broadcast_list' | 'edit_broadcast'>('list');
  const [blockedIds, setBlockedIds] = useState<Record<string, boolean>>({});
  
  // Broadcast Logic
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [settingsLoad, setSettingsLoad] = useState(false);

  // Default values
  const now = new Date();
  const fifteenDaysLater = new Date();
  fifteenDaysLater.setDate(now.getDate() + 15);
  const formatDateForInput = (d: Date) => d.toISOString().slice(0, 16);
  const formatDateOnlyForInput = (d: Date) => d.toISOString().split('T')[0];

  const [broadcastForm, setBroadcastForm] = useState({
    id: null,
    template: 'সম্মানিত অভিভাবক, ক্লাস টিচারের সাথে যোগাযোগ করুণ।',
    start: formatDateForInput(now),
    end: formatDateOnlyForInput(fifteenDaysLater),
    enabled: true
  });

  const navigate = useNavigate();
  const supabase = initSupabase();
  const msgSupabase = initMsgSupabase();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const user = await checkAuth();
      if (!user) { navigate('/login'); return; }
      setCurrentUser(user);

      const asgn = user.allAssignments || [{ access_class: user.access_class, access_section: user.access_section }];
      let studentList: any[] = [];
      for (const a of asgn) {
        const { data } = await supabase.from('student_database')
          .select('iid, student_name_en, active_roll, student_photo_url, active_class, active_section')
          .eq('active_class', a.access_class)
          .eq('active_section', a.access_section)
          .order('active_roll', { ascending: true });
        if (data) studentList = [...studentList, ...data];
      }
      const unique = studentList.filter((s, i, self) => i === self.findIndex(t => t.iid === s.iid));
      setMyStudents(unique);

      await fetchRecentChats(user.teacher_email, unique);
      await fetchPresence();
      await fetchBlockedStatus();
      setLoading(false);
      
      const pInterval = setInterval(fetchPresence, 30000);
      return () => clearInterval(pInterval);
    };
    init();
  }, [navigate]);

  const fetchBlockedStatus = async () => {
    const { data } = await msgSupabase.from('student_messaging_status').select('*');
    const bMap: any = {};
    data?.forEach((b: any) => bMap[b.student_iid] = b.is_disabled);
    setBlockedIds(bMap);
  };

  const toggleBlock = async (studentIid: any) => {
    const currentVal = blockedIds[studentIid] || false;
    const newVal = !currentVal;
    await msgSupabase.from('student_messaging_status').upsert({ 
      student_iid: studentIid, is_disabled: newVal, updated_at: new Date().toISOString()
    });
    setBlockedIds(prev => ({ ...prev, [studentIid]: newVal }));
  };

  const fetchPresence = async () => {
    const { data } = await msgSupabase.from('teacher_presence').select('*');
    const pMap: Record<string, string> = {};
    data?.forEach((p: any) => {
      const lastSeen = new Date(p.last_seen).getTime();
      const nowTs = new Date().getTime();
      pMap[p.email] = (nowTs - lastSeen < 60000) ? 'online' : 'offline';
    });
    setPresence(pMap);
  };

  const fetchRecentChats = async (teacherEmail: string, students: any[]) => {
    const { data: msgs } = await msgSupabase.from('fmhs_student_messages').select('*')
      .eq('teacher_email', teacherEmail).order('created_at', { ascending: false });
    if (!msgs) return;
    const chatMap = new Map();
    msgs.forEach((m: any) => {
      if (!chatMap.has(m.student_iid.toString())) {
        const studentInfo = students.find(s => s.iid.toString() === m.student_iid.toString());
        chatMap.set(m.student_iid.toString(), {
          iid: m.student_iid,
          lastMessage: m.message,
          time: m.created_at,
          unreadCount: msgs.filter((msg: any) => msg.student_iid === m.student_iid && msg.sender_type === 'student' && !msg.is_read).length,
          student: studentInfo || { student_name_en: `Student ${m.student_iid}`, active_roll: '?' }
        });
      }
    });
    setRecentChats(Array.from(chatMap.values()));
  };

  const fetchBroadcastHistory = async () => {
    if (!currentUser) return;
    setSettingsLoad(true);
    // Use main supabase client and correct primary key/id
    const { data } = await supabase.from('fmhs_bulk_notification')
      .select('*')
      .eq('teacher_email', currentUser.teacher_email)
      .order('updated_at', { ascending: false });
    setBroadcasts(data || []);
    setSettingsLoad(false);
  };

  useEffect(() => {
    if (view === 'broadcast_list') fetchBroadcastHistory();
  }, [view]);

  const handleEditBroadcast = (b: any) => {
    setBroadcastForm({
      id: b.id,
      template: b.msg_template_text,
      start: b.start_time ? new Date(b.start_time).toISOString().slice(0, 16) : formatDateForInput(new Date()),
      end: b.end_time || formatDateOnlyForInput(fifteenDaysLater),
      enabled: b.is_enabled
    });
    setView('edit_broadcast');
  };

  const saveBroadcast = async () => {
    if (!currentUser) return;
    setSettingsLoad(true);
    const dataToSave = {
      teacher_email: currentUser.teacher_email,
      teacher_name: currentUser.teacher_name,
      target_class: currentUser.access_class,
      target_section: currentUser.access_section,
      msg_template_text: broadcastForm.template,
      start_time: new Date(broadcastForm.start).toISOString(),
      end_time: broadcastForm.end,
      is_enabled: broadcastForm.enabled,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('fmhs_bulk_notification').upsert({
        ...(broadcastForm.id ? { id: broadcastForm.id } : {}),
        ...dataToSave
    });
    
    if (error) {
        console.error('Save failed:', error);
        alert('Could not save: ' + error.message);
    } else {
        setView('broadcast_list');
    }
    setSettingsLoad(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !selectedStudent) return;
    const txt = newMessage.trim();
    setNewMessage('');
    setSending(true);
    await msgSupabase.from('fmhs_student_messages').insert({
      student_iid: selectedStudent.iid,
      teacher_email: currentUser.teacher_email,
      message: txt, sender_type: 'teacher', is_read: false
    });
    setSending(false);
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>Loading...</div>;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, maxWidth: 600, margin: '0 auto', fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif' }}>
      
      {view === 'list' && (
        <>
          <header style={{ padding: '20px', background: '#fff', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: C.text, margin: 0 }}>Student Chats</h1>
              <p style={{ fontSize: 13, color: C.muted, fontWeight: 600, margin: 0 }}>Messages Portal</p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setView('broadcast_list')} style={{ border: 'none', background: '#F0F2F5', width: 44, height: 44, borderRadius: '50%', fontSize: 20 }}>⚙️</button>
                <button onClick={() => navigate('/dashboard')} style={{ border: 'none', background: '#F0F2F5', width: 44, height: 44, borderRadius: '50%', fontSize: 20 }}>←</button>
            </div>
          </header>

          <main style={{ flex: 1, overflowY: 'auto' }}>
            <div onClick={() => setView('broadcast_list')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px', background: `linear-gradient(135deg, ${C.fbBlue}, #00c6ff)`, margin: '8px', borderRadius: 16, cursor: 'pointer', color: '#fff', boxShadow: '0 4px 15px rgba(24,119,242,0.3)' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📢</div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Broadcast History</p>
                <p style={{ margin: 0, fontSize: 11, opacity: 0.8, fontWeight: 700 }}>View and edit sent class notifications</p>
              </div>
              <div style={{ fontSize: 20 }}>›</div>
            </div>

            {recentChats.map((chat, i) => (
              <div key={i} onClick={() => { setSelectedStudent(chat.student); setView('chat'); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', margin: '4px 8px', borderRadius: 12, cursor: 'pointer' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#E4E6EB', overflow: 'hidden' }}>
                    {chat.student.student_photo_url ? <img src={chat.student.student_photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👤</div>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{chat.student.student_name_en}</p>
                    <p style={{ margin: 0, fontSize: 14, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.lastMessage}</p>
                </div>
              </div>
            ))}
          </main>
          <button onClick={() => setView('contacts')} style={{ position: 'fixed', bottom: 30, right: 20, width: 60, height: 60, borderRadius: '50%', border: 'none', background: C.fbBlue, color: '#fff', fontSize: 28, boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>➕</button>
        </>
      )}

      {view === 'chat' && selectedStudent && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <header style={{ padding: '10px 16px', background: '#fff', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setView('list')} style={{ border: 'none', background: 'transparent', fontSize: 22, color: C.fbBlue }}>←</button>
            <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden' }}>
                {selectedStudent.student_photo_url ? <img src={selectedStudent.student_photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E4E6EB' }}>👤</div>}
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selectedStudent.student_name_en}</h3>
          </header>
          <main style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {messages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.sender_type === 'teacher' ? 'flex-end' : 'flex-start', maxWidth: '75%', marginBottom: 8 }}>
                   <div style={{ padding: '8px 14px', borderRadius: 18, background: m.sender_type === 'teacher' ? C.msgOutgoing : C.msgIncoming, color: m.sender_type === 'teacher' ? '#fff' : C.text }}>{m.message}</div>
                </div>
            ))}
          </main>
          <footer style={{ padding: '12px 16px' }}>
              <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 10 }}>
                <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: '12px 16px', borderRadius: 22, border: 'none', background: '#F0F2F5', outline: 'none' }} />
                <button disabled={!newMessage.trim()} style={{ background: 'transparent', border: 'none', color: C.fbBlue, fontSize: 24 }}>➤</button>
              </form>
          </footer>
        </div>
      )}

      {view === 'broadcast_list' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <header style={{ padding: '10px 16px', background: '#fff', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setView('list')} style={{ border: 'none', background: 'transparent', fontSize: 22, color: C.fbBlue }}>←</button>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Broadcast History</h3>
          </header>
          
          <main style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <button onClick={() => { setBroadcastForm({ id: null, template: 'সম্মানিত অভিভাবক, ক্লাস টিচারের সাথে যোগাযোগ করুণ।', start: formatDateForInput(new Date()), end: formatDateOnlyForInput(fifteenDaysLater), enabled: true }); setView('edit_broadcast'); }} style={{ width: '100%', padding: 16, marginBottom: 20, background: C.fbBlue, color: '#fff', border: 'none', borderRadius: 12, fontWeight: 800 }}>+ Send New Broadcast</button>
            
            {broadcasts.map((b, i) => (
              <div key={i} onClick={() => handleEditBroadcast(b)} style={{ background: '#f8fafc', padding: 16, borderRadius: 16, border: `1px solid ${C.border}`, marginBottom: 12, cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: C.fbBlue }}>{new Date(b.updated_at).toLocaleDateString()}</span>
                  <span style={{ fontSize: 10, background: b.is_enabled ? '#e7f3ff' : '#eee', color: b.is_enabled ? C.fbBlue : C.muted, padding: '2px 8px', borderRadius: 10, fontWeight: 800 }}>{b.is_enabled ? 'Active' : 'Disabled'}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{b.msg_template_text}</p>
                <div style={{ marginTop: 10, fontSize: 11, color: C.muted, fontWeight: 600 }}>Expires: {b.end_time}</div>
              </div>
            ))}
            {broadcasts.length === 0 && <div style={{ textAlign: 'center', marginTop: 40, color: C.muted }}>No broadcasts found.</div>}
          </main>
        </div>
      )}

      {view === 'edit_broadcast' && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <header style={{ padding: '10px 16px', background: '#fff', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setView('broadcast_list')} style={{ border: 'none', background: 'transparent', fontSize: 22, color: C.fbBlue }}>←</button>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{broadcastForm.id ? 'Edit Broadcast' : 'New Broadcast'}</h3>
          </header>
          <main style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 800, color: C.muted, display: 'block', marginBottom: 8 }}>MESSAGE TEMPLATE</label>
            <textarea value={broadcastForm.template} onChange={e => setBroadcastForm(p => ({ ...p, template: e.target.value }))} style={{ width: '100%', minHeight: 120, padding: 16, borderRadius: 16, border: `1px solid ${C.border}`, marginBottom: 20, fontSize: 14, outline: 'none' }} />
            
            <label style={{ fontSize: 12, fontWeight: 800, color: C.muted, display: 'block', marginBottom: 8 }}>START DATE & TIME</label>
            <input type="datetime-local" value={broadcastForm.start} onChange={e => setBroadcastForm(p => ({ ...p, start: e.target.value }))} style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 20, outline: 'none' }} />
            
            <label style={{ fontSize: 12, fontWeight: 800, color: C.muted, display: 'block', marginBottom: 8 }}>END DATE</label>
            <input type="date" value={broadcastForm.end} onChange={e => setBroadcastForm(p => ({ ...p, end: e.target.value }))} style={{ width: '100%', padding: 12, borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 20, outline: 'none' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
                <span style={{ fontWeight: 700 }}>Enable Notification</span>
                <input type="checkbox" checked={broadcastForm.enabled} onChange={e => setBroadcastForm(p => ({ ...p, enabled: e.target.checked }))} style={{ width: 24, height: 24 }} />
            </div>

            <button onClick={saveBroadcast} disabled={settingsLoad} style={{ width: '100%', padding: 16, background: C.fbBlue, color: '#fff', border: 'none', borderRadius: 16, fontSize: 16, fontWeight: 900 }}>{settingsLoad ? 'Saving...' : (broadcastForm.id ? 'Update Broadcast' : 'Send Broadcast')}</button>
          </main>
        </div>
      )}

      {view === 'contacts' && (
        <>
          <header style={{ padding: '16px', background: '#fff', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setView('list')} style={{ border: 'none', background: 'transparent', fontSize: 22 }}>←</button>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Contacts</h1>
          </header>
          <main style={{ flex: 1, overflowY: 'auto' }}>
            {myStudents.map((s, i) => (
              <div key={i} onClick={() => { setSelectedStudent(s); setView('chat'); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${C.bg}` }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#eee', overflow: 'hidden' }}>
                    {s.student_photo_url && <img src={s.student_photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>{s.student_name_en}</p>
                    <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Roll: {s.active_roll}</p>
                </div>
              </div>
            ))}
          </main>
        </>
      )}
    </div>
  );
};

export default StudentChat;
