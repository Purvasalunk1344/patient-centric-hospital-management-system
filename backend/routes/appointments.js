const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const { date, doctor_id, patient_id, status } = req.query;
    let q = `
      SELECT a.*, p.name AS patient_name, p.phone,
             u.name AS doctor_name, dept.dept_name,
             d.consultation_fee
      FROM appointments a
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN doctors d ON d.doctor_id = a.doctor_id
      JOIN users u ON u.user_id = d.user_id
      JOIN departments dept ON dept.dept_id = d.dept_id
      WHERE 1=1
    `;
    const params = [];
    
    // Role-based access logic
    if (req.user && req.user.role === 'patient') {
      params.push(req.user.patient_id);
      q += ' AND a.patient_id = ?';
    } else if (patient_id) {
      params.push(patient_id);
      q += ' AND a.patient_id = ?';
    }

    if (date)      { params.push(date);      q += ' AND a.appt_date = ?'; }
    if (doctor_id) { params.push(doctor_id); q += ' AND a.doctor_id = ?'; }
    if (status)    { params.push(status);    q += ' AND a.status = ?'; }
    q += ' ORDER BY a.appt_date DESC, a.appt_time';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST book appointment
// Patients can only book for themselves; admin can book for any patient
router.post('/', async (req, res) => {
  let { patient_id, doctor_id, appt_date, appt_time, notes } = req.body;
  try {
    // If the user is a patient, override patient_id with their own from token
    if (req.user && req.user.role === 'patient') {
      patient_id = req.user.patient_id;
      if (!patient_id) return res.status(400).json({ error: 'No patient profile linked to your account.' });
    }
    const tokenRes = await db.query(
      `SELECT COALESCE(MAX(token_no),0)+1 AS next_token FROM appointments WHERE doctor_id=? AND appt_date=?`,
      [doctor_id, appt_date]
    );
    const token_no = tokenRes.rows[0].next_token;
    const insert = await db.query(`
      INSERT INTO appointments (patient_id, doctor_id, appt_date, appt_time, token_no, notes, status)
      VALUES (?,?,?,?,?,?, 'scheduled')
    `, [patient_id, doctor_id, appt_date, appt_time, token_no, notes]);
    const id = insert.result.insertId;
    const { rows } = await db.query('SELECT * FROM appointments WHERE appt_id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH status — admin only
router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  try {
    await db.query(`UPDATE appointments SET status=? WHERE appt_id=?`, [status, req.params.id]);
    const { rows } = await db.query('SELECT * FROM appointments WHERE appt_id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
