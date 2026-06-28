// ============================================
// RFID ATTENDANCE SYSTEM - BACKEND SERVER
// WITH DASHBOARD + PERMANENT FILE STORAGE
// WITH INDIA TIMEZONE (IST)
// ============================================

const express = require('express');
const cors = require('cors');
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');

// ============================================
// SET TIMEZONE TO INDIA STANDARD TIME (IST)
// ============================================
process.env.TZ = 'Asia/Kolkata';
moment.tz.setDefault('Asia/Kolkata');

const app = express();

app.use(cors());
app.use(express.json());

// ============================================
// SERVE STATIC FILES (DASHBOARD)
// ============================================
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// PERMANENT STORAGE FILE PATH
// ============================================
const DATA_FILE = path.join(__dirname, 'attendance-data.json');

// Load existing data from file (on server start)
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading data:', err);
  }
  return [];
}

// Save data to file (after every new record)
function saveData(records) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving data:', err);
  }
}

// ============================================
// EMPLOYEE DATABASE
// ============================================
// 👇 CHANGE THIS SECTION WITH YOUR ACTUAL EMPLOYEES 👇

const employees = {
  '83BE8021': {
    name: 'Tejas Singh',
    role: 'Director',
    id: 'EMP001',
    phone: '9373879915'
  },
  'A2CF041F': {
    name: 'Sanskruti Nimbarte',
    role: 'Employee',
    id: 'EMP002',
    phone: '9356114414'
  },
  '9268541F': {
    name: 'Harshal Kubde',
    role: 'Employee',
    id: 'EMP003',
    phone: '8999967247'
  },
  '5308BCC2': {
    name: 'Priyanka Thakre',
    role: 'Employee',
    id: 'EMP004',
    phone: '8329069882'
  }
};

// 👆 ADD MORE EMPLOYEES LIKE THIS 👆

// ============================================
// LOAD DATA ON STARTUP
// ============================================
let attendanceRecords = loadData();
console.log(`📂 Loaded ${attendanceRecords.length} existing records from file.`);

// ============================================
// ROOT ROUTE - SERVE DASHBOARD
// ============================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// ============================================
// API ENDPOINT 1: RECEIVE DATA FROM ESP32
// ============================================

app.post('/api/attendance', (req, res) => {
  try {
    const { cardUID, timestamp } = req.body;

    if (!cardUID) {
      return res.status(400).json({ error: 'Card ID missing' });
    }

    const employee = employees[cardUID] || {
      name: 'Unknown User',
      role: 'Guest',
      id: 'UNKNOWN',
      phone: 'N/A'
    };

    const lastRecord = attendanceRecords
      .filter(r => r.cardUID === cardUID)
      .slice(-1)[0];

    const type = !lastRecord || lastRecord.type === 'OUT' ? 'IN' : 'OUT';

    // Convert timestamp to India time
    // Treat incoming timestamp as UTC, then convert to IST
    const istTime = moment.utc(timestamp).tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss');
    const istDate = moment.utc(timestamp).tz('Asia/Kolkata').format('YYYY-MM-DD');

    const newRecord = {
      id: attendanceRecords.length + 1,
      cardUID: cardUID,
      employeeID: employee.id,
      employeeName: employee.name,
      employeeRole: employee.role,
      employeePhone: employee.phone,
      type: type,
      timestamp: istTime,
      date: istDate
    };

    attendanceRecords.push(newRecord);

    // 💾 SAVE TO FILE IMMEDIATELY
    saveData(attendanceRecords);

    console.log(`✓ ${type} - ${employee.name} (${employee.phone}) at ${istTime}`);

    res.json({
      success: true,
      message: `${type} recorded for ${employee.name}`,
      record: newRecord
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// API ENDPOINT 2: GET ALL RECORDS
// ============================================

app.get('/api/attendance', (req, res) => {
  res.json(attendanceRecords);
});

// ============================================
// API ENDPOINT 3: GET RECORDS FOR SPECIFIC DATE
// ============================================

app.get('/api/attendance/date/:date', (req, res) => {
  const { date } = req.params;
  const filtered = attendanceRecords.filter(r => r.date === date);
  res.json(filtered);
});

// ============================================
// API ENDPOINT 4: DOWNLOAD AS CSV
// ============================================

app.get('/api/attendance/download', (req, res) => {
  let csvContent = 'Employee ID,Name,Position,Phone,Date,Time,Type\n';

  attendanceRecords.forEach(record => {
    const time = moment.utc(record.timestamp).tz('Asia/Kolkata').format('HH:mm:ss');
    csvContent += `${record.employeeID},${record.employeeName},${record.employeeRole},${record.employeePhone},${record.date},${time},${record.type}\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="attendance.csv"');
  res.send(csvContent);
});

// ============================================
// API ENDPOINT 5: DELETE ALL DATA (ADMIN)
// ============================================

app.delete('/api/attendance/clear', (req, res) => {
  attendanceRecords.length = 0;
  saveData(attendanceRecords); // 💾 Save empty array to file too
  res.json({ success: true, message: 'All records cleared' });
});

// ============================================
// API ENDPOINT 6: GET SERVER STATUS
// ============================================

app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    uptime: process.uptime(),
    records: attendanceRecords.length,
    employees: Object.keys(employees).length,
    timezone: 'Asia/Kolkata (IST)',
    timestamp: moment().tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm:ss')
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = 5000;

app.listen(PORT, () => {
  const istTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');
  
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   🚀 RFID ATTENDANCE SERVER STARTED                       ║');
  console.log(`║   🌐 Web Dashboard: http://localhost:${PORT}                       ║`);
  console.log(`║   📱 API Endpoint: http://localhost:${PORT}/api/attendance         ║`);
  console.log('║   💾 Data saved permanently in attendance-data.json        ║');
  console.log('║   ⏰ Waiting for RFID scans from ESP32...                  ║');
  console.log('║   🇮🇳 Timezone: India Standard Time (IST - UTC+5:30)       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`⏰ Server Time: ${istTime}`);
  console.log('');
  console.log('📡 Registered Employees:');
  Object.entries(employees).forEach(([uid, emp]) => {
    console.log(`   ✓ ${emp.name} (${emp.id}) - ${emp.phone} [UID: ${uid}]`);
  });
  console.log('');
  console.log('📖 Quick Links:');
  console.log(`   • Dashboard: http://localhost:${PORT}`);
  console.log(`   • API Status: http://localhost:${PORT}/api/status`);
  console.log('');
});
