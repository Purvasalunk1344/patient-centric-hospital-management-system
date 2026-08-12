const express = require('express');
const router  = express.Router();
const db      = require('../config/db');

// POST record a payment
// FIX 1: Explicitly pass payment_date = CURDATE() in INSERT
//        (MySQL column has no DEFAULT, so omitting it causes error)
// FIX 2: Use net_amount (after discount) for balance check
router.post('/', async (req, res) => {
  const { bill_id, amount_paid, payment_method, transaction_ref, received_by, notes } = req.body;
  try {
    const { rows: [bill] } = await db.query(`
      SELECT
        b.total_amount,
        COALESCE(b.net_amount, b.total_amount) AS net_amount,
        COALESCE(SUM(p.amount_paid), 0)        AS already_paid
      FROM bills b
      LEFT JOIN payments p ON p.bill_id = b.bill_id
      WHERE b.bill_id = ?
      GROUP BY b.bill_id
    `, [bill_id]);

    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const remaining = parseFloat(bill.net_amount) - parseFloat(bill.already_paid);

    if (parseFloat(amount_paid) > remaining + 0.01) {
      return res.status(400).json({
        error: `Payment ₹${amount_paid} exceeds balance due ₹${remaining.toFixed(2)}`
      });
    }

    // FIX: Include payment_date explicitly — column has no DEFAULT in schema
    const insert = await db.query(`
      INSERT INTO payments
        (bill_id, amount_paid, payment_date, payment_method, transaction_ref, received_by, notes)
      VALUES (?, ?, CURDATE(), ?, ?, ?, ?)
    `, [bill_id, amount_paid, payment_method,
        transaction_ref || null, received_by || null, notes || null]);

    const id = insert.result.insertId;
    const { rows: [payment] } = await db.query(
      'SELECT * FROM payments WHERE payment_id = ?', [id]
    );

    // ✅ Bill status updated automatically by trigger: trg_payment_status_after_insert
    // Trigger recalculates: CASE WHEN paid >= net_amount THEN 'paid' ...

    res.status(201).json({
      payment,
      balance_remaining: Math.max(0, remaining - parseFloat(amount_paid)).toFixed(2),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET payment history for a bill
router.get('/bill/:bill_id', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT py.*, u.name AS received_by_name
      FROM payments py
      LEFT JOIN users u ON u.user_id = py.received_by
      WHERE py.bill_id = ?
      ORDER BY py.payment_date
    `, [req.params.bill_id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
