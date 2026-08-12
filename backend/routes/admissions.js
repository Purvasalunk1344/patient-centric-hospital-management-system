const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

// GET all admissions — optional status filter
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let q = `
      SELECT a.*, p.name AS patient_name, p.phone, p.blood_group,
             u.name AS doctor_name, b.bed_number,
             w.ward_name, w.ward_type, w.daily_rate,
             GREATEST(DATEDIFF(COALESCE(a.discharge_date, NOW()), a.admit_date), 0) AS days_admitted
      FROM admissions a
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN doctors  d ON d.doctor_id  = a.doctor_id
      JOIN users    u ON u.user_id    = d.user_id
      JOIN beds     b ON b.bed_id     = a.bed_id
      JOIN wards    w ON w.ward_id    = b.ward_id
    `;
    const params = [];
    if (status) { q += ' WHERE a.status = ?'; params.push(status); }
    q += ' ORDER BY a.admit_date DESC';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST admit a patient
router.post('/', async (req, res) => {
  const { patient_id, doctor_id, bed_id, reason, notes, appt_id } = req.body;

  if (!appt_id) {
    return res.status(400).json({ error: 'Appointment ID is required for admission' });
  }

  try {
    const { rows: apptRows } = await db.query(
      'SELECT patient_id, doctor_id, status FROM appointments WHERE appt_id = ?',
      [appt_id]
    );

    if (!apptRows.length) {
      return res.status(400).json({ error: 'Invalid appointment ID' });
    }

    const appointment = apptRows[0];
    if (String(appointment.patient_id) !== String(patient_id)) {
      return res.status(400).json({ error: 'Appointment does not belong to the admitted patient' });
    }
    if (String(appointment.doctor_id) !== String(doctor_id)) {
      return res.status(400).json({ error: 'Admission doctor must match the appointment doctor' });
    }
    if (appointment.status !== 'completed') {
      return res.status(400).json({ error: 'Appointment must be completed before admission' });
    }

    const insert = await db.query(`
      INSERT INTO admissions (patient_id, doctor_id, bed_id, reason, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [patient_id, doctor_id, bed_id, reason, notes]);

    const id = insert.result.insertId;

    // ✅ Mark bed as occupied when patient is admitted
    await db.query(`
      UPDATE beds
      SET status = 'occupied'
      WHERE bed_id = ?
    `, [bed_id]);

    const { rows } = await db.query('SELECT * FROM admissions WHERE admission_id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH discharge — returns bill summary so frontend can offer "Generate Bill now?"
router.patch('/:id/discharge', async (req, res) => {
  try {
    // Get admission details first to find the bed_id
    const { rows: admissionRows } = await db.query(`
      SELECT admission_id, bed_id FROM admissions WHERE admission_id = ?
    `, [req.params.id]);

    if (!admissionRows.length) {
      return res.status(404).json({ error: 'Admission not found' });
    }

    const bed_id = admissionRows[0].bed_id;

    // ✅ Update admission status to discharged
    await db.query(`
      UPDATE admissions
      SET discharge_date = NOW(), status = 'discharged'
      WHERE admission_id = ?
    `, [req.params.id]);

    // ✅ Mark bed as available again
    await db.query(`
      UPDATE beds
      SET status = 'available'
      WHERE bed_id = ?
    `, [bed_id]);

    // ✅ Use fn_bed_charge() stored function to calculate bed charges
    const { rows } = await db.query(`
      SELECT a.*,
             p.name AS patient_name, p.patient_id,
             u.name AS doctor_name,
             b.bed_number, w.ward_name, w.daily_rate,
             DATEDIFF(a.discharge_date, a.admit_date) AS days_admitted,
             fn_bed_charge(a.admission_id) AS total_bed_charge
      FROM admissions a
      JOIN patients p ON p.patient_id = a.patient_id
      JOIN doctors  d ON d.doctor_id  = a.doctor_id
      JOIN users    u ON u.user_id    = d.user_id
      JOIN beds     b ON b.bed_id     = a.bed_id
      JOIN wards    w ON w.ward_id    = b.ward_id
      WHERE a.admission_id = ?
    `, [req.params.id]);

    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


module.exports = router;
