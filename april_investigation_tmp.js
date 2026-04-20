/**
 * April 2026 Attendance Deep-Dive
 * - Finds all April payroll records with totalDeductions > 15,000
 * - Pulls raw attendance for April for those staff
 * - Calculates expected deductions purely from attendance
 * - Compares with stored payroll deductions
 *
 * Run: node april_investigation_tmp.js
 */
require('dotenv').config({ path: '/Users/FreshOlutimi/Desktop/ppafan-app/backend/.env' });
const mongoose = require('/Users/FreshOlutimi/Desktop/ppafan-app/backend/node_modules/mongoose');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME   = process.env.MONGODB_DB || 'ppafan_db';

async function run() {
  await mongoose.connect(MONGO_URI, { dbName: DB_NAME });
  const db = mongoose.connection.db;

  const payrollCol    = db.collection('payrolls');
  const attendanceCol = db.collection('attendances');
  const staffCol      = db.collection('staffs');
  const settingsCol   = db.collection('payrollsettings');

  // Get payroll settings (for deduction rates)
  const settings = await settingsCol.findOne({ tenantId: 'ppafan', isActive: true });
  const latenessEnabled   = settings?.deductions?.lateness?.enabled   || false;
  const absenceEnabled    = settings?.deductions?.absence?.enabled    || false;
  const earlyLeaveEnabled = settings?.deductions?.earlyLeave?.enabled || false;
  const graceMinutes      = settings?.deductions?.lateness?.graceMinutes ?? 5;

  console.log(`\n== PAYROLL SETTINGS ==`);
  console.log(`Lateness deduction enabled: ${latenessEnabled}`);
  console.log(`Absence deduction enabled:  ${absenceEnabled}`);
  console.log(`Early leave deduction enabled: ${earlyLeaveEnabled}`);
  console.log(`Lateness grace minutes: ${graceMinutes}`);
  console.log(`Early leave grace minutes: ${settings?.deductions?.earlyLeave?.graceMinutes ?? 5}`);

  // ---- April payroll records with totalDeductions > 15000 ----
  const aprilRecords = await payrollCol.find({
    tenantId: 'ppafan',
    period: '2026-04',
    'payrollSummary.totalDeductions': { $gt: 15000 }
  }).toArray();

  if (aprilRecords.length === 0) {
    console.log('\nNo April payroll records with deductions > ₦15,000');
    await mongoose.disconnect();
    return;
  }

  // Build staff name lookup
  const empIds = aprilRecords.map(r => String(r.employeeNumber));
  const staffDocs = await staffCol.find({ employeeId: { $in: empIds } }).toArray();
  const staffMap = {};
  staffDocs.forEach(s => {
    staffMap[String(s.employeeId)] = {
      name: `${s.firstName} ${s.lastName || ''}`.trim(),
      baseSalary: s.baseSalary || 0,
      department: s.department || 'N/A',
      position: s.position || 'N/A'
    };
  });

  // ---- Pull April attendance for these staff ----
  const attRecords = await attendanceCol.find({
    tenantId: 'pumphouse',
    date: { $gte: '2026-04-01', $lte: '2026-04-30' },
    employeeId: { $in: empIds }
  }).toArray();

  // Group attendance by employeeId
  const attByEmp = {};
  attRecords.forEach(r => {
    if (!attByEmp[r.employeeId]) attByEmp[r.employeeId] = [];
    attByEmp[r.employeeId].push(r);
  });

  // ---- Summarise each staff ----
  console.log(`\n== APRIL 2026: STAFF WITH DEDUCTIONS > ₦15,000 ==\n`);
  console.log(`Found ${aprilRecords.length} staff.\n`);

  for (const pr of aprilRecords) {
    const empId  = String(pr.employeeNumber);
    const staff  = staffMap[empId] || { name: empId, baseSalary: pr.salaryStructure?.baseSalary || 0, department: pr.department || 'N/A' };
    const recs   = attByEmp[empId] || [];

    const baseSalary  = pr.salaryStructure?.baseSalary || staff.baseSalary || 0;
    const shiftDays   = pr.attendanceData?.standardWorkingDays || 26;
    const workHrs     = 8;
    const dailyRate   = baseSalary / shiftDays;
    const hourlyRate  = dailyRate / workHrs;
    const minuteRate  = hourlyRate / 60;

    // Count from attendance records
    let absentDays      = 0;
    let lateDays        = 0;
    let totalLateMin    = 0;
    let earlyLeaveDays  = 0;
    let totalEarlyMin   = 0;

    const dayLog = [];

    recs.forEach(r => {
      if (r.absent) {
        absentDays++;
        dayLog.push(`  ${r.date}: ABSENT`);
        return;
      }
      let rowNote = `  ${r.date}:`;
      if (r.late && r.lateMinutes > 0) {
        // Apply grace: if within grace, no deduction
        const effectiveLateMin = r.lateMinutes > graceMinutes ? r.lateMinutes : 0;
        if (effectiveLateMin > 0) {
          lateDays++;
          totalLateMin += effectiveLateMin;
          rowNote += ` LATE ${r.lateMinutes}min (${effectiveLateMin}min deductible)`;
        } else {
          rowNote += ` late ${r.lateMinutes}min (within ${graceMinutes}min grace)`;
        }
      }
      if (r.earlyLeave && r.earlyLeaveMinutes > 0) {
        const earlyGrace = settings?.deductions?.earlyLeave?.graceMinutes ?? 5;
        const effectiveEarlyMin = r.earlyLeaveMinutes > earlyGrace ? r.earlyLeaveMinutes : 0;
        if (effectiveEarlyMin > 0) {
          earlyLeaveDays++;
          totalEarlyMin += effectiveEarlyMin;
          rowNote += ` | EARLY LEAVE ${r.earlyLeaveMinutes}min (${effectiveEarlyMin}min deductible)`;
        } else {
          rowNote += ` | early leave ${r.earlyLeaveMinutes}min (within ${earlyGrace}min grace)`;
        }
      }
      dayLog.push(rowNote);
    });

    // Calculate expected deductions
    const absenceDeduction    = absenceEnabled  ? absentDays * dailyRate : 0;
    const latenessDeduction   = latenessEnabled ? totalLateMin * minuteRate : 0;
    const earlyLeaveDeduction = earlyLeaveEnabled ? totalEarlyMin * minuteRate : 0;
    const totalExpectedDed    = absenceDeduction + latenessDeduction + earlyLeaveDeduction;
    const expectedNet         = baseSalary - totalExpectedDed;

    // Stored payroll values
    const storedLatDed   = pr.otherDeductions?.lateness?.amount   || 0;
    const storedEarlyDed = pr.otherDeductions?.earlyLeave?.amount || 0;
    const storedAbsDed   = pr.otherDeductions?.absence?.amount    || 0;
    const storedTotalDed = pr.payrollSummary?.totalDeductions     || 0;
    const storedNet      = pr.payrollSummary?.netPay              || 0;

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Staff:      ${staff.name} (${empId})`);
    console.log(`Dept:       ${staff.department} | ${staff.position}`);
    console.log(`Base Salary: ₦${baseSalary.toLocaleString()}`);
    console.log(`Shift Days (payroll): ${shiftDays} | Daily Rate: ₦${Math.round(dailyRate).toLocaleString()}`);
    console.log(`Attendance records in April: ${recs.length}`);
    console.log(`\n  Summary: ${absentDays} absent | ${lateDays} late days (${totalLateMin} min) | ${earlyLeaveDays} early leave days (${totalEarlyMin} min)`);
    console.log(`\n  Day-by-day:`);
    dayLog.forEach(l => console.log(l));
    console.log(`\n  -- EXPECTED DEDUCTIONS (from attendance) --`);
    console.log(`  Absence:    ${absentDays}d × ₦${Math.round(dailyRate).toLocaleString()} = ₦${Math.round(absenceDeduction).toLocaleString()}`);
    console.log(`  Lateness:   ${totalLateMin}min × ₦${minuteRate.toFixed(2)}/min = ₦${Math.round(latenessDeduction).toLocaleString()}`);
    console.log(`  Early Leave:${totalEarlyMin}min × ₦${minuteRate.toFixed(2)}/min = ₦${Math.round(earlyLeaveDeduction).toLocaleString()}`);
    console.log(`  TOTAL DED:  ₦${Math.round(totalExpectedDed).toLocaleString()}`);
    console.log(`  Net Pay:    ₦${Math.round(expectedNet).toLocaleString()}`);
    console.log(`\n  -- STORED IN PAYROLL --`);
    console.log(`  Absence:    ₦${Math.round(storedAbsDed).toLocaleString()}`);
    console.log(`  Lateness:   ₦${Math.round(storedLatDed).toLocaleString()}`);
    console.log(`  Early Leave:₦${Math.round(storedEarlyDed).toLocaleString()}`);
    console.log(`  TOTAL DED:  ₦${Math.round(storedTotalDed).toLocaleString()}`);
    console.log(`  Net Pay:    ₦${Math.round(storedNet).toLocaleString()}`);
    const diff = storedTotalDed - Math.round(totalExpectedDed);
    if (Math.abs(diff) > 100) {
      console.log(`  ⚠️  DISCREPANCY: ₦${Math.abs(diff).toLocaleString()} ${diff > 0 ? '(payroll higher)' : '(attendance calc higher)'}`);
    } else {
      console.log(`  ✅ Match (within ₦100)`);
    }
    console.log('');
  }

  await mongoose.disconnect();
}

run().catch(err => { console.error(err); process.exit(1); });
