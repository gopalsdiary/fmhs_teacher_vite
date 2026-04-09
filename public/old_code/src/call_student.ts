export {}
// src/call_student.ts - Converted from inline script in call_student.html

let teacherData: any = null;
let allStudents: any[] = [];
let filteredStudents: any[] = [];
let currentPage = 1;
const studentsPerPage = 20;

/**
 * Formats Bangladeshi mobile numbers into international format (+880...)
 */
function formatMobileNumber(num: any): string {
  if (!num) return '';
  let clean = String(num).replace(/[^0-9]/g, '');
  
  // Logic for Bangladeshi numbers
  if (clean.length === 10) {
    // e.g. 1712345678 -> 8801712345678
    clean = '880' + clean;
  } else if (clean.length === 11 && clean.startsWith('0')) {
    // e.g. 01712345678 -> 8801712345678
    clean = '880' + clean.substring(1);
  } else if (clean.length === 13 && clean.startsWith('880')) {
    // e.g. 8801712345678 -> 8801712345678
  }
  
  // Return with + prefix
  return '+' + clean;
}

async function waitForAuthSystem(): Promise<void> {
  while (!(window as any).authCheck || !(window as any).authCheck.checkAuth) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function initPage(): Promise<void> {
  try {
    await waitForAuthSystem();
    teacherData = await (window as any).authCheck.checkAuth();

    if (!teacherData) {
      return;
    }

    (document.getElementById('displayTeacher') as HTMLElement).textContent = teacherData.teacher_email;
    (document.getElementById('displayClass') as HTMLElement).textContent = teacherData.access_class || 'N/A';
    (document.getElementById('displaySection') as HTMLElement).textContent = teacherData.access_section || 'N/A';

    if (!teacherData.access_class || !teacherData.access_section) {
      alert('শ্রেণি ও শাখা নির্ধারিত নেই। অনুগ্রহ করে প্রশাসকের সাথে যোগাযোগ করুন।');
      window.location.href = 'teacher_dashboard.html';
      return;
    }

    await fetchStudents();

    (document.getElementById('loading') as HTMLElement).style.display = 'none';
    (document.getElementById('mainContent') as HTMLElement).style.display = 'block';

    document.getElementById('searchInput')?.addEventListener('input', handleSearch as EventListener);

  } catch (error) {
    console.error('Error initializing page:', error);
    alert('পেজ লোড করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।');
    window.location.href = 'teacher_dashboard.html';
  }
}

async function fetchStudents(): Promise<void> {
  try {
    const supabase = (window as any).authCheck.getSupabaseClient();

    let allFetchedStudents: any[] = [];
    if (teacherData.allAssignments && teacherData.allAssignments.length > 0) {
      for (const assignment of teacherData.allAssignments) {
        const { data: students, error } = await supabase
          .from('student_database')
          .select('iid, active_roll, student_name_en, father_name_en, father_mobile, active_class, active_section')
          .eq('active_class', assignment.access_class)
          .eq('active_section', assignment.access_section)
          .order('active_roll', { ascending: true });

        if (error) throw error;
        if (students) allFetchedStudents = allFetchedStudents.concat(students);
      }
    } else {
      let accessClass = teacherData.access_class;
      let accessSection = teacherData.access_section;
      if (typeof accessClass === 'string' && accessClass.includes(',')) accessClass = accessClass.split(',').map((c: string) => c.trim()).filter(Boolean)[0];
      if (typeof accessSection === 'string' && accessSection.includes(',')) accessSection = accessSection.split(',').map((s: string) => s.trim()).filter(Boolean)[0];

      const { data: students, error } = await supabase
        .from('student_database')
        .select('iid, active_roll, student_name_en, father_name_en, father_mobile, active_class, active_section')
        .eq('active_class', accessClass)
        .eq('active_section', accessSection)
        .order('active_roll', { ascending: true });

      if (error) throw error;
      allFetchedStudents = students || [];
    }

    const uniqueStudents = allFetchedStudents.filter((student, index, self) => index === self.findIndex((s: any) => s.iid === student.iid));

    allStudents = uniqueStudents;
    filteredStudents = [...allStudents];
    (document.getElementById('totalStudents') as HTMLElement).textContent = String(allStudents.length);

    if (allStudents.length === 0) {
      (document.getElementById('emptyState') as HTMLElement).style.display = 'block';
      (document.querySelector('.student-table-wrapper') as HTMLElement).style.display = 'none';
      (document.getElementById('studentCards') as HTMLElement).style.display = 'none';
    } else {
      displayStudents();
      setupPagination();
    }

  } catch (error) {
    console.error('Error fetching students:', error);
    alert('ছাত্র-ছাত্রীদের তথ্য লোড করতে সমস্যা হয়েছে।');
  }
}

function displayStudents() {
  const startIndex = (currentPage - 1) * studentsPerPage;
  const endIndex = startIndex + studentsPerPage;
  const studentsToDisplay = filteredStudents.slice(startIndex, endIndex);

  const tbody = document.getElementById('studentTableBody') as HTMLElement;
  tbody.innerHTML = '';

  if (studentsToDisplay.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 40px; color: #718096;">
          <i class="fas fa-search" style="font-size: 40px; margin-bottom: 10px; display: block;"></i>
          কোন ছাত্র-ছাত্রী পাওয়া যায়নি
        </td>
      </tr>
    `;
    displayMobileCards([]);
    return;
  }

  studentsToDisplay.forEach(student => {
    const row = document.createElement('tr');
    const rollCell = document.createElement('td');
    rollCell.innerHTML = `<span class="roll-badge">${student.active_roll || 'N/A'}</span>`;
    row.appendChild(rollCell);

    const nameCell = document.createElement('td');
    nameCell.innerHTML = `<div class="student-name">${student.student_name_en || 'N/A'}</div>`;
    row.appendChild(nameCell);

    const fatherCell = document.createElement('td');
    fatherCell.innerHTML = `<div class="father-name">${student.father_name_en || 'N/A'}</div>`;
    row.appendChild(fatherCell);

    const formattedMobile = formatMobileNumber(student.father_mobile);
    const mobileCell = document.createElement('td');
    if (formattedMobile && formattedMobile.length > 5) {
      mobileCell.innerHTML = `
        <div class="mobile-number">
          <i class="fas fa-mobile-alt"></i>
          ${formattedMobile}
        </div>
      `;
    } else {
      mobileCell.innerHTML = `<div class="no-mobile">নম্বর নেই</div>`;
    }
    row.appendChild(mobileCell);

    const actionCell = document.createElement('td');
    if (formattedMobile && formattedMobile.length > 5) {
      // For WhatsApp link, digits only is usually safer/standard, 
      // but some users prefer seeing the link with + in display elements.
      // Strictly for URL, we'll keep digits only as per WhatsApp documentation.
      const whatsappDigits = formattedMobile.replace(/[^0-9]/g, '');
      actionCell.innerHTML = `
        <div class="action-buttons">
          <a href="tel:${formattedMobile}" class="call-btn">
            <i class="fas fa-phone"></i>
            কল করুন
          </a>
          <a href="https://wa.me/${whatsappDigits}" target="_blank" class="whatsapp-btn">
            <i class="fab fa-whatsapp"></i>
            WhatsApp
          </a>
        </div>
      `;
    } else {
      actionCell.innerHTML = `<div class="no-mobile">উপলব্ধ নয়</div>`;
    }
    row.appendChild(actionCell);

    tbody.appendChild(row);
  });

  displayMobileCards(studentsToDisplay);
}

function displayMobileCards(studentsArr: any[]) {
  const cardsContainer = document.getElementById('studentCards') as HTMLElement;
  cardsContainer.innerHTML = '';

  if (studentsArr.length === 0) {
    cardsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #718096;">
        <i class="fas fa-search" style="font-size: 50px; margin-bottom: 10px; display: block; color: #ffa366;"></i>
        <h3 style="font-size: 18px; margin-bottom: 5px;">কোন ছাত্র-ছাত্রী পাওয়া যায়নি</h3>
      </div>
    `;
    return;
  }

  studentsArr.forEach(student => {
    const card = document.createElement('div');
    card.className = 'student-card';

    const formattedMobile = formatMobileNumber(student.father_mobile);
    const whatsappDigits = formattedMobile.replace(/[^0-9]/g, '');

    card.innerHTML = `
      <div class="card-header">
        <div class="card-roll">রোল: ${student.active_roll || 'N/A'}</div>
      </div>
      <div class="card-body">
        <div class="card-row">
          <div class="card-label">
            <i class="fas fa-user-graduate"></i>
            নাম:
          </div>
          <div class="card-value">${student.student_name_en || 'N/A'}</div>
        </div>
        <div class="card-row">
          <div class="card-label">
            <i class="fas fa-user"></i>
            পিতার নাম:
          </div>
          <div class="card-value">${student.father_name_en || 'N/A'}</div>
        </div>
        <div class="card-row">
          <div class="card-label">
            <i class="fas fa-mobile-alt"></i>
            মোবাইল:
          </div>
          <div class="card-value">${formattedMobile && formattedMobile.length > 5 ? formattedMobile : 'নম্বর নেই'}</div>
        </div>
      </div>
      ${formattedMobile && formattedMobile.length > 5 ? `
        <div class="card-actions">
          <a href="tel:${formattedMobile}" class="call-btn">
            <i class="fas fa-phone"></i>
            কল করুন
          </a>
          <a href="https://wa.me/${whatsappDigits}" target="_blank" class="whatsapp-btn">
            <i class="fab fa-whatsapp"></i>
            WhatsApp
          </a>
        </div>
      ` : `
        <div class="card-no-mobile">
          মোবাইল নম্বর উপলব্ধ নয়
        </div>
      `}
    `;

    cardsContainer.appendChild(card);
  });
}

function handleSearch(e: Event) {
  const target = e.target as HTMLInputElement;
  const searchTerm = (target?.value || '').toLowerCase().trim();

  if (searchTerm === '') filteredStudents = [...allStudents];
  else {
    filteredStudents = allStudents.filter(student => {
      const roll = (student.active_roll || '').toString().toLowerCase();
      const name = (student.student_name_en || '').toLowerCase();
      const fatherName = (student.father_name_en || '').toLowerCase();
      const mobile = (student.father_mobile || '')?.toString().toLowerCase();
      return roll.includes(searchTerm) || name.includes(searchTerm) || fatherName.includes(searchTerm) || mobile.includes(searchTerm);
    });
  }

  currentPage = 1;
  displayStudents();
  setupPagination();
}

function setupPagination() {
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
  const pagination = document.getElementById('pagination') as HTMLElement;
  pagination.innerHTML = '';

  if (totalPages <= 1) { pagination.style.display = 'none'; return; }
  pagination.style.display = 'flex';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; displayStudents(); setupPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  pagination.appendChild(prevBtn);

  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  if (endPage - startPage < maxVisiblePages - 1) startPage = Math.max(1, endPage - maxVisiblePages + 1);

  if (startPage > 1) {
    const firstBtn = document.createElement('button');
    firstBtn.className = 'page-btn';
    firstBtn.textContent = '1';
    firstBtn.onclick = () => { currentPage = 1; displayStudents(); setupPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    pagination.appendChild(firstBtn);

    if (startPage > 2) {
      const dots = document.createElement('span');
      dots.className = 'page-info';
      dots.textContent = '...';
      pagination.appendChild(dots);
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.className = 'page-btn' + (i === currentPage ? ' active' : '');
    pageBtn.textContent = String(i);
    pageBtn.onclick = () => { currentPage = i; displayStudents(); setupPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    pagination.appendChild(pageBtn);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      const dots = document.createElement('span');
      dots.className = 'page-info';
      dots.textContent = '...';
      pagination.appendChild(dots);
    }

    const lastBtn = document.createElement('button');
    lastBtn.className = 'page-btn';
    lastBtn.textContent = String(totalPages);
    lastBtn.onclick = () => { currentPage = totalPages; displayStudents(); setupPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    pagination.appendChild(lastBtn);
  }

  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; displayStudents(); setupPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  pagination.appendChild(nextBtn);

  const pageInfo = document.createElement('div');
  pageInfo.className = 'page-info';
  pageInfo.textContent = `পৃষ্ঠা ${currentPage} / ${totalPages}`;
  pagination.appendChild(pageInfo);
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', initPage);
