// src/class_data.ts - Converted from inline script in class_data.html

async function waitForSupabase(): Promise<void> {
  while (!(window as any).supabase && !(window as any).authCheck?.getSupabaseClient) {
    await new Promise(r => setTimeout(r, 50));
  }
}

function q(name: string) { const u = new URLSearchParams(location.search); return u.get(name); }

async function ensureDatalistRows() {
  const statusEl = document.getElementById('status') as HTMLElement;
  statusEl.textContent = 'Loading students from database...';

  try {
    const supabase = (window as any).supabase || (window as any).authCheck?.getSupabaseClient();
    const { data, error } = await supabase.from('student_database').select('iid, student_name_en, student_name_bn, student_photo_url, active_class, active_section, active_roll, session');

    if (error) {
      console.error('Supabase error:', error);
      throw new Error('Database error: ' + error.message);
    }

    if (!data || data.length === 0) {
      statusEl.textContent = 'No students found in database';
      return [];
    }

    console.log('Fetched students:', data.length);
    return data;

  } catch (e: any) {
    console.error('Fetch error:', e);
    statusEl.textContent = 'Error: ' + (e.message || e);
    throw e;
  }
}

function classToWord(v: any){
  const m: Record<string,string> = { '6':'SIX','7':'SEVEN','8':'EIGHT','9':'NINE','10':'TEN','xi':'ELEVEN','xii':'TWELVE' };
  const key = String(v).trim().toLowerCase();
  return (m[key]||String(v)).toString().toUpperCase();
}

(async function(){
  await waitForSupabase();

  let cls = q('active_class') || q('class') || q('cls') || '';
  let sec = q('active_section') || q('section') || '';
  if (cls && cls.includes('-') && !sec) {
    const parts = cls.split('-'); cls = (parts[0]||'').trim(); sec = (parts.slice(1).join('-')||'').trim();
  }
  let roll = q('active_roll') || q('roll') || '';

  const activeValuesEl = document.getElementById('active-values');
  if (activeValuesEl) activeValuesEl.textContent = `class=${cls || '—'}, section=${sec || '—'}, roll=${roll || '—'}`;

  try {
    const rows = await ensureDatalistRows();

    function normClassToken(v: any){
      const s = String(v||'').trim().toLowerCase();
      const map: Record<string,number> = { six:6, seven:7, eight:8, nine:9, ten:10, xi:11, eleven:11, xii:12, twelve:12 };
      if (s in map) return String(map[s]);
      const n = parseInt(s); return isNaN(n) ? s : String(n);
    }

    const clsNorm = normClassToken(cls);
    const secNorm = String(sec||'').trim().toLowerCase();

    const filtered = rows.filter((r: any) => {
      const aClass = normClassToken(r.active_class || '');
      const aSection = String(r.active_section||'').trim().toLowerCase();
      const aRoll = String(r.active_roll||'').trim().toLowerCase();

      const clsNum = parseInt(clsNorm);
      const aClassNum = parseInt(aClass);
      const classMatch = cls ? ((!isNaN(clsNum) && !isNaN(aClassNum)) ? (clsNum===aClassNum) : (aClass===clsNorm)) : true;
      const sectionMatch = sec ? aSection.includes(secNorm) || secNorm.includes(aSection) : true;
      const rollMatch = roll ? aRoll === String(roll).trim().toLowerCase() : true;

      return classMatch && sectionMatch && rollMatch;
    });

    console.log('Query params:', { cls, sec, roll });
    console.log('Total rows from DB:', rows.length);
    console.log('Filtered rows:', filtered.length);

    // If roll not provided but only one record matches, use that roll as active_roll
    if(!roll && filtered.length===1){ 
      roll = filtered[0].active_roll || ''; 
      if (activeValuesEl) activeValuesEl.textContent = `class=${cls || '—'}, section=${sec || '—'}, roll=${roll || '—'}`; 
    }

    function renderCards(rows: any[], showName: boolean){
      const list = rows.slice().sort((a,b)=> {
        const sa = parseInt(a.session || '0');
        const sb = parseInt(b.session || '0');
        if (sb !== sa) return sb - sa; // Session Descending (Newer first)
        return (parseInt(a.active_roll)||0) - (parseInt(b.active_roll)||0); // Roll Ascending
      });
      const tableWrap = document.getElementById('table-wrap') as HTMLElement;
      const statusEl = document.getElementById('status') as HTMLElement;

      if(list.length===0){ 
        statusEl.textContent = 'No records found'; 
        tableWrap.innerHTML = '<div class="no-results">No students found for the selected class/section.</div>'; 
        return; 
      }

      statusEl.textContent = `${list.length} students found — class: ${cls || '—'}, section: ${sec || '—'}`;
      let html = '';
      list.forEach(f=> {
        const leftLabel = classToWord(f.active_class||'');
        const name = (f.student_name_en||'').trim() || (f.student_name_bn||'');
        const sectionStr = (f.active_section||'').toString().toUpperCase();
        const initials = (name ? name.split(/\s+/).map((s:string)=>s[0]||'').slice(0,2).join('') : String(f.active_roll||'')).toUpperCase();
        
        html += `<div class="card" onclick="window.location.href='detailsinfo.html?iid=${f.iid||''}'">`;
        html += `<div class="left"><div class="avatar-initials" title="${name}">${initials}</div><div class="class-label">Class ${leftLabel}</div></div>`;
        html += `<div class="center"><div class="title">${name || '—'}</div><div class="sub">Section: ${sectionStr}</div>`;
        
        const sess = String(f.session || '').trim();
        const sessClass = (sess === '2025') ? 'session yr-2025' : 'session';
        html += `<div class="meta">IID: ${f.iid || '—'} <span class="${sessClass}">${sess || ''}</span></div>`;
        html += `</div>`;
        html += `<div class="right"><span class="roll-label">ROLL</span><span class="roll-value">${f.active_roll||'—'}</span></div>`;
        html += `</div>`;
      });
      tableWrap.innerHTML = html;
    }

    // Wiring search
    const showNameCheckbox = document.getElementById('show-name') as HTMLInputElement | null;
    const searchInput = document.getElementById('search') as HTMLInputElement | null;

    function doRender(){
      const qv = (searchInput?.value||'').trim().toLowerCase();
      const rowsNow = !qv ? filtered : filtered.filter((f:any)=>
        String(f.iid||'').toLowerCase().includes(qv) ||
        String(f.active_roll||'').toLowerCase().includes(qv) ||
        String(f.student_name_en||'').toLowerCase().includes(qv) ||
        String(f.active_section||'').toLowerCase().includes(qv) ||
        String(f.active_class||'').toLowerCase().includes(qv) ||
        String(f.session||'').toLowerCase().includes(qv)
      );
      renderCards(rowsNow, !!showNameCheckbox?.checked);
    }

    if(showNameCheckbox) showNameCheckbox.addEventListener('change', doRender);
    if(searchInput) searchInput.addEventListener('input', doRender);
    
    doRender();

  } catch (e: any) {
    console.error('Error in class_data script:', e);
    const statusEl = document.getElementById('status');
    if (statusEl) statusEl.textContent = 'Load error: '+e.message;
  }
})();
