export {}
// Converted from inline script in attendence.html

let teacherData: any = null;
let attendanceData: Record<string, string> = {};
let students: any[] = [];
let classStudents: any[] = [];

let columnVisibility = {
  studentId: false,
  class: false,
  section: false
};

async function waitForAuthSystem(): Promise<void> {
  while (!(window as any).authCheck || !(window as any).authCheck.checkAuth) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string): string {
  try {
    return new Date('1970-01-01T' + timeStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return timeStr;
  }
}

async function init(): Promise<void> {
  try {
    await waitForAuthSystem();
    teacherData = await (window as any).authCheck.checkAuth();
    console.log('Teacher data:', teacherData);

    if (!teacherData) {
      console.error('No teacher data received');
      return;
    }

    (document.getElementById('teacherEmail') as HTMLElement).textContent = teacherData.teacher_email || 'N/A';
    (document.getElementById('teacherClass') as HTMLElement).textContent = teacherData.access_class || 'N/A';
    (document.getElementById('teacherSection') as HTMLElement).textContent = teacherData.access_section || 'N/A';

    const today = (new Date().toISOString().split('T')[0]) || '';
    (document.getElementById('todayDate') as HTMLInputElement).value = today;
    const dateInput = document.getElementById('todayDate') as HTMLInputElement;
    dateInput.setAttribute('max', today);
    dateInput.addEventListener('change', function () { checkDateAndTimeRestriction(); });

    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view');
    if (view) switchTab(view);

    await loadTodayAttendance();
    await loadStudentsForDropdown();

    console.log('Initialization complete');
  } catch (error: any) {
    console.error('Error initializing:', error);
    showError('Error loading attendance system: ' + (error?.message || error));
  }
}

function switchTab(tabName: string) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.querySelector(`[data-tab="${tabName}"]`) as HTMLElement;
  if (activeTab) activeTab.classList.add('active');

  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const content = document.getElementById(tabName);
  if (content) content.classList.add('active');
}

async function loadStudentsForDropdown(): Promise<void> {
  try {
    if (!teacherData?.access_class || !teacherData?.access_section) {
      console.log('No class/section assigned, skipping dropdown load');
      return;
    }

    let allFetchedStudents: any[] = [];
    if (teacherData.allAssignments && teacherData.allAssignments.length > 0) {
      for (const assignment of teacherData.allAssignments) {
        const { data: studentData, error: studentError } = await (window as any).authCheck.supabase
          .from('student_database')
          .select('iid, active_roll, student_name_en, rfid_card_no, active_class, active_section')
          .eq('active_class', assignment.access_class)
          .eq('active_section', assignment.access_section)
          .order('active_roll', { ascending: true });

        if (studentError) throw studentError;
        if (studentData) allFetchedStudents = allFetchedStudents.concat(studentData);
      }
    } else {
      let accessClass = teacherData.access_class;
      let accessSection = teacherData.access_section;
      if (typeof accessClass === 'string' && accessClass.includes(',')) accessClass = accessClass.split(',').map((c: string) => c.trim()).filter(Boolean)[0];
      if (typeof accessSection === 'string' && accessSection.includes(',')) accessSection = accessSection.split(',').map((s: string) => s.trim()).filter(Boolean)[0];

      const { data: studentData, error: studentError } = await (window as any).authCheck.supabase
        .from('student_database')
        .select('iid, active_roll, student_name_en, rfid_card_no, active_class, active_section')
        .eq('active_class', accessClass)
        .eq('active_section', accessSection)
        .order('active_roll', { ascending: true });

      if (studentError) throw studentError;
      allFetchedStudents = studentData || [];
    }

    const uniqueStudents = allFetchedStudents.filter((student, index, self) => index === self.findIndex((s: any) => s.iid === student.iid));
    students = uniqueStudents;
  } catch (error) {
    console.error('Error loading students for dropdown:', error);
  }
}

