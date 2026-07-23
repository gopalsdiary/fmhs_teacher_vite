import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { initSupabase, checkAuth, logout as authLogout } from '../auth-check'

interface Assignment {
  id: number
  subject_code: string
  exam_id: number
  class: number
  section: string
  subject_name: string
  teacher_name_en: string
  final_submitted: boolean
  exams: { exam_name: string; year: number; is_live: boolean; teacher_entry_enabled: boolean }
}

export default function TeacherExamDashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'locked'>('all')
  const [userEmail, setUserEmail] = useState('')
  const [teacherName, setTeacherName] = useState('')
  
  const supabase = initSupabase()

  async function handleLogout() {
    if (confirm('Confirm Logout?')) {
      await authLogout()
      navigate('/login')
    }
  }

  useEffect(() => {
    loadAssignments()

    // Query database when tab gains focus
    const handleFocus = () => loadAssignments()
    window.addEventListener('focus', handleFocus)

    // Poll status updates every 30 seconds
    const interval = setInterval(loadAssignments, 30000)

    return () => {
      window.removeEventListener('focus', handleFocus)
      clearInterval(interval)
    }
  }, [])

  async function loadAssignments() {
    const teacher = await checkAuth()
    if (!teacher) { navigate('/login'); return }
    const email = teacher.teacher_email_id || teacher.teacher_email || ''
    setUserEmail(email)

    const { data: teacherSelections, error: selectionError } = await supabase
      .from('FMHS_exam_teacher_selection')
      .select('*')
      .eq('teacher_email_id', email)
      .not('exam_id', 'is', null)
    
    if (selectionError) {
      console.error('Error loading assignments:', selectionError)
      setLoading(false)
      return
    }

    if (!teacherSelections || teacherSelections.length === 0) {
      setAssignments([])
      setLoading(false)
      return
    }

    // Capture teacher name from the selections
    if (teacherSelections[0]?.teacher_name_en) {
      setTeacherName(teacherSelections[0].teacher_name_en)
    }

    // Fetch details of all unique exams and valid exam subjects referenced by assignments
    const examIds = [...new Set(teacherSelections.map((s: any) => Number(s.exam_id)))]
    
    const [{ data: exams, error: examsError }, { data: examSubjects }] = await Promise.all([
      supabase
        .from('FMHS_exams_names')
        .select('id, exam_name, year, is_live, teacher_entry_enabled')
        .in('id', examIds),
      supabase
        .from('FMHS_exam_subjects')
        .select('exam_id, subject_code, subject_name')
        .in('exam_id', examIds)
    ])

    if (examsError) {
      console.error('Error loading exam metadata:', examsError)
      setLoading(false)
      return
    }

    // Build lookup set for active (exam_id + subject_code)
    const activeSubjectKeys = new Set(
      (examSubjects || []).map((es: any) => `${es.exam_id}_${es.subject_code}`)
    )

    // Map exam details onto each assignment and filter for live exams & valid subject codes
    const mapped = teacherSelections.map((s: any) => {
      const exam = (exams || []).find((e: any) => Number(e.id) === Number(s.exam_id))
      return {
        ...s,
        exams: exam || { exam_name: 'Unknown Exam', year: 0, is_live: false, teacher_entry_enabled: false }
      }
    }).filter((a: any) => {
      if (!a.exams.is_live) return false
      // Filter out obsolete subject codes if examSubjects has active subjects for this exam
      if (activeSubjectKeys.size > 0) {
        const key = `${a.exam_id}_${a.subject_code}`
        return activeSubjectKeys.has(key)
      }
      return true
    })

    // Deduplicate by (exam_id, class, section, subject_name) - keeping highest ID (newest entry)
    const dedupedMap = new Map<string, any>()
    for (const item of mapped) {
      const uniqueKey = `${item.exam_id}_${item.class}_${item.section}_${item.subject_name}`.toLowerCase()
      if (!dedupedMap.has(uniqueKey) || Number(item.id) > Number(dedupedMap.get(uniqueKey).id)) {
        dedupedMap.set(uniqueKey, item)
      }
    }

    setAssignments(Array.from(dedupedMap.values()))
    setLoading(false)
  }

  // Filter assignments based on search query and status filter
  const filteredAssignments = assignments.filter(a => {
    const matchesSearch = 
      a.subject_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.exams.exam_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.class.toString().includes(searchQuery) ||
      a.section.toLowerCase().includes(searchQuery.toLowerCase())

    const isEditable = a.exams.is_live && a.exams.teacher_entry_enabled && !a.final_submitted

    if (statusFilter === 'open') {
      return matchesSearch && isEditable
    }
    if (statusFilter === 'locked') {
      return matchesSearch && !isEditable
    }
    return matchesSearch
  })

  // Compute stats
  const totalCount = assignments.length
  const openCount = assignments.filter(a => a.exams.is_live && a.exams.teacher_entry_enabled && !a.final_submitted).length
  const lockedCount = totalCount - openCount

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  )

  // Helper to format section nicely (e.g. GOLAP -> Golap)
  const formatSection = (sec: string) => {
    if (!sec) return ''
    return sec.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ')
  }

  // Group filtered assignments by exam
  const examGroups = filteredAssignments.reduce((acc, curr) => {
    const examId = curr.exam_id
    if (!acc[examId]) {
      acc[examId] = {
        examName: curr.exams.exam_name,
        year: curr.exams.year,
        isLive: curr.exams.is_live,
        teacherEntryEnabled: curr.exams.teacher_entry_enabled,
        assignments: []
      }
    }
    acc[examId].assignments.push(curr)
    return acc
  }, {} as Record<number, { examName: string; year: number; isLive: boolean; teacherEntryEnabled: boolean; assignments: Assignment[] }>)

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#1e293b', fontFamily: "'Outfit', sans-serif" }}>
      
      {/* HEADER */}
      <header style={{ 
        background: 'rgba(255, 255, 255, 0.85)', 
        backdropFilter: 'blur(12px)',
        padding: '12px 20px', 
        borderBottom: '1px solid #edf2f7', 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        position: 'sticky', 
        top: 0, 
        zIndex: 100, 
        boxShadow: '0 4px 30px rgba(0,0,0,0.02)' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ 
            width: '34px', 
            height: '34px', 
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
            borderRadius: '10px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            color: '#fff', 
            fontWeight: 800,
            fontSize: '1.05rem',
            boxShadow: '0 3px 8px rgba(79, 70, 229, 0.15)'
          }}>T</div>
          <div>
            <h1 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px' }}>Teacher Portal</h1>
            <p style={{ margin: 0, fontSize: '8px', color: '#6366f1', fontWeight: 800, letterSpacing: '0.5px' }}>FENI MODEL HIGH SCHOOL</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ textAlign: 'right', display: 'block' }}>
             <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>{teacherName || 'Honorable Teacher'}</div>
             <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 500 }}>{userEmail}</div>
          </div>
          <button onClick={() => handleLogout()} style={{ 
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', 
            border: 'none', 
            color: '#fff', 
            padding: '7px 14px', 
            borderRadius: '8px', 
            cursor: 'pointer', 
            fontWeight: 800, 
            fontSize: '11px',
            letterSpacing: '0.3px',
            transition: 'all 0.2s ease-in-out',
            boxShadow: '0 4px 10px rgba(239, 68, 68, 0.25)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-1px) scale(1.02)'
            e.currentTarget.style.boxShadow = '0 6px 14px rgba(239, 68, 68, 0.35)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = '0 4px 10px rgba(239, 68, 68, 0.25)'
          }}
          >LOGOUT</button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 16px' }}>
        
        {/* WELCOME BANNER */}
        <div style={{ 
          background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)', 
          borderRadius: '16px', 
          padding: '16px 20px', 
          color: '#fff', 
          marginBottom: '20px',
          boxShadow: '0 6px 20px rgba(30, 27, 75, 0.12)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>
              Welcome, {teacherName || 'Instructor'} 👋
            </h2>
            <p style={{ color: '#c7d2fe', fontSize: '12px', marginTop: '4px', marginBottom: 0, maxWidth: '600px', lineHeight: 1.4 }}>
              Select a class assignment below to enter current exam session.
            </p>
          </div>
          {/* Subtle design element */}
          <div style={{ 
            position: 'absolute', 
            right: '-30px', 
            bottom: '-30px', 
            width: '130px', 
            height: '130px', 
            borderRadius: '50%', 
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12) 0%, rgba(99,102,241,0) 70%)',
            zIndex: 1
          }} />
        </div>


        {/* SEARCH & FILTERS BAR */}
        <div style={{ 
          background: '#fff', 
          padding: '10px 14px', 
          borderRadius: '12px', 
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.01)'
        }}>
          {/* SEARCH */}
          <div style={{ position: 'relative', flex: '1 1 260px' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '12px' }}>🔍</span>
            <input 
              type="text" 
              placeholder="Search by subject name, class, section..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                outline: 'none',
                transition: 'border-color 0.2s',
                fontFamily: 'inherit'
              }}
              onFocus={e => e.target.style.borderColor = '#6366f1'}
              onBlur={e => e.target.style.borderColor = '#cbd5e1'}
            />
          </div>

          {/* FILTERS */}
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            <button 
              onClick={() => setStatusFilter('all')}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                background: statusFilter === 'all' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
                color: statusFilter === 'all' ? '#fff' : '#64748b',
                boxShadow: statusFilter === 'all' ? '0 4px 8px rgba(79, 70, 229, 0.25)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={e => {
                if (statusFilter !== 'all') e.currentTarget.style.color = '#0f172a'
              }}
              onMouseLeave={e => {
                if (statusFilter !== 'all') e.currentTarget.style.color = '#64748b'
              }}
            >
              All ({totalCount})
            </button>
            <button 
              onClick={() => setStatusFilter('open')}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                background: statusFilter === 'open' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                color: statusFilter === 'open' ? '#fff' : '#64748b',
                boxShadow: statusFilter === 'open' ? '0 4px 8px rgba(16, 185, 129, 0.25)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={e => {
                if (statusFilter !== 'open') e.currentTarget.style.color = '#0f172a'
              }}
              onMouseLeave={e => {
                if (statusFilter !== 'open') e.currentTarget.style.color = '#64748b'
              }}
            >
              Open ({openCount})
            </button>
            <button 
              onClick={() => setStatusFilter('locked')}
              style={{
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                background: statusFilter === 'locked' ? 'linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)' : 'transparent',
                color: statusFilter === 'locked' ? '#fff' : '#64748b',
                boxShadow: statusFilter === 'locked' ? '0 4px 8px rgba(168, 85, 247, 0.25)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={e => {
                if (statusFilter !== 'locked') e.currentTarget.style.color = '#0f172a'
              }}
              onMouseLeave={e => {
                if (statusFilter !== 'locked') e.currentTarget.style.color = '#64748b'
              }}
            >
              Locked ({lockedCount})
            </button>
          </div>
        </div>

        {/* ASSIGNMENTS BY EXAM GROUP */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {Object.entries(examGroups).map(([examId, group]) => {
            return (
              <div key={examId} style={{
                background: '#fff',
                borderRadius: '16px',
                border: '1.5px solid #f97316', // FMHS iconic orange border preserved for continuity
                padding: '20px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {/* Exam Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>📝</span>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                      {group.examName}
                    </h3>
                    <span style={{ 
                      padding: '3px 8px', 
                      background: '#f1f5f9', 
                      color: '#475569', 
                      borderRadius: '6px', 
                      fontSize: '10px', 
                      fontWeight: 800 
                    }}>
                      {group.year} Session
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', background: '#f1f5f9', padding: '3px 8px', borderRadius: '6px' }}>
                    {group.assignments.length} {group.assignments.length === 1 ? 'Assignment' : 'Assignments'}
                  </div>
                </div>

                {/* Structured Columns Table View */}
                <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #fed7aa' }}>
                  <div style={{ minWidth: '650px' }}>
                    {/* Header Row */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '45px 1.2fr 2fr 1fr 1.2fr',
                      gap: '12px',
                      padding: '10px 16px',
                      background: '#fff7ed',
                      borderBottom: '1.5px solid #ffedd5',
                      fontSize: '11px',
                      fontWeight: 800,
                      color: '#9a3412',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      <div style={{ textAlign: 'center' }}>SL.</div>
                      <div>🏫 Class (ক্লাস)</div>
                      <div>📚 Subject (বিষয়)</div>
                      <div>🔢 Subject Code (বিষয় কোড)</div>
                      <div style={{ textAlign: 'center' }}>⚡ Entry</div>
                    </div>

                    {/* Rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0', background: '#fff' }}>
                      {group.assignments.map((a, index) => {
                        const isEditable = a.exams.is_live && a.exams.teacher_entry_enabled && !a.final_submitted

                        // Compute status properties
                        let statusLabel = 'Locked'
                        let statusBg = '#faf5ff'
                        let statusColor = '#9333ea'
                        let statusIcon = '🔒'

                        if (isEditable) {
                          statusLabel = 'Entry Open'
                          statusBg = '#ecfdf5'
                          statusColor = '#059669'
                          statusIcon = '✍️'
                        } else if (!a.exams.is_live || !a.exams.teacher_entry_enabled) {
                          statusLabel = 'Entry closed'
                          statusBg = '#fff7ed'
                          statusColor = '#ea580c'
                          statusIcon = '🚫'
                        }

                        return (
                          <Link 
                            key={a.id} 
                            to={`/teacher-entry/${a.exam_id}/${a.id}`} 
                            style={{ textDecoration: 'none', display: 'block', margin: '0 8px' }}
                          >
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: '45px 1.2fr 2fr 1fr 1.2fr',
                              alignItems: 'center',
                              padding: '12px 14px',
                              background: '#fff',
                              border: '1.5px solid #f97316',
                              borderRadius: '10px',
                              transition: 'all 0.2s ease-in-out',
                              gap: '12px'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = '#ea580c'
                              e.currentTarget.style.background = '#fff7ed'
                              e.currentTarget.style.transform = 'translateX(4px)'
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(249, 115, 22, 0.12)'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = '#f97316'
                              e.currentTarget.style.background = '#fff'
                              e.currentTarget.style.transform = 'none'
                              e.currentTarget.style.boxShadow = 'none'
                            }}
                            >
                              {/* Column 0: Serial Number */}
                              <div style={{ 
                                fontSize: '13px', 
                                fontWeight: 800, 
                                color: '#9a3412',
                                textAlign: 'center'
                              }}>
                                {index + 1}.
                              </div>

                              {/* Column 1: Class */}
                              <div style={{ 
                                fontSize: '13px', 
                                fontWeight: 800, 
                                color: '#ea580c',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}>
                                <span>{a.class} {formatSection(a.section)}</span>
                              </div>

                              {/* Column 2: Subject */}
                              <div style={{ 
                                fontSize: '13px', 
                                fontWeight: 700, 
                                color: '#0f172a'
                              }}>
                                {a.subject_name}
                              </div>

                              {/* Column 3: Subject Code */}
                              <div style={{ 
                                fontSize: '12px', 
                                fontWeight: 700, 
                                color: '#64748b'
                              }}>
                                Code: {a.subject_code}
                              </div>

                              {/* Column 4: Entry */}
                              <div style={{ display: 'flex', justifyContent: 'center' }}>
                                <div style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '5px', 
                                  padding: '5px 12px', 
                                  background: statusBg, 
                                  color: statusColor, 
                                  borderRadius: '8px', 
                                  fontSize: '11px', 
                                  fontWeight: 800,
                                  border: `1px solid ${statusColor}33`
                                }}>
                                  <span>{statusIcon}</span>
                                  <span>{statusLabel}</span>
                                </div>
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {filteredAssignments.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              padding: '40px 16px', 
              background: '#fff', 
              borderRadius: '14px', 
              border: '2px dashed #cbd5e1' 
            }}>
              <div style={{ fontSize: '30px', marginBottom: '12px' }}>🔍</div>
              <h3 style={{ color: '#0f172a', fontWeight: 800, margin: '0 0 6px 0', fontSize: '14px' }}>No matching assignments found</h3>
              <p style={{ color: '#64748b', margin: 0, fontSize: '12px' }}>
                {assignments.length === 0 
                  ? 'No classes have been assigned to your account yet.' 
                  : 'Try adjusting your search terms or filter selections.'}
              </p>
            </div>
          )}
        </div>

      </main>
    </div>
  )
}
