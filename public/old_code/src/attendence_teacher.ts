export {}
// Converted from inline script in attendence_teacher.html

let teacherData: any = null;
let teacherIID: string | null = null;
let teacherRFID: string | null = null;

async function waitForAuthSystem(): Promise<void> {
  while (!(window as any).authCheck || !(window as any).authCheck.checkAuth) {
    await new Promise((r) => setTimeout(r, 50));
  }
}

async function init(): Promise<void> {
  try {
    console.log('Starting initialization...');

    await waitForAuthSystem();
    teacherData = await (window as any).authCheck.checkAuth();

    if (!teacherData) {
      console.error('No teacher data received');
      return;
    }

    (document.getElementById('teacherEmail') as HTMLElement).textContent = teacherData.teacher_email || 'N/A';

    teacherIID = teacherData.iid;
    if (!teacherIID) {
      showError('Teacher ID not found in admin_teacher table');
      return;
    }

    // Get RFID card from student_database using IID
    const { data: studentData, error: studentError } = await (window as any).authCheck.supabase
      .from('student_database')
      .select('rfid_card_no')
      .eq('iid', teacherIID)
      .single();

    if (studentError) {
      console.error('Error fetching RFID from student_database:', studentError);
      showError('RFID card not found. Please ensure your ID is registered in the student_database.');
      (document.getElementById('attendanceContent') as HTMLElement).innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>RFID Card Not Found</h3>
          <p>Your teacher ID (${teacherIID}) is not registered in the student database with an RFID card.</p>
          <p style="margin-top: 10px; font-size: 13px;">Please contact the admin to register your RFID card.</p>
        </div>
      `;
      return;
    }

    teacherRFID = studentData?.rfid_card_no;
    if (!teacherRFID) {
      showError('RFID card number is empty');
      (document.getElementById('attendanceContent') as HTMLElement).innerHTML = `
        <div class="empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>RFID Card Not Assigned</h3>
          <p>No RFID card is assigned to your account.</p>
          <p style="margin-top: 10px; font-size: 13px;">Please contact the admin to assign an RFID card.</p>
        </div>
      `;
      return;
    }

    (document.getElementById('teacherIID') as HTMLElement).textContent = teacherIID;
    (document.getElementById('teacherRFID') as HTMLElement).textContent = teacherRFID;
    (document.getElementById('teacherInfoStats') as HTMLElement).style.display = 'block';

    await loadAttendance();

    console.log('Initialization complete');
  } catch (error: any) {
    console.error('Error initializing:', error);
    showError('Error loading attendance system: ' + (error?.message || error));
  }
}

async function loadAttendance(): Promise<void> {
  const content = document.getElementById('attendanceContent') as HTMLElement;
  const fromDate = (document.getElementById('fromDate') as HTMLInputElement)?.value;
  const toDate = (document.getElementById('toDate') as HTMLInputElement)?.value;

  if (!teacherRFID) {
    showError('RFID card not found. Cannot load attendance.');
    return;
  }

  content.innerHTML = '<div class="loading"><i class="fas fa-spinner"></i><p>Loading attendance records...</p></div>';

  try {
    let query: any = (window as any).authCheck.supabase
      .from('attendence_entry')
      .select('*')
      .eq('rfid_card_no', teacherRFID)
      .order('attendence_date', { ascending: false })
      .order('attendence_time', { ascending: false });

    if (fromDate) query = query.gte('attendence_date', fromDate);
    if (toDate) query = query.lte('attendence_date', toDate);

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      const dateRangeMsg = (fromDate || toDate) ? 
        `<p style="margin-top: 10px; color: #718096; font-size: 13px;">No records found for the selected date range. Try removing the date filter.</p>` : 
        `<p style="margin-top: 10px; color: #718096; font-size: 13px;">You have not scanned your RFID card yet at any gate.</p>`;

      content.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-clipboard-list"></i>
          <h3>No Attendance Records</h3>
          <p>No attendance records found for your RFID card</p>
          ${dateRangeMsg}
        </div>
      `;
      (document.getElementById('totalRecords') as HTMLElement).textContent = '0';
      return;
    }

    (document.getElementById('totalRecords') as HTMLElement).textContent = String(data.length);

    const processedData: any[] = [];
    const dailyEntries: Record<string, any[]> = {};

    data.forEach((row: any) => {
      const date = row.attendence_date || '';
      if (!dailyEntries[date]) dailyEntries[date] = [];
      dailyEntries[date].push(row);
    });

    Object.keys(dailyEntries).forEach(date => {
      const dayEntries = (dailyEntries[date] || []).sort((a, b) => {
        const timeA = a.attendence_time || '';
        const timeB = b.attendence_time || '';
        return timeA.localeCompare(timeB);
      });

      dayEntries.forEach((entry, index) => {
        processedData.push({ ...entry, entryStatus: index % 2 === 0 ? 'IN' : 'OUT' });
      });
    });

    processedData.sort((a, b) => {
      const dateA = a.attendence_date || '';
      const dateB = b.attendence_date || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      const timeA = a.attendence_time || '';
      const timeB = b.attendence_time || '';
      return timeB.localeCompare(timeA);
    });

    let tableHTML = `
      <div class="attendance-table-container">
        <table class="attendance-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Time</th>
              <th>Status</th>
              <th>Device/Location</th>
            </tr>
          </thead>
          <tbody>
    `;

    processedData.forEach((record, idx) => {
      const date = record.attendence_date || '';
      const time = record.attendence_time || '';
      const status = record.entryStatus;
      const statusClass = status === 'IN' ? 'entry-in' : 'entry-out';
      const device = record.device_location || 'Main Gate';

      tableHTML += `
        <tr>
          <td><strong>${idx + 1}</strong></td>
          <td>${formatDate(date)}</td>
          <td><strong>${formatTime(time)}</strong></td>
          <td><span class="${statusClass}">${status}</span></td>
          <td>${device}</td>
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
    console.error('Error loading attendance:', error);
    content.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <h3>Error Loading Data</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function formatTime(timeStr: string): string {
  try {
    return new Date('1970-01-01T' + timeStr).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch {
    return timeStr;
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

// Expose needed functions
(window as any).loadAttendance = loadAttendance;
(window as any).showError = showError;
(window as any).showSuccess = showSuccess;

window.addEventListener('DOMContentLoaded', () => {
  init().catch(console.error);
});