async function loadTodayAttendance(): Promise<void> {
  const todayContent = document.getElementById('todayContent') as HTMLElement;
  const statsContainer = document.getElementById('statsContainer') as HTMLElement;

  if (!teacherData?.access_class || !teacherData?.access_section) {
    todayContent.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>No Class Assigned</h3>
        <p>Please login again</p>
      </div>
    `;
    return;
  }

  todayContent.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i><p>Loading students...</p></div>';
  if (statsContainer) statsContainer.style.display = 'none';

  try {
    const selectedDate = (document.getElementById('todayDate') as HTMLInputElement).value;

    let allFetchedStudents: any[] = [];
    if (teacherData.allAssignments && teacherData.allAssignments.length > 0) {
      for (const assignment of teacherData.allAssignments) {
        const { data: studentData, error: studentError } = await (window as any).authCheck.supabase
          .from('student_database')
          .select('*')
          .eq('active_class', assignment.access_class)
          .eq('active_section', assignment.access_section)
          .order('active_roll', { ascending: true });

        if (studentError) throw studentError;
        if (studentData) allFetchedStudents = allFetchedStudents.concat(studentData);
      }
    } else {
      let accessClass = teacherData.access_class;
      let accessSection = teacherData.access_section;
      if (typeof accessClass === 'string' && accessClass.includes(',')) accessClass = accessClass.split(',').map((c: string) => c.trim()).filter(Boolean)[0];
      if (typeof accessSection === 'string' && accessSection.includes(',')) accessSection = accessSection.split(',').map((s: string) => s.trim()).filter(Boolean)[0];

      const { data: studentData, error: studentError } = await (window as any).authCheck.supabase
        .from('student_database')
        .select('*')
        .eq('active_class', accessClass)
        .eq('active_section', accessSection)
        .order('active_roll', { ascending: true });

      if (studentError) throw studentError;
      allFetchedStudents = studentData || [];
    }

    const uniqueStudents = allFetchedStudents.filter((student, index, self) => index === self.findIndex((s: any) => s.iid === student.iid));
    students = uniqueStudents;

    const rfidCards = students.map(s => s.rfid_card_no).filter(Boolean);

    let rfidAttendance: Record<string, any> = {};
    if (rfidCards.length > 0) {
      const { data: rfidData, error: rfidError } = await (window as any).authCheck.supabase
        .from('attendence_entry')
        .select('*')
        .eq('attendence_date', selectedDate)
        .in('rfid_card_no', rfidCards)
        .order('attendence_time', { ascending: true });

      if (rfidError) console.error('Error fetching RFID attendance:', rfidError);

      if (rfidData && rfidData.length > 0) {
        rfidData.forEach((entry: any) => {
          const rfid = entry.rfid_card_no;
          const time = entry.attendence_time || '';
          if (!rfidAttendance[rfid]) {
            rfidAttendance[rfid] = { firstScan: time, lastScan: time, totalScans: 1 };
          } else {
            rfidAttendance[rfid].lastScan = time;
            rfidAttendance[rfid].totalScans++;
          }
        });
      }
    }

    attendanceData = {};
    students.forEach(student => {
      const rfid = student.rfid_card_no;
      if (rfid && rfidAttendance[rfid]) attendanceData[student.iid] = 'present';
      else attendanceData[student.iid] = 'absent';
    });

    renderStudentTable(students, selectedDate, rfidAttendance);
    updateStats();
    if (statsContainer) statsContainer.style.display = 'grid';
  } catch (error: any) {
    console.error('Error loading students:', error);
    (document.getElementById('todayContent') as HTMLElement).innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <h3>Error Loading Data</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

function renderStudentTable(studentData: any[], date: string, rfidAttendance: Record<string, any> = {}) {
  const todayContent = document.getElementById('todayContent') as HTMLElement;
  let tableHTML = `
    <div class="column-toggles-new">
      <label class="toggle-checkbox-new">
        <input type="checkbox" id="toggleIID" ${columnVisibility.studentId ? 'checked' : ''} onchange="toggleColumn('studentId')">
        <i class="fas fa-check-circle"></i>
        <span>Student ID</span>
      </label>
      <label class="toggle-checkbox-new">
        <input type="checkbox" id="toggleClass" ${columnVisibility.class ? 'checked' : ''} onchange="toggleColumn('class')">
        <i class="fas fa-check-circle"></i>
        <span>Class</span>
      </label>
      <label class="toggle-checkbox-new">
        <input type="checkbox" id="toggleSection" ${columnVisibility.section ? 'checked' : ''} onchange="toggleColumn('section')">
        <i class="fas fa-check-circle"></i>
        <span>Section</span>
      </label>
    </div>
    <div class="attendance-table-container">
      <table class="attendance-table">
        <thead>
          <tr>
            <th>
              <div class="th-double">
                <div>Roll</div>
                <div>Name</div>
              </div>
            </th>
            <th class="col-class" style="display: ${columnVisibility.class ? 'table-cell' : 'none'}">
              <div class="th-double">
                <div>Class</div>
                <div>Section</div>
              </div>
            </th>
            <th>
              <div class="th-double">
                <div>IN</div>
                <div>OUT</div>
              </div>
            </th>
            <th>
              <div class="th-double">
                <div>Present</div>
                <div>Absent</div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
  `;

  // Render rows
  studentData.forEach(student => {
    const status = attendanceData[student.iid] || 'absent';
    const studentName = student.student_name_en || 'N/A';
    const roll = student.active_roll || '-';
    const rfid = student.rfid_card_no;

    let inTime = '-';
    let lastScan = '-';
    if (rfid && rfidAttendance[rfid]) {
      inTime = formatTime(rfidAttendance[rfid].firstScan);
      lastScan = formatTime(rfidAttendance[rfid].lastScan);
      if (rfidAttendance[rfid].totalScans > 2) lastScan += ` (${rfidAttendance[rfid].totalScans} scans)`;
    }

    tableHTML += `
      <tr>
        <td>
          <div class="td-triple">
            <div class="td-top"><strong>${roll}</strong></div>
            <div class="td-middle">${studentName}</div>
            ${columnVisibility.studentId ? `<div class="td-bottom-iid">${student.iid}</div>` : ''}
          </div>
        </td>
        <td class="col-class" style="display: ${columnVisibility.class || columnVisibility.section ? 'table-cell' : 'none'}">
          <div class="td-double">
            ${columnVisibility.class ? `<div class="td-top">${student.active_class || '-'}</div>` : ''}
            ${columnVisibility.section ? `<div class="td-bottom">${student.active_section || '-'}</div>` : ''}
            ${!columnVisibility.class && columnVisibility.section ? `<div class="td-single">${student.active_section || '-'}</div>` : ''}
            ${columnVisibility.class && !columnVisibility.section ? `<div class="td-single">${student.active_class || '-'}</div>` : ''}
          </div>
        </td>
        <td>
          <div class="td-double">
            <div class="td-top">
              ${inTime !== '-' ? `<span class="time-badge in">${inTime}</span>` : '<span class="no-time">-</span>'}
            </div>
            <div class="td-bottom">
              ${lastScan !== '-' ? `<span class="time-badge out">${lastScan}</span>` : '<span class="no-time">-</span>'}
            </div>
          </div>
        </td>
        <td>
          <div class="td-double">
            <div class="td-top">
              <button class="attendance-btn-compact present ${status === 'present' ? 'active' : ''}" onclick="markAttendance(${student.iid}, 'present')">
                <i class="fas fa-check"></i> P
              </button>
            </div>
            <div class="td-bottom">
              <button class="attendance-btn-compact absent ${status === 'absent' ? 'active' : ''}" onclick="markAttendance(${student.iid}, 'absent')">
                <i class="fas fa-times"></i> A
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  });

  tableHTML += `
        </tbody>
      </table>
    </div>
    <button class="save-attendance-btn" onclick="saveAttendance()" id="saveAttendanceBtn">
      <i class="fas fa-save"></i> Save Attendance
    </button>
  `;

  todayContent.innerHTML = tableHTML;
  checkDateAndTimeRestriction();
}

