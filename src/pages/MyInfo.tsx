import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { initSupabase, checkAuth } from '../auth-check';

const C = { 
  primary: '#f97316', 
  secondary: '#fb923c',
  bg: '#fff7ed', 
  card: '#fff', 
  text: '#431407', 
  muted: '#9a3412',
  border: '#ffedd5',
  label: '#78350f'
};

const MyInfo: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState<string | null>(null);
  const navigate = useNavigate();
  const supabase = initSupabase();

  useEffect(() => {
    const fetchInfo = async () => {
      const user = await checkAuth();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data: info, error } = await supabase
        .from('teacher_database')
        .select('*')
        .eq('teacher_email_id', user.teacher_email)
        .maybeSingle();

      if (error) {
        console.error('Error fetching teacher data:', error);
      } else {
        setData(info);
      }
      setLoading(false);
    };

    fetchInfo();
  }, [navigate, supabase]);

  if (loading) return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}><div style={{ width: 32, height: 32, border: '3px solid #eee', borderTopColor: C.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /></div>;

  if (!data) return (
    <div style={{ padding: 40, textAlign: 'center', background: C.bg, minHeight: '100vh' }}>
      <h2 style={{ color: C.text }}>Teacher profile not found</h2>
      <p style={{ color: C.muted }}>Please contact admin to link your email to the teacher database.</p>
      <button onClick={() => navigate('/dashboard')} style={{ marginTop: 20, padding: '12px 24px', borderRadius: 12, border: 'none', background: C.primary, color: '#fff', fontWeight: 800 }}>Back to Dashboard</button>
    </div>
  );

  const Section = ({ title, items, icon }: any) => (
    <div style={{ background: '#fff', borderRadius: 24, padding: '24px', border: `1px solid ${C.border}`, marginBottom: 20, boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <h3 style={{ fontSize: 13, fontWeight: 900, color: C.primary, textTransform: 'uppercase', letterSpacing: 1, margin: 0 }}>{title}</h3>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {items.map((item: any, i: number) => (
          <div key={i} style={{ borderBottom: i === items.length - 1 ? 'none' : '1px solid #fff7ed', paddingBottom: 15 }}>
            <div style={{ marginBottom: item.bn ? 12 : 0 }}>
              <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>{item.label} {item.bn ? '(EN)' : ''}</p>
              <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: C.text }}>{item.val || '—'}</p>
            </div>
            {item.bn && (
              <div>
                <p style={{ margin: 0, fontSize: 10, fontWeight: 800, color: C.muted, textTransform: 'uppercase' }}>{item.label} (BN)</p>
                <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 700, color: C.text }}>{item.bn}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 40 }}>
      {/* Premium Header */}
      <header style={{ 
        background: `linear-gradient(135deg, ${C.primary}, ${C.secondary})`, 
        height: 180, 
        width: '100%', 
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
         <button onClick={() => navigate('/dashboard')} style={{ position: 'absolute', top: 20, left: 20, border: 'none', background: 'rgba(255,255,255,0.25)', width: 36, height: 36, borderRadius: 12, color: '#fff', fontSize: 20, backdropFilter: 'blur(10px)', cursor: 'pointer', zIndex: 10 }}>←</button>
         
         {/* Decorative Circles */}
         <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
         <div style={{ position: 'absolute', bottom: -20, left: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
      </header>

      <main style={{ maxWidth: 600, margin: '-60px auto 0', padding: '0 16px', position: 'relative' }}>
        {/* Profile Card Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
           <div 
            onClick={() => data.pp_photo && setShowPreview(data.pp_photo)}
            style={{ 
              width: 120, 
              height: 120, 
              borderRadius: '50%', 
              background: '#fff', 
              margin: '0 auto', 
              border: '5px solid #fff', 
              overflow: 'hidden', 
              boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
              position: 'relative',
              zIndex: 2,
              cursor: 'pointer'
            }}>
              {data.pp_photo ? (
                <img src={data.pp_photo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60 }}>👤</div>
              )}
           </div>
           <div style={{ marginTop: 16 }}>
              <h1 style={{ color: C.text, fontSize: 26, fontWeight: 900, margin: 0, letterSpacing: -0.5 }}>{data.teacher_name_en}</h1>
              <p style={{ color: C.primary, fontSize: 13, fontWeight: 800, margin: '4px 0 0', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                {data.designation_en} • <span style={{ color: C.muted }}>{data.subject_en}</span>
              </p>
           </div>
        </div>
        <Section 
          title="General Information" 
          icon="📝" 
          items={[
            { label: 'Full Name', val: data.teacher_name_en, bn: data.teacher_name_bn },
            { label: 'Designation', val: data.designation_en, bn: data.designation_bn },
            { label: 'Subject', val: data.subject_en, bn: data.subject_bn },
            { label: 'Sector', val: data.sector }
          ]}
        />

        <Section 
          title="Career & Service" 
          icon="🎖️" 
          items={[
            { label: 'Index Number', val: data.index_number },
            { label: 'PDS Number', val: data.pds_number },
            { label: 'Pay Code', val: data.pay_code },
            { label: 'Basic Salary', val: data.basic },
            { label: 'Join Date', val: data.join_date },
            { label: 'Join Date (This School)', val: data.this_school_join_date },
            { label: '1st MPO Date', val: data['1st_mpo'] }
          ]}
        />

        <Section 
          title="Personal Details" 
          icon="👤" 
          items={[
            { label: 'Father\'s Name', val: data.father_name_en, bn: data.father_name_bn },
            { label: 'Mother\'s Name', val: data.mother_name_en, bn: data.mother_name_bn },
            { label: 'Date of Birth', val: data.date_of_birth_en, bn: data.date_of_birth_bn },
            { label: 'Mobile Number', val: data.mobile_number_en, bn: data.mobile_number_bn },
            { label: 'Email', val: data.teacher_email_id },
            { label: 'NID Number', val: data.nid_number_en, bn: data.nid_number_bn },
            { label: 'Birth Cert', val: data.birth_certificate_number },
            { label: 'Religion', val: data.religion_en, bn: data.religion_bn },
            { label: 'Gender', val: data.gender_en, bn: data.gender_bn }
          ]}
        />

        <Section 
          title="Address Info" 
          icon="🏠" 
          items={[
            { label: 'Village/Street', val: data.village_en, bn: data.village_bn },
            { label: 'Post Office', val: data.post_office_en, bn: data.post_office_bn },
            { label: 'Upazilla', val: data.upazilla_en, bn: data.upazilla_bn },
            { label: 'District', val: data.district_en, bn: data.district_bn },
            { label: 'Home District', val: data.home_district }
          ]}
        />

        <Section 
          title="Banking Details" 
          icon="🏦" 
          items={[
            { label: 'Primary Account', val: data.bank_account_number },
            { label: 'Secondary Account', val: data.bank_account_number2 }
          ]}
        />
        
        {/* NID Photo if available */}
        {data.nid_photo && (
          <div style={{ background: '#fff', borderRadius: 24, padding: '24px', border: `1px solid ${C.border}`, marginBottom: 20 }}>
             <h3 style={{ fontSize: 13, fontWeight: 900, color: C.primary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 15 }}>NID Photo</h3>
             <img 
               src={data.nid_photo} 
               alt="NID" 
               onClick={() => setShowPreview(data.nid_photo)}
               style={{ width: '100%', borderRadius: 12, cursor: 'pointer' }} 
             />
          </div>
        )}
      </main>

      {/* Image Preview Modal */}
      {showPreview && (
        <div 
          onClick={() => setShowPreview(null)}
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}
        >
          <img src={showPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 12, boxShadow: '0 0 50px rgba(0,0,0,0.5)' }} />
          <button style={{ position: 'absolute', top: 30, right: 30, border: 'none', background: '#fff', width: 40, height: 40, borderRadius: '50%', fontSize: 24, fontWeight: 900, cursor: 'pointer' }}>×</button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default MyInfo;
