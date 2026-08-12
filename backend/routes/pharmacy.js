const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

const hasLabOrderPrescriptionColumn = async () => {
  const { rows } = await db.query("SHOW COLUMNS FROM lab_orders LIKE 'prescription_id'");
  return rows && rows.length > 0;
};

// GET all medicines with stock status
router.get('/medicines', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT *,
        CASE
          WHEN stock_quantity = 0               THEN 'out_of_stock'
          WHEN stock_quantity < reorder_level   THEN 'critical'
          WHEN stock_quantity < reorder_level*2 THEN 'low'
          ELSE 'adequate'
        END AS stock_status
      FROM medicines
      ORDER BY medicine_name
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET prescriptions — optional patient_id filter
// FIX: "? IS NULL" does not work in MySQL — use conditional query building
router.get('/prescriptions', async (req, res) => {
  try {
    const { patient_id: requestedPatientId } = req.query;

    let q = `
      SELECT pr.*, p.name AS patient_name, u.name AS doctor_name
      FROM prescriptions pr
      JOIN patients p ON p.patient_id = pr.patient_id
      JOIN doctors  d ON d.doctor_id  = pr.doctor_id
      JOIN users    u ON u.user_id    = d.user_id
    `;
    const params = [];

    if (req.user.role !== 'admin') {
      if (!req.user.patient_id) return res.json([]);
      q += ' WHERE pr.patient_id = ?';
      params.push(req.user.patient_id);
    } else if (requestedPatientId) {
      q += ' WHERE pr.patient_id = ?';
      params.push(requestedPatientId);
    }

    q += ' ORDER BY pr.prescribed_date DESC';

    const { rows: prescriptions } = await db.query(q, params);
    if (!prescriptions.length) return res.json([]);

    const prescriptionIds = prescriptions.map(pr => pr.prescription_id);
    const placeholders    = prescriptionIds.map(() => '?').join(',');

    const { rows: items } = await db.query(`
      SELECT pi.*, m.medicine_name, m.unit, m.price_per_unit,
             pi.quantity * m.price_per_unit AS line_total
      FROM prescription_items pi
      JOIN medicines m ON m.medicine_id = pi.medicine_id
      WHERE pi.prescription_id IN (${placeholders})
    `, prescriptionIds);

    const labOrders = [];
    if (await hasLabOrderPrescriptionColumn()) {
      const { rows } = await db.query(`
        SELECT lo.*, lt.test_name, lt.test_price, lt.turnaround_hours
        FROM lab_orders lo
        JOIN lab_tests lt ON lt.test_id = lo.test_id
        WHERE lo.prescription_id IN (${placeholders})
      `, prescriptionIds);
      labOrders.push(...rows);
    }

    const groupedItems = items.reduce((acc, item) => {
      acc[item.prescription_id] = acc[item.prescription_id] || [];
      acc[item.prescription_id].push(item);
      return acc;
    }, {});

    const groupedLabs = labOrders.reduce((acc, order) => {
      acc[order.prescription_id] = acc[order.prescription_id] || [];
      acc[order.prescription_id].push(order);
      return acc;
    }, {});

    res.json(prescriptions.map(pr => ({
      ...pr,
      items: groupedItems[pr.prescription_id] || [],
      lab_tests: groupedLabs[pr.prescription_id] || [],
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create prescription with items and optional lab orders
router.post('/prescriptions', requireAdmin, async (req, res) => {
  const { patient_id, doctor_id, appt_id, admission_id, notes, items, lab_test_ids } = req.body;

  if ((!items || !items.length) && (!lab_test_ids || !lab_test_ids.length)) {
    return res.status(400).json({ error: 'At least one medicine item or lab test is required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.query('START TRANSACTION');

    const [insertResult] = await conn.query(`
      INSERT INTO prescriptions (patient_id, doctor_id, appt_id, admission_id, notes)
      VALUES (?, ?, ?, ?, ?)
    `, [patient_id, doctor_id, appt_id || null, admission_id || null, notes || null]);
    const prescription_id = insertResult.insertId;

    if (items && items.length) {
      for (const item of items) {
        await conn.query(`
          INSERT INTO prescription_items
            (prescription_id, medicine_id, quantity, dosage, duration_days)
          VALUES (?, ?, ?, ?, ?)
        `, [prescription_id, item.medicine_id, item.quantity, item.dosage, item.duration_days || null]);
      }
    }

    if (lab_test_ids && lab_test_ids.length) {
      const insertWithPrescription = await hasLabOrderPrescriptionColumn();
      for (const test_id of lab_test_ids) {
        if (insertWithPrescription) {
          await conn.query(`
            INSERT INTO lab_orders
              (patient_id, doctor_id, test_id, appt_id, admission_id, prescription_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [patient_id, doctor_id, test_id, appt_id || null, admission_id || null, prescription_id]);
        } else {
          await conn.query(`
            INSERT INTO lab_orders
              (patient_id, doctor_id, test_id, appt_id, admission_id)
            VALUES (?, ?, ?, ?, ?)
          `, [patient_id, doctor_id, test_id, appt_id || null, admission_id || null]);
        }
      }
    }

    await conn.query('COMMIT');

    const { rows } = await db.query(
      'SELECT * FROM prescriptions WHERE prescription_id = ?', [prescription_id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    await conn.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

module.exports = router;