async function toggleColumn(columnName: string) {
  columnVisibility[columnName as keyof typeof columnVisibility] = !columnVisibility[columnName as keyof typeof columnVisibility];
  const selectedDate = (document.getElementById('todayDate') as HTMLInputElement).value;
  const rfidCards = students.map(s => s.rfid_card_no).filter(Boolean);
  let rfidAttendance: Record<string, any> = {};
  if (rfidCards.length > 0) {
    const { data: rfidData } = await (window as any).authCheck.supabase
      .from('attendence_entry')
      .select('*')
      .eq('attendence_date', selectedDate)
      .in('rfid_card_no', rfidCards)
      .order('attendence_time', { ascending: true });

    if (rfidData) {
      rfidData.forEach((entry: any) => {
        const rfid = entry.rfid_card_no;
        const time = entry.attendence_time;
        if (!rfidAttendance[rfid]) {
          rfidAttendance[rfid] = { firstScan: time, lastScan: time, totalScans: 1 };
        } else {
          rfidAttendance[rfid].lastScan = time;
          rfidAttendance[rfid].totalScans++;
        }
      });
    }
  }

  renderStudentTable(students, selectedDate, rfidAttendance);
}

function updateStats() {
  const total = students.length;
  const present = Object.values(attendanceData).filter(s => s === 'present').length;
  const absent = total - present;

  (document.getElementById('totalStudents') as HTMLElement).textContent = String(total);
  (document.getElementById('presentCount') as HTMLElement).textContent = String(present);
  (document.getElementById('absentCount') as HTMLElement).textContent = String(absent);
}



    // Save Attendance
    async function saveAttendance() {
      const selectedDate = (document.getElementById('todayDate') as HTMLInputElement).value;
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentHour = now.getHours();

      if (selectedDate !== today) {
        showError('You can only mark attendance for today!');
        return;
      }

      if (currentHour < 7 || currentHour >= 16) {
        showError('Attendance entry is only allowed between 7:00 AM and 4:00 PM');
        return;
      }

      const presentStudentIds = Object.keys(attendanceData).filter(iid => attendanceData[iid] === 'present');
      if (presentStudentIds.length === 0) {
        showError('No students marked as present!');
        return;
      }

      if (!confirm(`Save attendance for ${presentStudentIds.length} present student(s)?`)) {
        return;
      }

      try {
        const saveBtn = document.getElementById('saveAttendanceBtn') as HTMLButtonElement;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        const currentTime = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka', hour12: false });

        const entriesToInsert: any[] = [];
        for (const studentId of presentStudentIds) {
          const student = students.find(s => s.iid == studentId);
          if (student && student.rfid_card_no) {
            entriesToInsert.push({ rfid_card_no: student.rfid_card_no, attendence_date: selectedDate, attendence_time: currentTime });
          }
        }

        if (entriesToInsert.length === 0) {
          showError('No RFID cards found for selected students!');
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Attendance';
          return;
        }

        const { data, error } = await (window as any).authCheck.supabase.from('attendence_entry').insert(entriesToInsert);
        if (error) throw error;

        showSuccess(`✅ Attendance saved successfully for ${entriesToInsert.length} student(s)!`);
        await loadTodayAttendance();

      } catch (error: any) {
        console.error('Error saving attendance:', error);
        showError('Failed to save attendance: ' + (error?.message || error));
        const saveBtn = document.getElementById('saveAttendanceBtn') as HTMLButtonElement;
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Attendance';
        }
      }
    }

    // Load Student History (by dropdown)
    async function loadStudentHistory() {
      const studentId = (document.getElementById('studentRollDropdown') as HTMLSelectElement).value.trim();
      const fromDate = (document.getElementById('fromDate') as HTMLInputElement).value;
      const toDate = (document.getElementById('toDate') as HTMLInputElement).value;
      const content = document.getElementById('studentHistoryContent') as HTMLElement;
      const infoCard = document.getElementById('studentInfoCard') as HTMLElement;

      if (!studentId) {
        showError('Please select a roll number from the dropdown');
        return;
      }

      content.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i><p>Loading history...</p></div>';
      infoCard.style.display = 'none';

      try {
        const { data: allStudents, error: fetchError } = await (window as any).authCheck.supabase
          .from('student_database')
          .select('rfid_card_no, student_name_en, student_name_bn, active_class, active_section, active_roll, iid')
          .filter('iid', 'eq', studentId);

        if (fetchError) throw fetchError;
        if (!allStudents || allStudents.length === 0) throw new Error('Student not found with ID: ' + studentId);

        const studentData = allStudents[0];
        infoCard.style.display = 'block';
        (document.getElementById('studentName') as HTMLElement).textContent = studentData.student_name_en || 'N/A';
        (document.getElementById('studentClass') as HTMLElement).textContent = studentData.active_class || 'N/A';
        (document.getElementById('studentSection') as HTMLElement).textContent = studentData.active_section || 'N/A';
        (document.getElementById('studentRoll') as HTMLElement).textContent = studentData.active_roll || 'N/A';

        // Query attendence entries for this student
        let query = (window as any).authCheck.supabase.from('attendence_entry').select('*').eq('rfid_card_no', studentData.rfid_card_no).order('attendence_date', { ascending: false });
        if (fromDate) query = query.gte('attendence_date', fromDate);
        if (toDate) query = query.lte('attendence_date', toDate);

        const { data: rfidData, error: rfidError } = await query;
        if (rfidError) throw rfidError;

        if (!rfidData || rfidData.length === 0) {
          content.innerHTML = `
            <div class="empty-state">
              <i class="fas fa-clipboard-list"></i>
              <h3>No Records Found</h3>
              <p>No RFID attendance records for this student in the selected date range</p>
            </div>
          `;
          return;
        }

        let tableHTML = `
          <div class="attendance-table-container">
            <table class="attendance-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
        `;

        rfidData.forEach((row: any, idx: number) => {
          tableHTML += `
            <tr>
              <td><strong>${idx + 1}</strong></td>
              <td>${formatDate(row.attendence_date)}</td>
              <td><strong>${formatTime(row.attendence_time)}</strong></td>
            </tr>
          `;
        });

        tableHTML += `
              </tbody>
            </table>
          </div>
        `;

        content.innerHTML = tableHTML;

      } catch (error: any) {
        console.error('Error loading student history:', error);
        content.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-exclamation-circle"></i>
            <h3>Error Loading Data</h3>
            <p>${error.message}</p>
          </div>
        `;
      }
    }

    function showSuccess(message: string) {
      const successMsg = document.getElementById('successMessage') as HTMLElement;
      (document.getElementById('successText') as HTMLElement).textContent = message;
      successMsg.classList.add('show');
      setTimeout(() => successMsg.classList.remove('show'), 5000);
    }

    function showError(message: string) {
      const errorMsg = document.getElementById('errorMessage') as HTMLElement;
      (document.getElementById('errorText') as HTMLElement).textContent = message;
      errorMsg.classList.add('show');
      setTimeout(() => errorMsg.classList.remove('show'), 5000);
    }

    function checkDateAndTimeRestriction() {
      const selectedDate = (document.getElementById('todayDate') as HTMLInputElement).value;
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentHour = now.getHours();

      const saveBtn = document.getElementById('saveAttendanceBtn') as HTMLButtonElement;

      if (selectedDate !== today || currentHour < 7 || currentHour >= 16) {
        if (saveBtn) saveBtn.style.display = 'none';
      } else {
        if (saveBtn) saveBtn.style.display = 'inline-block';
      }
    }

    // Expose functions used by inline HTML handlers
    (window as any).loadTodayAttendance = loadTodayAttendance;
    (window as any).loadStudentHistory = loadStudentHistory;
    (window as any).markAttendance = (studentId: any, status: string) => {
      attendanceData[studentId] = status;
      updateStats();
      // re-render for visual state
      const selectedDate = (document.getElementById('todayDate') as HTMLInputElement).value;
      renderStudentTable(students, selectedDate);
    };
    (window as any).saveAttendance = saveAttendance;
    (window as any).toggleColumn = (col: string) => { toggleColumn(col); };
    (window as any).showError = showError;
    (window as any).showSuccess = showSuccess;

    window.addEventListener('DOMContentLoaded', () => {
      init().catch(console.error);
    });
