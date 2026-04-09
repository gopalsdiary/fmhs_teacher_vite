export {}
// Converted from inline script in class_photo.html

let teacherData_cp: any = null;
let allStudents_cp: any[] = [];
let currentPage_cp = 1;
const studentsPerPage_cp = 50;

async function waitForAuthSystem(): Promise<void> {
  while (!(window as any).authCheck || !(window as any).authCheck.checkAuth) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function initPage(): Promise<void> {
  try {
    await waitForAuthSystem();
    teacherData_cp = await (window as any).authCheck.checkAuth();
    if (!teacherData_cp) return;

    (document.getElementById('displayTeacher') as HTMLElement).textContent = teacherData_cp.teacher_email;
    (document.getElementById('displayClass') as HTMLElement).textContent = teacherData_cp.access_class || 'N/A';
    (document.getElementById('displaySection') as HTMLElement).textContent = teacherData_cp.access_section || 'N/A';

    if (!teacherData_cp.access_class || !teacherData_cp.access_section) {
      alert('Class and section not assigned. Please contact admin.');
      window.location.href = 'teacher_dashboard.html';
      return;
    }

    await fetchStudents();

    (document.getElementById('loading') as HTMLElement).style.display = 'none';
    (document.getElementById('mainContent') as HTMLElement).style.display = 'block';
  } catch (error) {
    console.error('Error initializing page:', error);
    alert('Error loading page. Please try again.');
    window.location.href = 'teacher_dashboard.html';
  }
}

async function fetchStudents(): Promise<void> {
  try {
    const supabase = (window as any).authCheck.getSupabaseClient();
    let allFetchedStudents: any[] = [];

    if (teacherData_cp.allAssignments && teacherData_cp.allAssignments.length > 0) {
      for (const assignment of teacherData_cp.allAssignments) {
        const { data: students, error } = await supabase
          .from('student_database')
          .select('iid, student_name_en, active_roll, student_photo_url, active_class, active_section')
          .eq('active_class', assignment.access_class)
          .eq('active_section', assignment.access_section)
          .order('active_roll', { ascending: true });

        if (error) throw error;
        if (students) allFetchedStudents = allFetchedStudents.concat(students);
      }
    } else {
      let accessClass = teacherData_cp.access_class;
      let accessSection = teacherData_cp.access_section;
      if (typeof accessClass === 'string' && accessClass.includes(',')) accessClass = accessClass.split(',').map((c: string) => c.trim()).filter(Boolean)[0];
      if (typeof accessSection === 'string' && accessSection.includes(',')) accessSection = accessSection.split(',').map((s: string) => s.trim()).filter(Boolean)[0];

      const { data: students, error } = await supabase
        .from('student_database')
        .select('iid, student_name_en, active_roll, student_photo_url, active_class, active_section')
        .eq('active_class', accessClass)
        .eq('active_section', accessSection)
        .order('active_roll', { ascending: true });

      if (error) throw error;
      allFetchedStudents = students || [];
    }

    const uniqueStudents = allFetchedStudents.filter((student, index, self) => index === self.findIndex((s: any) => s.iid === student.iid));
    allStudents_cp = uniqueStudents;
    (document.getElementById('totalStudents') as HTMLElement).textContent = String(allStudents_cp.length);

    if (allStudents_cp.length === 0) {
      (document.getElementById('emptyState') as HTMLElement).style.display = 'block';
      (document.getElementById('pagination') as HTMLElement).style.display = 'none';
    } else {
      displayStudents();
      setupPagination();
    }
  } catch (error) {
    console.error('Error fetching students:', error);
    alert('Error loading students. Please try again.');
  }
}

function displayStudents() {
  const startIndex = (currentPage_cp - 1) * studentsPerPage_cp;
  const endIndex = startIndex + studentsPerPage_cp;
  const studentsToDisplay = allStudents_cp.slice(startIndex, endIndex);

  const photoGrid = document.getElementById('photoGrid') as HTMLElement;
  photoGrid.innerHTML = '';

  studentsToDisplay.forEach(student => {
    const photoCard = document.createElement('div');
    photoCard.className = 'photo-card';
    const photoWrapper = document.createElement('div');
    photoWrapper.className = 'photo-wrapper';

    if (student.student_photo_url) {
      const img = document.createElement('img');
      img.src = student.student_photo_url;
      img.alt = student.student_name_en || 'Student Photo';
      img.onerror = function(this: HTMLImageElement) {
        (this.parentElement as HTMLElement).innerHTML = '<div class="photo-placeholder"><i class="fas fa-user"></i></div>';
      };
      photoWrapper.appendChild(img);
    } else {
      photoWrapper.innerHTML = '<div class="photo-placeholder"><i class="fas fa-user"></i></div>';
    }

    const studentInfo = document.createElement('div');
    studentInfo.className = 'student-info';
    studentInfo.innerHTML = `
      <div class="student-iid">${student.iid || 'N/A'}</div>
      <div class="student-name">${student.student_name_en || 'N/A'}</div>
      <div class="student-roll">Roll: ${student.active_roll || 'N/A'}</div>
    `;

    photoCard.appendChild(photoWrapper);
    photoCard.appendChild(studentInfo);
    photoGrid.appendChild(photoCard);
  });
}

function setupPagination() {
  const totalPages = Math.ceil(allStudents_cp.length / studentsPerPage_cp);
  const pagination = document.getElementById('pagination') as HTMLElement;
  pagination.innerHTML = '';

  if (totalPages <= 1) { pagination.style.display = 'none'; return; }
  pagination.style.display = 'flex';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'page-btn';
  prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
  prevBtn.disabled = currentPage_cp === 1;
  prevBtn.onclick = () => { if (currentPage_cp > 1) { currentPage_cp--; displayStudents(); setupPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  pagination.appendChild(prevBtn);

  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage_cp - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  if (endPage - startPage < maxVisiblePages - 1) startPage = Math.max(1, endPage - maxVisiblePages + 1);

  if (startPage > 1) {
    const firstBtn = document.createElement('button');
    firstBtn.className = 'page-btn';
    firstBtn.textContent = '1';
    firstBtn.onclick = () => { currentPage_cp = 1; displayStudents(); setupPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
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
    pageBtn.className = 'page-btn' + (i === currentPage_cp ? ' active' : '');
    pageBtn.textContent = String(i);
    pageBtn.onclick = () => { currentPage_cp = i; displayStudents(); setupPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
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
    lastBtn.onclick = () => { currentPage_cp = totalPages; displayStudents(); setupPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    pagination.appendChild(lastBtn);
  }

  const nextBtn = document.createElement('button');
  nextBtn.className = 'page-btn';
  nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
  nextBtn.disabled = currentPage_cp === totalPages;
  nextBtn.onclick = () => { if (currentPage_cp < totalPages) { currentPage_cp++; displayStudents(); setupPagination(); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
  pagination.appendChild(nextBtn);

  const pageInfo = document.createElement('div');
  pageInfo.className = 'page-info';
  pageInfo.textContent = `Page ${currentPage_cp} of ${totalPages}`;
  pagination.appendChild(pageInfo);
}

window.addEventListener('DOMContentLoaded', initPage);
