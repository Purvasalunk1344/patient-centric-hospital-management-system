const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

// GET all patients
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT p.patient_id, p.name, p.phone, p.dob, p.gender,
             p.blood_group, p.address, p.emergency_contact,
             p.created_at, u.email
      FROM patients p
      LEFT JOIN users u ON u.user_id = p.user_id
      ORDER BY p.patient_id DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single patient with full profile
router.get('/:id', async (req, res) => {
  try {
    if (req.user && req.user.role === 'patient' && String(req.user.patient_id) !== String(req.Params ? req.Params.id : req.params.id)) {
      return res.status(403).json({ error: 'Access denied: You can only view your own profile.' });
    }
    const { rows } = await db.query(`
      SELECT p.*, u.email, u.role, u.created_at AS registered_on
      FROM patients p
      LEFT JOIN users u ON u.user_id = p.user_id
      WHERE p.patient_id = ?
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Patient not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create patient
router.post('/', requireAdmin, async (req, res) => {
  const { name, phone, dob, gender, blood_group, address, emergency_contact } = req.body;
  try {
    const insert = await db.query(`
      INSERT INTO patients (name, phone, dob, gender, blood_group, address, emergency_contact)
      VALUES (?,?,?,?,?,?,?)
    `, [name, phone, dob, gender, blood_group, address, emergency_contact]);
    const id = insert.result.insertId;
    const { rows } = await db.query('SELECT * FROM patients WHERE patient_id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update patient
router.put('/:id', requireAdmin, async (req, res) => {
  const { name, phone, dob, gender, blood_group, address, emergency_contact } = req.body;
  try {
    await db.query(`
      UPDATE patients SET name=?, phone=?, dob=?, gender=?,
             blood_group=?, address=?, emergency_contact=?
      WHERE patient_id=?
    `, [name, phone, dob, gender, blood_group, address, emergency_contact, req.params.id]);
    const { rows } = await db.query('SELECT * FROM patients WHERE patient_id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Patient not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET patient's full history (appointments + admissions + bills)
router.get('/:id/history', async (req, res) => {
  try {
    if (req.user && req.user.role === 'patient' && String(req.user.patient_id) !== String(req.params.id)) {
      return res.status(403).json({ error: 'Access denied: You can only view your own history.' });
    }
    const [appts, admissions, bills] = await Promise.all([
      db.query(`
        SELECT a.*, u.name AS doctor_name, d.dept_id,
               dept.dept_name
        FROM appointments a
        JOIN doctors d ON d.doctor_id = a.doctor_id
        JOIN users u ON u.user_id = d.user_id
        JOIN departments dept ON dept.dept_id = d.dept_id
        WHERE a.patient_id = ? ORDER BY a.appt_date DESC
      `, [req.params.id]),
      db.query(`
        SELECT a.*, u.name AS doctor_name, b.bed_number, w.ward_name
        FROM admissions a
        JOIN doctors dr ON dr.doctor_id = a.doctor_id
        JOIN users u ON u.user_id = dr.user_id
        JOIN beds b ON b.bed_id = a.bed_id
        JOIN wards w ON w.ward_id = b.ward_id
        WHERE a.patient_id = ? ORDER BY a.admit_date DESC
      `, [req.params.id]),
      db.query(`
        SELECT b.*, COALESCE(SUM(p.amount_paid),0) AS paid
        FROM bills b
        LEFT JOIN payments p ON p.bill_id = b.bill_id
        WHERE b.patient_id = ?
        GROUP BY b.bill_id ORDER BY b.bill_date DESC
      `, [req.params.id]),
    ]);
    res.json({
      appointments: appts.rows,
      admissions:   admissions.rows,
      bills:        bills.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
