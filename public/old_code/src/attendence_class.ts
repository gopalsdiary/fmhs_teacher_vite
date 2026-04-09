export {}
// Moved from inline script in attendence_class.html

type Student = {
  rfid_card_no?: string;
  iid?: string;
  student_name_en?: string;
};

let teacherData: any = null;

async function waitForAuthSystem(): Promise<void> {
  while (!(window as any).authCheck || !(window as any).authCheck.checkAuth) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

async function loadTeacherHistory(): Promise<void> {
  const fromDate = (document.getElementById('teacherFromDate') as HTMLInputElement).value;
  const toDate = (document.getElementById('teacherToDate') as HTMLInputElement).value;
  const content = document.getElementById('teacherHistoryContent') as HTMLElement;
  const summarySection = document.getElementById('summarySection') as HTMLElement;

  content.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i><p>Loading history...</p></div>';
  if (summarySection) summarySection.style.display = 'none';

  try {
    if (!teacherData?.access_class || !teacherData?.access_section) {
      content.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>No Class Assigned</h3>
          <p>Please contact admin to assign a class and section to your account</p>
        </div>
      `;
      return;
    }

    let allFetchedStudents: Student[] = [];

    if (teacherData.allAssignments && teacherData.allAssignments.length > 0) {
      for (const assignment of teacherData.allAssignments) {
        const { data: students, error: studError } = await (window as any).authCheck.supabase
          .from('student_database')
          .select('rfid_card_no, iid, student_name_en')
          .eq('active_class', assignment.access_class)
          .eq('active_section', assignment.access_section);

        if (studError) throw studError;
        if (students) allFetchedStudents = allFetchedStudents.concat(students as Student[]);
      }
    } else {
      let accessClass = teacherData.access_class as string;
      let accessSection = teacherData.access_section as string;

      if (typeof accessClass === 'string' && accessClass.includes(',')) {
        const classes = accessClass.split(',').map(c => c.trim()).filter(Boolean);
        accessClass = classes[0] || '';
      }
      if (typeof accessSection === 'string' && accessSection.includes(',')) {
        const sections = accessSection.split(',').map(s => s.trim()).filter(Boolean);
        accessSection = sections[0] || '';
      }

      const { data: students, error: studError } = await (window as any).authCheck.supabase
        .from('student_database')
        .select('rfid_card_no, iid, student_name_en')
        .eq('active_class', accessClass)
        .eq('active_section', accessSection);

      if (studError) throw studError;
      allFetchedStudents = students || [];
    }

    const students = allFetchedStudents.filter((student, index, self) =>
      index === self.findIndex((s) => s.iid === student.iid)
    );

    if (!students || students.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users-slash"></i>
          <h3>No Students Found</h3>
          <p>No students are enrolled in your assigned classes</p>
        </div>
      `;
      return;
    }

    const rfidCards = students.map(s => s.rfid_card_no).filter(Boolean);

    if (rfidCards.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-id-card"></i>
          <h3>No RFID Cards Assigned</h3>
          <p>Students in your class don't have RFID cards assigned yet. Please contact admin.</p>
        </div>
      `;
      return;
    }

    let query: any = (window as any).authCheck.supabase
      .from('attendence_entry')
      .select('attendence_date, rfid_card_no')
      .in('rfid_card_no', rfidCards)
      .order('attendence_date', { ascending: false });

    if (fromDate) query = query.gte('attendence_date', fromDate);
    if (toDate) query = query.lte('attendence_date', toDate);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-clipboard-list"></i>
          <h3>No Records Found</h3>
          <p>No RFID attendance records for your class in the selected date range</p>
        </div>
      `;
      return;
    }

    const groupedData: Record<string, Set<string>> = {};
    data.forEach((record: any) => {
      const date = record.attendence_date;
      if (!groupedData[date]) groupedData[date] = new Set();
      groupedData[date].add(record.rfid_card_no);
    });

    const totalDays = Object.keys(groupedData).length;
    const totalStudents = students.length;
    let totalPercentage = 0;

    Object.values(groupedData).forEach(rfidSet => {
      const scanned = rfidSet.size;
      totalPercentage += (scanned / totalStudents) * 100;
    });

    const avgAttendance = totalDays > 0 ? (totalPercentage / totalDays).toFixed(1) : '0';

    (document.getElementById('totalDays') as HTMLElement).textContent = String(totalDays);
    (document.getElementById('totalStudents') as HTMLElement).textContent = String(totalStudents);
    (document.getElementById('avgAttendance') as HTMLElement).textContent = `${avgAttendance}%`;
    if (summarySection) summarySection.style.display = 'block';

    let tableHTML = `
      <div class="attendance-table-container">
        <table class="attendance-table">
          <thead>
            <tr>
              <th><i class="fas fa-calendar"></i> Date</th>
              <th><i class="fas fa-chalkboard"></i> Class</th>
              <th><i class="fas fa-layer-group"></i> Section</th>
              <th><i class="fas fa-user-check"></i> Students Scanned</th>
              <th><i class="fas fa-users"></i> Total Students</th>
              <th><i class="fas fa-chart-pie"></i> Attendance %</th>
            </tr>
          </thead>
          <tbody>
    `;

    const sortedDates = Object.keys(groupedData).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    sortedDates.forEach(date => {
      const rfidSet = groupedData[date];
      const scanned = rfidSet?.size || 0;
      const total = students.length;
      const percentage = ((scanned / total) * 100).toFixed(1);

      tableHTML += `
        <tr>
          <td><strong>${formatDate(date)}</strong></td>
          <td>${teacherData.access_class}</td>
          <td>${teacherData.access_section}</td>
          <td><span class="status-badge status-present">${scanned} students</span></td>
          <td>${total} students</td>
          <td><strong>${percentage}%</strong></td>
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
    console.error('Error loading teacher history:', error);
    content.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <h3>Error Loading Data</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

async function init(): Promise<void> {
  try {
    await waitForAuthSystem();
    teacherData = await (window as any).authCheck.checkAuth();

    (document.getElementById('teacherEmail') as HTMLElement).textContent = teacherData.teacher_email || 'Unknown';
    (document.getElementById('teacherClass') as HTMLElement).textContent = teacherData.access_class || '-';
    (document.getElementById('teacherSection') as HTMLElement).textContent = teacherData.access_section || '-';

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);

    (document.getElementById('teacherToDate') as HTMLInputElement).valueAsDate = today;
    (document.getElementById('teacherFromDate') as HTMLInputElement).valueAsDate = thirtyDaysAgo;

    await loadTeacherHistory();
  } catch (error) {
    console.error('Error initializing:', error);
    (document.getElementById('teacherHistoryContent') as HTMLElement).innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <h3>Authentication Error</h3>
        <p>${(error as any).message}</p>
      </div>
    `;
  }
}

// Expose for inline handlers
(window as any).loadTeacherHistory = loadTeacherHistory;

// Auto init
window.addEventListener('DOMContentLoaded', () => {
  init().catch(console.error);
});
