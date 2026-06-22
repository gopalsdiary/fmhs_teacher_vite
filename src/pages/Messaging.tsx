import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { initSupabase, initMsgSupabase, checkAuth } from '../auth-check';

const C = { 
  primary: '#f97316', 
  secondary: '#fb923c',
  bg: '#fff7ed', 
  card: '#fff', 
  text: '#431407', 
  muted: '#9a3412',
  border: '#ffedd5',
  incoming: '#f3f4f6',
  outgoing: '#ffedd5',
  whatsapp: '#10b981'
};

const Messaging: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [allTeachers, setAllTeachers] = useState<any[]>([]);
  const [recentChats, setRecentChats] = useState<any[]>([]);
  const [presence, setPresence] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [selectedRecipient, setSelectedRecipient] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [view, setView] = useState<'list' | 'chat' | 'contacts'>('list');
  
  const navigate = useNavigate();
  const supabase = initSupabase();
  const msgSupabase = initMsgSupabase();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const user = await checkAuth();
      if (!user) { navigate('/login'); return; }
      setCurrentUser(user);

      const { data: tList } = await supabase.from('teacher_database').select('*');
      const list = tList || [];
      setAllTeachers(list);

      // Presence Heartbeat
      updatePresence(user.teacher_email);
      const heartbeat = setInterval(() => updatePresence(user.teacher_email), 30000);

      // Fetch Initial Data
      await fetchRecentChats(user.teacher_email, list);
      await fetchPresence();

      // Request Notification Permission
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }

      setLoading(false);
      return () => clearInterval(heartbeat);
    };

    init();
  }, [navigate]);

  // Global Real-time Listener (Separate from Init to avoid state race)
  useEffect(() => {
    if (!currentUser) return;

    const channelId = `notify:${currentUser.teacher_email}:${Date.now()}`;
    const globalSub = msgSupabase.channel(channelId)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'fmhs_teacher_messages',
        filter: `recipient_email=eq.${currentUser.teacher_email}`
      }, (p: any) => {
        const sender = allTeachers.find(t => t.teacher_email_id?.toLowerCase() === p.new.sender_email?.toLowerCase());
        showNotification(sender?.teacher_name_en || p.new.sender_email, p.new.message);
        fetchRecentChats(currentUser.teacher_email, allTeachers); 
      })
      .subscribe();
      
    return () => { supabase.removeChannel(globalSub); };
  }, [currentUser, allTeachers, supabase]);

  const showNotification = (senderName: string, message: string) => {
    if (Notification.permission === 'granted' && document.hidden) {
      const n = new Notification(`New message from ${senderName}`, {
        body: message,
        icon: '/android-chrome-192x192.png'
      });
      n.onclick = () => {
        window.focus();
        n.close();
      };
    }
  };

  const updatePresence = async (email: string) => {
    await msgSupabase.from('teacher_presence').upsert({
      email,
      last_seen: new Date().toISOString(),
      status: 'online'
    });
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

  const fetchRecentChats = async (myEmail: string, teachers: any[]) => {
    const { data: msgs } = await msgSupabase
      .from('fmhs_teacher_messages')
      .select('sender_email, recipient_email, message, created_at, is_read')
      .or(`sender_email.eq.${myEmail},recipient_email.eq.${myEmail}`)
      .order('created_at', { ascending: false })
      .limit(50); // সাম্প্রতিক ৫০টি মেসেজই যথেষ্ট

    if (!msgs) return;

    const chatMap = new Map();
    msgs.forEach((m: any) => {
      const otherEmail = m.sender_email === myEmail ? m.recipient_email : m.sender_email;
      if (!chatMap.has(otherEmail)) {
        const teacherInfo = teachers.find(t => t.teacher_email_id?.toLowerCase() === otherEmail?.toLowerCase());
        chatMap.set(otherEmail, {
          email: otherEmail,
          lastMessage: m.message,
          time: m.created_at,
          isRead: m.is_read || m.sender_email === myEmail,
          unreadCount: msgs.filter((msg: any) => msg.sender_email === otherEmail && msg.recipient_email === myEmail && !msg.is_read).length,
          teacher: teacherInfo || { teacher_name_en: otherEmail, designation_bn: 'Teacher' }
        });
      }
    });
    setRecentChats(Array.from(chatMap.values()));
  };

  useEffect(() => {
    if (!selectedRecipient || !currentUser) return;

    const markAsRead = async () => {
      await msgSupabase
        .from('fmhs_teacher_messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('recipient_email', currentUser.teacher_email)
        .eq('sender_email', selectedRecipient.email)
        .eq('is_read', false);
    };

    const fetchMessages = async () => {
      const { data } = await msgSupabase
        .from('fmhs_teacher_messages')
        .select('*')
        .or(`and(sender_email.eq.${currentUser.teacher_email},recipient_email.eq.${selectedRecipient.email}),and(sender_email.eq.${selectedRecipient.email},recipient_email.eq.${currentUser.teacher_email})`)
        .order('created_at', { ascending: true })
        .limit(100); // সাম্প্রতিক ১০০টি মেসেজ
      setMessages(data || []);
      markAsRead();
    };

    fetchMessages();

    const sub = msgSupabase.channel(`room:${selectedRecipient.email}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fmhs_teacher_messages' }, (p: any) => {
        if (p.eventType === 'INSERT') {
          const isRelated = (p.new.sender_email === currentUser.teacher_email && p.new.recipient_email === selectedRecipient.email) ||
                            (p.new.sender_email === selectedRecipient.email && p.new.recipient_email === currentUser.teacher_email);
          if (isRelated) {
            setMessages(prev => [...prev.filter(m => m.id !== p.new.id), p.new]);
            if (p.new.recipient_email === currentUser.teacher_email) markAsRead();
          }
        } else if (p.eventType === 'UPDATE') {
          setMessages(prev => prev.map(m => m.id === p.new.id ? p.new : m));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [selectedRecipient, currentUser]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    const txt = newMessage.trim();
    setNewMessage('');
    setSending(true);
    await msgSupabase.from('fmhs_teacher_messages').insert([{
      sender_email: currentUser.teacher_email,
      recipient_email: selectedRecipient.email,
      message: txt
    }]);
    setSending(false);
  };

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}><div style={{ width: 32, height: 32, border: '3px solid #eee', borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff', maxWidth: 600, margin: '0 auto' }}>
      
      {view === 'list' && (
        <>
          <header style={{ padding: '24px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: C.text, margin: 0 }}>Messages</h1>
              <p style={{ fontSize: 12, color: C.muted, fontWeight: 700, margin: 0 }}>Active Now</p>
            </div>
            <button onClick={() => navigate('/dashboard')} style={{ border: 'none', background: '#f8fafc', width: 44, height: 44, borderRadius: 15, fontSize: 20 }}>←</button>
          </header>

          <main style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
            {recentChats.map((chat, i) => (
              <div key={i} onClick={() => { setSelectedRecipient(chat); setView('chat'); }} style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '16px', borderRadius: 20, cursor: 'pointer', marginBottom: 5 }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 56, height: 56, borderRadius: 20, background: '#f1f5f9', overflow: 'hidden' }}>
                    {chat.teacher.pp_photo ? <img src={chat.teacher.pp_photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>👤</div>}
                  </div>
                  {presence[chat.email] === 'online' && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, background: C.whatsapp, border: '3px solid #fff', borderRadius: '50%' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: chat.unreadCount > 0 ? 900 : 700, color: C.text }}>{chat.teacher.teacher_name_en}</p>
                    <span style={{ fontSize: 10, color: chat.unreadCount > 0 ? C.primary : C.muted, fontWeight: 800 }}>{new Date(chat.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: chat.unreadCount > 0 ? C.text : C.muted, fontWeight: chat.unreadCount > 0 ? 900 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chat.lastMessage}</p>
                </div>
                {chat.unreadCount > 0 && <div style={{ width: 20, height: 20, background: C.primary, color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900 }}>{chat.unreadCount}</div>}
              </div>
            ))}
          </main>
          <button onClick={() => setView('contacts')} style={{ position: 'fixed', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 22, border: 'none', background: C.primary, color: '#fff', fontSize: 28, boxShadow: '0 10px 25px rgba(249,115,22,0.4)', zIndex: 100 }}>➕</button>
        </>
      )}

      {view === 'contacts' && (
        <>
          <header style={{ padding: '20px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 15 }}>
            <button onClick={() => setView('list')} style={{ border: 'none', background: '#f8fafc', width: 36, height: 36, borderRadius: 10, fontSize: 18 }}>←</button>
            <h1 style={{ fontSize: 18, fontWeight: 900, color: C.text, margin: 0 }}>New Chat</h1>
          </header>
          <div style={{ padding: 12 }}>
             <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search teacher..." style={{ width: '100%', padding: '12px 16px', borderRadius: 15, border: `1px solid ${C.border}`, background: '#f8fafc', outline: 'none' }} />
          </div>
          <main style={{ flex: 1, overflowY: 'auto' }}>
            {allTeachers.filter(t => t.teacher_name_en?.toLowerCase().includes(search.toLowerCase()) && t.teacher_email_id !== currentUser.teacher_email).map((t, i) => (
              <div key={i} onClick={() => { setSelectedRecipient({email: t.teacher_email_id, teacher: t}); setView('chat'); }} style={{ display: 'flex', alignItems: 'center', gap: 15, padding: '12px 20px', cursor: 'pointer' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 15, background: '#f1f5f9', overflow: 'hidden' }}>
                    {t.pp_photo ? <img src={t.pp_photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>👤</div>}
                  </div>
                  {presence[t.teacher_email_id] === 'online' && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, background: C.whatsapp, border: '2px solid #fff', borderRadius: '50%' }} />}
                </div>
                <div><p style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>{t.teacher_name_en}</p><p style={{ margin: 0, fontSize: 11, color: C.muted }}>{t.designation_bn}</p></div>
              </div>
            ))}
          </main>
        </>
      )}

      {view === 'chat' && selectedRecipient && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f3f4f6' }}>
          <header style={{ padding: '12px 16px', background: '#fff', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => { setView('list'); fetchRecentChats(currentUser.teacher_email, allTeachers); }} style={{ border: 'none', background: 'transparent', fontSize: 20 }}>←</button>
            <div style={{ position: 'relative' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden' }}>
                {selectedRecipient.teacher.pp_photo ? <img src={selectedRecipient.teacher.pp_photo} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eee' }}>👤</div>}
              </div>
              {presence[selectedRecipient.email] === 'online' && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 10, height: 10, background: C.whatsapp, border: '2px solid #fff', borderRadius: '50%' }} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>{selectedRecipient.teacher.teacher_name_en}</h3>
              <p style={{ margin: 0, fontSize: 10, color: presence[selectedRecipient.email] === 'online' ? C.whatsapp : C.muted, fontWeight: 800 }}>{presence[selectedRecipient.email] === 'online' ? 'Online' : 'Offline'}</p>
            </div>
          </header>

          <main ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map((m, i) => {
              const isMe = m.sender_email === currentUser.teacher_email;
              return (
                <div key={i} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <div style={{ padding: '10px 14px', borderRadius: isMe ? '18px 18px 2px 18px' : '18px 18px 18px 2px', background: isMe ? C.primary : '#fff', color: isMe ? '#fff' : C.text, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{m.message}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
                      <p style={{ margin: 0, fontSize: 8, opacity: 0.8 }}>{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      {isMe && <span style={{ fontSize: 10, color: m.is_read ? '#fff' : 'rgba(255,255,255,0.6)' }}>{m.is_read ? '✓✓' : '✓'}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </main>

          <footer style={{ padding: '15px', background: '#fff' }}>
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 10 }}>
              <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." style={{ flex: 1, padding: '12px 18px', borderRadius: 25, border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none' }} />
              <button disabled={!newMessage.trim() || sending} style={{ width: 48, height: 48, borderRadius: '50%', border: 'none', background: C.primary, color: '#fff', fontSize: 18 }}>✈️</button>
            </form>
          </footer>
        </div>
      )}
    </div>
  );
};

export default Messaging;
