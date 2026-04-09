export {}
// src/detailsinfo.ts - Converted from inline script in detailsinfo.html

// Prefers auth-check supplied client, otherwise try window.supabase or create a client
const supabaseUrl = 'https://rtfefxghfbtirfnlbucb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ0ZmVmeGdoZmJ0aXJmbmxidWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA1MDg3OTcsImV4cCI6MjA1NjA4NDc5N30.fb7_myCmFzbV7WPNjFN_NEl4z0sOmRCefnkQbk6c10w';

function getSupabaseClient() {
  if ((window as any).authCheck?.getSupabaseClient) return (window as any).authCheck.getSupabaseClient();
  if ((window as any).supabase && typeof (window as any).supabase.createClient === 'function') return (window as any).supabase.createClient(supabaseUrl, supabaseKey);
  return (window as any).supabase;
}

function byParam(name: string) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function esc(s: any) { return String(s ?? ''); }

async function loadColumnOrder() {
  try {
    const res = await fetch('dataorder.csv', { redirect: 'follow' });
    const txt = await res.text();
    const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const spec: { field: string | null; label: string }[] = [];
    for (const line of lines) {
      if (line.toLowerCase().includes('colm name')) continue;
      const parts = line.split(' > ');
      if (parts.length >= 2) {
        const field = (parts[0] || '').trim();
        const label = (parts[1] || '').trim();
        if (field) spec.push({ field, label });
      } else if (line.startsWith('*')) {
        spec.push({ field: null, label: line });
      }
    }
    return spec;
  } catch (e: any) {
    console.error('Error loading column order:', e);
    return [];
  }
}

async function loadAndDisplayImage(iid: any){
  try{
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('student_database').select('student_photo_url').eq('iid', Number(iid)).single();
    if(error){ console.error('Error fetching photo URL:', error); return; }
    const photoUrl = data?.student_photo_url;
    if(!photoUrl){ console.log('No photo URL found for this student'); return; }
    const imgContainer = document.getElementById('image-container') as HTMLElement;
    const img = document.createElement('img');
    img.src = photoUrl;
    img.alt = 'Student Photo';
    img.className = 'student-image';
    img.onerror = function(){ imgContainer.innerHTML = '<div style="color:#64748b;font-size:0.85rem;">Photo not available</div>'; };
    imgContainer.innerHTML = '';
    imgContainer.appendChild(img);
  }catch(e){ console.error('Error loading image:', e); }
}

async function init(){
  const iidParam = byParam('iid');
  const head = document.getElementById('head') as HTMLElement;
  const status = document.getElementById('status') as HTMLElement;
  const meta = document.getElementById('meta') as HTMLElement;
  head.textContent = 'বিস্তারিত তথ্য';
  if(!iidParam){ status.textContent='No IID provided'; return; }
  status.textContent='Loading…';
  try{
    const columnSpec = await loadColumnOrder();
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('student_database').select('*').eq('iid', Number(iidParam)).single();
    if(error) throw error;
    if(!data){ status.textContent='Record not found'; return; }
    meta.textContent = `IID: ${iidParam}`;
    loadAndDisplayImage(iidParam);
    const dl = document.getElementById('dl') as HTMLElement;
    let shown = 0;
    const fieldsToShow = columnSpec.length > 0 ? columnSpec : Object.keys(data).map((f:any) => ({ field: f, label: f }));
    fieldsToShow.forEach((spec:any) => {
      const field = (spec.field || '').trim();
      const label = (spec.label || field || '').trim();
      
      // Skip student_photo_url field/label from the list
      if (field === 'student_photo_url' || label === 'Student Photo URL') return;

      if(label.startsWith('*')){
        const h = document.createElement('div');
        h.className = 'group-header';
        h.textContent = label.replace(/^\*+/, '').trim();
        dl.appendChild(h);
        return;
      }
      const valRaw = data[spec.field];
      const val = esc(valRaw);
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = val || '';
      dl.appendChild(dt); dl.appendChild(dd);
      shown++;
    });
    status.textContent = 'Ready';
  }catch(e:any){ console.error(e); status.textContent = 'Failed to load'; }
}

window.addEventListener('DOMContentLoaded', init);
