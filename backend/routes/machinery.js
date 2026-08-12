const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT m.*, dept.dept_name FROM machinery m
      LEFT JOIN departments dept ON dept.dept_id = m.dept_id
      WHERE m.is_active = 1 ORDER BY m.machine_name
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/usage', async (req, res) => {
  const { patient_id, machine_id, admission_id, duration_mins, operated_by } = req.body;
  try {
    const { rows } = await db.query(`SELECT usage_rate FROM machinery WHERE machine_id=?`, [machine_id]);
    const m = rows[0];
    const amount_charged = (duration_mins * m.usage_rate).toFixed(2);
    const insert = await db.query(`
      INSERT INTO machinery_usage (patient_id, machine_id, admission_id, duration_mins, amount_charged, operated_by)
      VALUES (?,?,?,?,?,?)
    `, [patient_id, machine_id, admission_id || null, duration_mins, amount_charged, operated_by || null]);
    const id = insert.result.insertId;
    const { rows: [usage] } = await db.query('SELECT * FROM machinery_usage WHERE usage_id = ?', [id]);
    res.status(201).json(usage);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
