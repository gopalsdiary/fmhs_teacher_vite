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
  const [view, setView] = useState<'list' | 'chat' | 'contacts'>('list');
  const [blockedIds, setBlockedIds] = useState<Record<string, boolean>>({});

  const navigate = useNavigate();
  const supabase = initSupabase();
  const msgSupabase = initMsgSupabase();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const user = await checkAuth();
      if (!user) { navigate('/login'); return; }
      setCurrentUser(user);

      // Fetch students for teacher's class/section
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

      // Fetch Initial Data
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
      student_iid: studentIid, 
      is_disabled: newVal,
      updated_at: new Date().toISOString()
    });
    
    setBlockedIds(prev => ({ ...prev, [studentIid]: newVal }));
  };

  const fetchPresence = async () => {
    const { data } = await msgSupabase.from('teacher_presence').select('*');
    const pMap: Record<string, string> = {};
    data?.forEach((p: any) => {
      const lastSeen = new Date(p.last_seen).getTime();
      const now = new Date().getTime();
      pMap[p.email] = (now - lastSeen < 60000) ? 'online' : 'offline';
    });
    setPresence(pMap);
  };

  const fetchRecentChats = async (teacherEmail: string, students: any[]) => {
    const { data: msgs } = await msgSupabase
      .from('fmhs_student_messages')
      .select('*')
      .eq('teacher_email', teacherEmail)
      .order('created_at', { ascending: false });

    if (!msgs) return;

    const chatMap = new Map();
    msgs.forEach((m: any) => {
      if (!chatMap.has(m.student_iid.toString())) {
        const studentInfo = students.find(s => s.iid.toString() === m.student_iid.toString());
        chatMap.set(m.student_iid.toString(), {
          iid: m.student_iid,
          lastMessage: m.message,
          time: m.created_at,
          isRead: m.is_read || m.sender_type === 'teacher',
          unreadCount: msgs.filter((msg: any) => msg.student_iid === m.student_iid && msg.sender_type === 'student' && !msg.is_read).length,
          student: studentInfo || { student_name_en: `Student ${m.student_iid}`, active_roll: '?' }
        });
      }
    });
    setRecentChats(Array.from(chatMap.values()));
  };

  useEffect(() => {
    if (!selectedStudent || !currentUser) return;

    const markAsRead = async () => {
      await msgSupabase
        .from('fmhs_student_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('teacher_email', currentUser.teacher_email)
        .eq('student_iid', selectedStudent.iid)
        .eq('sender_type', 'student')
        .eq('is_read', false);
    };

    const fetchMessages = async () => {
      const { data } = await msgSupabase
        .from('fmhs_student_messages')
        .select('*')
        .eq('teacher_email', currentUser.teacher_email)
        .eq('student_iid', selectedStudent.iid)
        .order('created_at', { ascending: true });
      setMessages(data || []);
      markAsRead();
    };

    fetchMessages();

    // Realtime
    const channel = msgSupabase.channel(`student_chat:${selectedStudent.iid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fmhs_student_messages' }, (p: any) => {
        if (p.new && p.new.student_iid.toString() === selectedStudent.iid.toString() && p.new.teacher_email === currentUser.teacher_email) {
            setMessages(prev => {
                const exists = prev.find(m => m.id === p.new.id);
                if (exists) return prev.map(m => m.id === p.new.id ? p.new : m);
                return [...prev, p.new];
            });
            if (p.new.sender_type === 'student') markAsRead();
        }
      })
      .subscribe();

    return () => { msgSupabase.removeChannel(channel); };
  }, [selectedStudent]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !selectedStudent) return;
    const txt = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const { data: sent } = await msgSupabase.from('fmhs_student_messages').insert({
      student_iid: selectedStudent.iid,
      teacher_email: currentUser.teacher_email,
      message: txt,
      sender_type: 'teacher',
      is_read: false
    }).select();

    setSending(false);
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>Loading Chats...</div>;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, maxWidth: 600, margin: '0 auto', fontFamily: 'Segoe UI, Helvetica, Arial, sans-serif' }}>
      
      {view === 'list' && (
        <>
          <header style={{ padding: '20px', background: '#fff', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: C.text, margin: 0 }}>Student Chats</h1>
              <p style={{ fontSize: 13, color: C.muted, fontWeight: 600, margin: 0 }}>Class {currentUser?.access_class} Messages</p>
            </div>
            <button onClick={() => navigate('/dashboard')} style={{ border: 'none', background: '#F0F2F5', width: 44, height: 44, borderRadius: '50%', fontSize: 20 }}>←</button>
          </header>

          <main style={{ flex: 1, overflowY: 'auto' }}>
            {recentChats.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: C.muted }}>
                    <p style={{ fontSize: 48, margin: 0 }}>💬</p>
                    <p style={{ fontWeight: 700 }}>No conversations yet.</p>
                </div>
            )}
            {recentChats.map((chat, i) => (
              <div key={i} onClick={() => { setSelectedStudent(chat.student); setView('chat'); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', margin: '4px 8px', borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#E4E6EB', overflow: 'hidden' }}>
                    {chat.student.student_photo_url ? <img src={chat.student.student_photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👤</div>}
                  </div>
                  {presence[chat.iid.toString()] === 'online' && <div style={{ position: 'absolute', bottom: 3, right: 3, width: 12, height: 12, background: C.green, border: '2px solid #fff', borderRadius: '50%' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: chat.unreadCount > 0 ? 800 : 700, color: C.text }}>{chat.student.student_name_en}</p>
                    <span style={{ fontSize: 12, color: C.muted }}>{new Date(chat.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: chat.unreadCount > 0 ? C.text : C.muted, fontWeight: chat.unreadCount > 0 ? 700 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {chat.lastMessage}
                  </p>
                </div>
                {chat.unreadCount > 0 && <div style={{ width: 22, height: 22, background: C.fbBlue, color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>{chat.unreadCount}</div>}
              </div>
            ))}
          </main>
          <button onClick={() => setView('contacts')} style={{ position: 'fixed', bottom: 30, right: 20, width: 60, height: 60, borderRadius: '50%', border: 'none', background: C.fbBlue, color: '#fff', fontSize: 28, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 100 }}>➕</button>
        </>
      )}

      {view === 'contacts' && (
        <>
          <header style={{ padding: '16px', background: '#fff', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setView('list')} style={{ border: 'none', background: 'transparent', fontSize: 22 }}>←</button>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>New Conversation</h1>
          </header>
          <div style={{ padding: '12px 16px' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student..." style={{ width: '100%', padding: '10px 16px', borderRadius: 20, border: 'none', background: '#E4E6EB', outline: 'none', fontSize: 15 }} />
          </div>
          <main style={{ flex: 1, overflowY: 'auto' }}>
            {myStudents.filter(s => s.student_name_en?.toLowerCase().includes(search.toLowerCase())).map((s, i) => (
              <div key={i} onClick={() => { setSelectedStudent(s); setView('chat'); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#E4E6EB', overflow: 'hidden' }}>
                    {s.student_photo_url ? <img src={s.student_photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>}
                </div>
                <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{s.student_name_en}</p>
                    <p style={{ margin: 0, fontSize: 12, color: C.muted }}>Roll: {s.active_roll} • {s.active_class}</p>
                </div>
              </div>
            ))}
          </main>
        </>
      )}

      {view === 'chat' && selectedStudent && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <header style={{ padding: '10px 16px', background: '#fff', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 2px 4px rgba(0,0,0,0.05)', zIndex: 10 }}>
            <button onClick={() => setView('list')} style={{ border: 'none', background: 'transparent', fontSize: 22, color: C.fbBlue }}>←</button>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden' }}>
                {selectedStudent.student_photo_url ? <img src={selectedStudent.student_photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#E4E6EB' }}>👤</div>}
              </div>
              {presence[selectedStudent.iid.toString()] === 'online' && <div style={{ position: 'absolute', bottom: 1, right: 1, width: 10, height: 10, background: C.green, border: '2px solid #fff', borderRadius: '50%' }} />}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>{selectedStudent.student_name_en}</h3>
              <p style={{ margin: 0, fontSize: 11, color: presence[selectedStudent.iid.toString()] === 'online' ? C.green : C.muted, fontWeight: 700 }}>{presence[selectedStudent.iid.toString()] === 'online' ? 'Active now' : 'Offline'}</p>
            </div>
            <button 
                onClick={() => toggleBlock(selectedStudent.iid)}
                style={{ background: blockedIds[selectedStudent.iid] ? '#FAEAEF' : '#F0F2F5', color: blockedIds[selectedStudent.iid] ? '#E0245E' : C.text, border: 'none', padding: '8px 12px', borderRadius: 12, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
            >
                {blockedIds[selectedStudent.iid] ? '🚫 Disallowed' : '✅ Allowed'}
            </button>
          </header>

          <main ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 4, background: '#fff' }}>
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
                 <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#E4E6EB', margin: '0 auto 10px', overflow: 'hidden' }}>
                    {selectedStudent.student_photo_url ? <img src={selectedStudent.student_photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>👤</div>}
                 </div>
                 <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{selectedStudent.student_name_en}</h2>
                 <p style={{ color: C.muted, fontSize: 13 }}>Student • Roll {selectedStudent.active_roll}</p>
            </div>

            {messages.map((m, i) => {
              const isMe = m.sender_type === 'teacher';
              const nextM = messages[i+1];
              const isLastInGroup = !nextM || nextM.sender_type !== m.sender_type;
              
              return (
                <div key={i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%', marginBottom: isLastInGroup ? 8 : 2 }}>
                  <div style={{ 
                    padding: '8px 14px', 
                    borderRadius: isMe 
                        ? (isLastInGroup ? '18px 18px 2px 18px' : '18px 18px 18px 18px')
                        : (isLastInGroup ? '18px 18px 18px 2px' : '18px 18px 18px 18px'), 
                    background: isMe ? C.msgOutgoing : C.msgIncoming, 
                    color: isMe ? '#fff' : C.text,
                    fontSize: 15,
                    fontWeight: 500
                  }}>
                    {m.message}
                  </div>
                  {isLastInGroup && isMe && (
                      <div style={{ textAlign: 'right', fontSize: 10, color: C.muted, marginTop: 2, marginRight: 4, fontWeight: 800 }}>
                          {m.is_read ? 'Seen' : 'Delivered'}
                      </div>
                  )}
                </div>
              );
            })}
          </main>

          <footer style={{ padding: '12px 16px', background: '#fff' }}>
            {blockedIds[selectedStudent.iid] ? (
                <div style={{ textAlign: 'center', padding: 10, background: '#F8F9FA', borderRadius: 12, border: '1px dashed #DDD' }}>
                    <p style={{ margin: 0, fontSize: 13, color: '#E0245E', fontWeight: 800 }}>Messaging is disabled for this student.</p>
                </div>
            ) : (
                <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input 
                    value={newMessage} 
                    onChange={e => setNewMessage(e.target.value)} 
                    placeholder="Type a message..." 
                    style={{ flex: 1, padding: '12px 16px', borderRadius: 22, border: 'none', background: '#F0F2F5', outline: 'none', fontSize: 15 }} 
                />
                <button 
                    disabled={!newMessage.trim() || sending} 
                    style={{ background: 'transparent', border: 'none', color: C.fbBlue, fontSize: 24, padding: 0, cursor: 'pointer', opacity: (!newMessage.trim() || sending) ? 0.5 : 1 }}
                >
                    ➤
                </button>
                </form>
            )}
          </footer>
        </div>
      )}
    </div>
  );
};

export default StudentChat;
