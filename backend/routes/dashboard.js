const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

// GET admin dashboard stats
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    // ✅ Clean up stale occupied beds before reporting
    // (beds marked occupied but with no active admission)
    await db.query(`
      UPDATE beds b
      LEFT JOIN admissions a ON a.bed_id = b.bed_id AND a.status = 'admitted'
      SET b.status = 'available'
      WHERE b.status = 'occupied' AND a.admission_id IS NULL
    `);

    const [patients, admissions, todayAppts, revenue, beds, pendingBills] = await Promise.all([
      db.query(`SELECT COUNT(*) AS total FROM patients`),
      db.query(`SELECT COUNT(*) AS total FROM admissions WHERE status='admitted'`),
      db.query(`SELECT COUNT(*) AS total FROM appointments WHERE appt_date=CURRENT_DATE() AND status='scheduled'`),
      db.query(`SELECT COALESCE(SUM(amount_paid),0) AS today FROM payments WHERE payment_date=CURRENT_DATE()`),
      db.query(`
        SELECT 
          SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) AS available,
          SUM(CASE WHEN status='occupied' THEN 1 ELSE 0 END) AS occupied,
          COUNT(*) AS total
        FROM beds
      `),
      db.query(`SELECT COUNT(*) AS total FROM bills WHERE status IN ('generated','partially_paid')`),
    ]);

    res.json({
      total_patients:      parseInt(patients.rows[0].total, 10),
      active_admissions:   parseInt(admissions.rows[0].total, 10),
      todays_appointments: parseInt(todayAppts.rows[0].total, 10),
      revenue_today:       parseFloat(revenue.rows[0].today),
      beds:                beds.rows[0],
      pending_bills:       parseInt(pendingBills.rows[0].total, 10),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET revenue chart data (last 6 months)
router.get('/revenue-chart', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        DATE_FORMAT(b.bill_date, '%b %Y') AS month,
        DATE_FORMAT(b.bill_date, '%Y-%m-01') AS month_date,
        SUM(b.total_amount) AS billed,
        COALESCE(SUM(py.paid),0) AS collected
      FROM bills b
      LEFT JOIN (
        SELECT bill_id, SUM(amount_paid) AS paid FROM payments GROUP BY bill_id
      ) py ON py.bill_id = b.bill_id
      WHERE b.bill_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
        AND b.status != 'cancelled'
      GROUP BY DATE_FORMAT(b.bill_date, '%Y-%m-01')
      ORDER BY month_date
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET department-wise appointment stats
router.get('/dept-stats', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT dept.dept_name,
             COUNT(a.appt_id) AS appointments,
             SUM(CASE WHEN a.status='completed' THEN 1 ELSE 0 END) AS completed
      FROM departments dept
      LEFT JOIN doctors d ON d.dept_id = dept.dept_id
      LEFT JOIN appointments a ON a.doctor_id = d.doctor_id
        AND a.appt_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
      GROUP BY dept.dept_id, dept.dept_name
      ORDER BY appointments DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET stats for a specific patient
router.get('/patient-stats', async (req, res) => {
  try {
    const patient_id = req.user.patient_id;
    if (!patient_id) return res.status(400).json({ error: 'No patient record linked to this account.' });

    const [nextAppt, admission, bill] = await Promise.all([
      db.query(`
        SELECT a.appt_date, a.appt_time, u.name AS doctor_name, dept.dept_name
        FROM appointments a
        JOIN doctors d ON d.doctor_id = a.doctor_id
        JOIN users u ON u.user_id = d.user_id
        JOIN departments dept ON dept.dept_id = d.dept_id
        WHERE a.patient_id = ? AND (a.appt_date > CURRENT_DATE() OR (a.appt_date = CURRENT_DATE() AND a.appt_time >= CURRENT_TIME()))
        ORDER BY a.appt_date, a.appt_time LIMIT 1
      `, [patient_id]),
      db.query(`
        SELECT a.admit_date, w.ward_name, b.bed_number
        FROM admissions a
        JOIN beds b ON b.bed_id = a.bed_id
        JOIN wards w ON w.ward_id = b.ward_id
        WHERE a.patient_id = ? AND a.status = 'admitted' LIMIT 1
      `, [patient_id]),
      db.query(`
        SELECT SUM(b.total_amount - COALESCE(py.paid, 0)) AS balance
        FROM bills b
        LEFT JOIN (SELECT bill_id, SUM(amount_paid) AS paid FROM payments GROUP BY bill_id) py ON py.bill_id = b.bill_id
        WHERE b.patient_id = ? AND b.status IN ('generated','partially_paid')
      `, [patient_id]),
    ]);

    res.json({
      next_appointment: nextAppt.rows[0] || null,
      current_admission: admission.rows[0] || null,
      pending_balance: parseFloat(bill.rows[0].balance || 0),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
