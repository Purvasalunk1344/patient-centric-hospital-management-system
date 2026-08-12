const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/tests', async (req, res) => {
  try {
    const { rows } = await db.query(`SELECT * FROM lab_tests ORDER BY test_name`);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/orders', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT lo.*, p.name AS patient_name, u.name AS doctor_name,
             lt.test_name, lt.test_price, lt.turnaround_hours
      FROM lab_orders lo
      JOIN patients  p  ON p.patient_id = lo.patient_id
      JOIN doctors   d  ON d.doctor_id  = lo.doctor_id
      JOIN users     u  ON u.user_id    = d.user_id
      JOIN lab_tests lt ON lt.test_id   = lo.test_id
      ORDER BY lo.ordered_date DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/orders', async (req, res) => {
  const { patient_id, doctor_id, test_id, appt_id, admission_id } = req.body;
  try {
    const insert = await db.query(`
      INSERT INTO lab_orders (patient_id, doctor_id, test_id, appt_id, admission_id)
      VALUES (?,?,?,?,?)
    `, [patient_id, doctor_id, test_id, appt_id || null, admission_id || null]);
    const id = insert.result.insertId;
    const { rows } = await db.query('SELECT * FROM lab_orders WHERE order_id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/orders/:id/result', async (req, res) => {
  const { result, status } = req.body;
  try {
    await db.query(`
      UPDATE lab_orders SET result=?, status=?, result_date=CURRENT_DATE()
      WHERE order_id=?
    `, [result, status, req.params.id]);
    const { rows } = await db.query('SELECT * FROM lab_orders WHERE order_id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
