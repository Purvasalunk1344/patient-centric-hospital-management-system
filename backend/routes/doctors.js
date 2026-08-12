const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

// GET all doctors with dept info
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT d.doctor_id, u.name, u.email, dept.dept_name,
             d.specialization, d.consultation_fee,
             d.qualification, d.experience_years, d.available_days
      FROM doctors d
      JOIN users u ON u.user_id = d.user_id
      JOIN departments dept ON dept.dept_id = d.dept_id
      ORDER BY dept.dept_name, u.name
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single doctor
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT d.*, u.name, u.email, dept.dept_name
      FROM doctors d
      JOIN users u ON u.user_id = d.user_id
      JOIN departments dept ON dept.dept_id = d.dept_id
      WHERE d.doctor_id = ?
    `, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Doctor not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET doctor's appointments for today
router.get('/:id/appointments/today', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT a.*, p.name AS patient_name, p.phone, p.blood_group
      FROM appointments a
      JOIN patients p ON p.patient_id = a.patient_id
      WHERE a.doctor_id = ? AND a.appt_date = CURRENT_DATE()
      ORDER BY a.appt_time
    `, [req.params.id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create doctor (admin only)
router.post('/', requireAdmin, async (req, res) => {
  const { user_id, dept_id, specialization, consultation_fee, qualification, experience_years, available_days } = req.body;
  try {
    const insert = await db.query(`
      INSERT INTO doctors (user_id, dept_id, specialization, consultation_fee, qualification, experience_years, available_days)
      VALUES (?,?,?,?,?,?,?)
    `, [user_id, dept_id, specialization, consultation_fee, qualification, experience_years, available_days]);
    const id = insert.result.insertId;
    const { rows } = await db.query('SELECT * FROM doctors WHERE doctor_id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
