const express = require('express');
module.exports = (() => {
  const r = express.Router();
  const db = require('../config/db');
  r.get('/', async (req, res) => {
    try {
      const { rows } = await db.query(`
        SELECT dept.*, u.name AS head_doctor_name,
               COUNT(d.doctor_id) AS doctor_count
        FROM departments dept
        LEFT JOIN doctors d ON d.dept_id = dept.dept_id
        LEFT JOIN doctors hd ON hd.doctor_id = dept.head_doctor
        LEFT JOIN users u ON u.user_id = hd.user_id
        GROUP BY dept.dept_id, u.name ORDER BY dept.dept_name
      `);
      res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  r.post('/', async (req, res) => {
    const { dept_name, description } = req.body;
    try {
      const insert = await db.query(
        `INSERT INTO departments (dept_name, description) VALUES (?,?)`,
        [dept_name, description]
      );
      const id = insert.result.insertId;
      const { rows } = await db.query('SELECT * FROM departments WHERE dept_id = ?', [id]);
      res.status(201).json(rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
  });
  return r;
})();
