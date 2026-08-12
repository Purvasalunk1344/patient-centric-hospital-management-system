const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET all wards with occupancy
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT w.*, dept.dept_name,
             COUNT(b.bed_id) AS total_beds,
             SUM(CASE WHEN b.status = 'occupied' THEN 1 ELSE 0 END) AS occupied_beds,
             SUM(CASE WHEN b.status = 'available' THEN 1 ELSE 0 END) AS available_beds
      FROM wards w
      LEFT JOIN departments dept ON dept.dept_id = w.dept_id
      LEFT JOIN beds b ON b.ward_id = w.ward_id
      GROUP BY w.ward_id, dept.dept_name
      ORDER BY w.ward_type
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET available beds
router.get('/available-beds', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT b.bed_id, b.bed_number, b.status,
             w.ward_name, w.ward_type, w.daily_rate
      FROM beds b
      JOIN wards w ON w.ward_id = b.ward_id
      WHERE b.status = 'available'
      ORDER BY w.daily_rate
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
