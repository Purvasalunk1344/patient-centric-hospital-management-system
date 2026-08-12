const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { requireAdmin } = require('../middleware/auth');


// ─────────────────────────────────────────────────────────────
//  GET /api/billing  — all bills (using v_outstanding_bills view)
// ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const isPatient = req.user && req.user.role === 'patient';
    let q = `
      SELECT b.bill_id, b.patient_id, p.name AS patient_name, p.phone,
             b.total_amount, b.status, b.bill_date,
             COALESCE(SUM(py.amount_paid), 0) AS amount_paid,
             b.total_amount - COALESCE(SUM(py.amount_paid), 0) AS balance_due
      FROM bills b
      JOIN patients p ON p.patient_id = b.patient_id
      LEFT JOIN payments py ON py.bill_id = b.bill_id
    `;
    const params = [];
    
    if (isPatient) {
      q += ' WHERE b.patient_id = ?';
      params.push(req.user.patient_id);
    }
    
    q += ' GROUP BY b.bill_id ORDER BY b.bill_date DESC';
    
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────
//  ALERTS — BEFORE /:id  (route order is critical)
// ─────────────────────────────────────────────────────────────
router.get('/alerts/all', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT ba.*, p.name AS patient_name, p.phone
      FROM billing_alerts ba
      JOIN patients p ON p.patient_id = ba.patient_id
      WHERE ba.is_resolved = 0
      ORDER BY FIELD(ba.severity, 'high', 'medium', 'low'), ba.created_at DESC
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/alerts/count', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT COUNT(*) AS count FROM billing_alerts WHERE is_resolved = 0`
    );
    res.json({ count: parseInt(rows[0].count) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/alerts/:id/resolve', requireAdmin, async (req, res) => {
  const { resolved_by } = req.body;
  try {
    await db.query(`
      UPDATE billing_alerts
      SET is_resolved = 1, resolved_at = NOW(), resolved_by = ?
      WHERE alert_id = ?
    `, [resolved_by || null, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/alerts/scan', requireAdmin, async (req, res) => {
  try {
    const inserted = await scanLongAdmissions();
    res.json({ inserted, message: 'Scan complete' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────
//  GET /api/billing/medicines/catalogue
//  Returns ALL medicines for direct dispensing in billing
//  (no prescription needed — admin picks from catalogue)
// ─────────────────────────────────────────────────────────────
router.get('/medicines/catalogue', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT medicine_id, medicine_name, unit, price_per_unit,
             stock_quantity, category,
             CASE
               WHEN stock_quantity = 0             THEN 'out_of_stock'
               WHEN stock_quantity < reorder_level THEN 'critical'
               ELSE 'available'
             END AS stock_status
      FROM medicines
      WHERE stock_quantity > 0
      ORDER BY medicine_name
    `);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────
//  GET /api/billing/patient/:patient_id/unbilled-medicines
//  Medicines from existing prescriptions not yet billed
// ─────────────────────────────────────────────────────────────
router.get('/patient/:patient_id/unbilled-medicines', async (req, res) => {
  try {
    const { admission_id, appt_id } = req.query;
    let q = `
      SELECT pi.item_id, m.medicine_name, m.unit, m.price_per_unit,
             pi.quantity, pi.dosage, pi.duration_days,
             pi.quantity * m.price_per_unit AS line_total,
             ud.name AS doctor_name, pr.prescribed_date
      FROM prescriptions pr
      JOIN prescription_items pi ON pi.prescription_id = pr.prescription_id
      JOIN medicines m            ON m.medicine_id      = pi.medicine_id
      JOIN doctors   d            ON d.doctor_id        = pr.doctor_id
      JOIN users     ud           ON ud.user_id         = d.user_id
      WHERE pr.patient_id = ?
    `;
    const params = [req.params.patient_id];
    if (admission_id) { q += ' AND pr.admission_id = ?'; params.push(admission_id); }
    if (appt_id)      { q += ' AND pr.appt_id = ?';      params.push(appt_id); }
    q += ' ORDER BY pr.prescribed_date DESC';
    const { rows } = await db.query(q, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────
//  GET /api/billing/:id  — single bill with full breakdown
// ─────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const [billRes, detailRes, paymentRes] = await Promise.all([
      db.query(`
        SELECT b.*, p.name AS patient_name, p.phone,
               p.blood_group, p.address,
               u.name AS generated_by_name
        FROM bills b
        JOIN patients p ON p.patient_id = b.patient_id
        LEFT JOIN users u ON u.user_id = b.generated_by
        WHERE b.bill_id = ? ${req.user && req.user.role === 'patient' ? 'AND b.patient_id = ?' : ''}
      `, req.user && req.user.role === 'patient' ? [req.params.id, req.user.patient_id] : [req.params.id]),
      db.query(`
        SELECT bd.*,
          ROUND(bd.amount / NULLIF(b.total_amount, 0) * 100, 1) AS pct_of_total
        FROM bill_details bd
        JOIN bills b ON b.bill_id = bd.bill_id
        WHERE bd.bill_id = ?
        ORDER BY FIELD(bd.charge_type,'doctor','bed','lab','pharmacy','machinery','misc')
      `, [req.params.id]),
      db.query(`
        SELECT py.*, u.name AS received_by_name
        FROM payments py
        LEFT JOIN users u ON u.user_id = py.received_by
        WHERE py.bill_id = ?
        ORDER BY py.payment_date
      `, [req.params.id]),
    ]);

    if (!billRes.rows.length)
      return res.status(404).json({ error: 'Bill not found' });

    const bill     = billRes.rows[0];
    const details  = detailRes.rows;
    const payments = paymentRes.rows;
    const paid     = payments.reduce((s, p) => s + parseFloat(p.amount_paid), 0);
    const summary  = details.reduce((acc, row) => {
      acc[row.charge_type] = (acc[row.charge_type] || 0) + parseFloat(row.amount);
      return acc;
    }, {});
    const netAmount  = parseFloat(bill.net_amount || bill.total_amount);
    const balanceDue = Math.max(0, netAmount - paid);

    res.json({ bill, details, payments, summary, total_paid: paid, balance_due: balanceDue });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────
//  POST /api/billing/generate — ✅ Uses stored function fn_generate_bill
//  This endpoint calls the database stored function which handles:
//  - Doctor fees, bed charges via fn_bed_charge()
//  - Lab, pharmacy, machinery charges
//  - Triggers automatically update bill totals (trg_bill_detail_*)
// ─────────────────────────────────────────────────────────────
router.post('/generate', requireAdmin, async (req, res) => {
  const {
    patient_id, admission_id, appt_id, generated_by,
    selected_medicine_ids = [],
    direct_medicines = [],
    discount_amount = 0,
    discount_reason = null,
  } = req.body;

  if (!patient_id)
    return res.status(400).json({ error: 'patient_id is required' });
  if (!admission_id && !appt_id)
    return res.status(400).json({ error: 'Provide admission_id or appt_id' });

  try {
    // ✅ Call fn_generate_bill() — stored function generates complete bill
    // Returns: bill_id on success
    const { rows: [result] } = await db.query(`
      SELECT fn_generate_bill(?, ?, ?, ?) AS bill_id
    `, [patient_id, admission_id || null, appt_id || null, generated_by || null]);

    if (!result || !result.bill_id) {
      return res.status(500).json({ error: 'Failed to generate bill' });
    }

    const bill_id = result.bill_id;

    // ✅ Manually add lab orders that might not have been caught by fn_generate_bill()
    if (admission_id) {
      const { rows: missedLabs } = await db.query(`
        SELECT DISTINCT lo.order_id, lt.test_name, lt.test_price
        FROM lab_orders lo
        JOIN lab_tests lt ON lt.test_id = lo.test_id
        WHERE lo.patient_id = ?
          AND lo.order_id NOT IN (SELECT COALESCE(ref_id, -1) FROM bill_details WHERE bill_id = ? AND charge_type = 'lab')
          AND (lo.admission_id = ? OR lo.admission_id IS NULL)
        LIMIT 50
      `, [patient_id, bill_id, admission_id]);

      for (const lab of missedLabs) {
        await db.query(`
          INSERT INTO bill_details (bill_id, charge_type, description, amount, ref_id)
          VALUES (?, 'lab', ?, ?, ?)
        `, [bill_id, lab.test_name, parseFloat(lab.test_price), lab.order_id]);
      }
    }

    // ✅ Manually add prescriptions that might not have been caught by fn_generate_bill()
    let rxQuery = `
      SELECT DISTINCT pi.item_id, m.medicine_name, m.price_per_unit, pi.quantity
      FROM prescriptions pr
      JOIN prescription_items pi ON pi.prescription_id = pr.prescription_id
      JOIN medicines m ON m.medicine_id = pi.medicine_id
      WHERE pr.patient_id = ?
        AND pi.item_id NOT IN (SELECT COALESCE(ref_id, -1) FROM bill_details WHERE bill_id = ? AND charge_type = 'pharmacy')
    `;
    const rxParams = [patient_id, bill_id];
    if (admission_id) {
      rxQuery += ' AND (pr.admission_id = ? OR pr.admission_id IS NULL)';
      rxParams.push(admission_id);
    }
    if (appt_id) {
      rxQuery += ' AND (pr.appt_id = ? OR pr.appt_id IS NULL)';
      rxParams.push(appt_id);
    }
    rxQuery += ' LIMIT 100';

    const { rows: unbilledPrescriptions } = await db.query(rxQuery, rxParams);
    for (const rx of unbilledPrescriptions) {
      await db.query(`
        INSERT INTO bill_details (bill_id, charge_type, description, amount, ref_id)
        VALUES (?, 'pharmacy', ?, ?, ?)
      `, [bill_id, `${rx.medicine_name} x ${rx.quantity}`, rx.quantity * parseFloat(rx.price_per_unit), rx.item_id]);
    }

    // If the frontend selected a subset of prescription medicines, remove
    // any automatically billed pharmacy items that are not part of that selection.
    if (Array.isArray(selected_medicine_ids)) {
      if (selected_medicine_ids.length === 0) {
        await db.query(`DELETE FROM bill_details WHERE bill_id = ? AND charge_type = 'pharmacy'`, [bill_id]);
      } else {
        const placeholders = selected_medicine_ids.map(() => '?').join(',');
        await db.query(
          `DELETE FROM bill_details WHERE bill_id = ? AND charge_type = 'pharmacy' AND ref_id NOT IN (${placeholders})`,
          [bill_id, ...selected_medicine_ids]
        );
      }
    }

    // Add any direct pharmacy medicines chosen during billing generation.
    if (Array.isArray(direct_medicines) && direct_medicines.length) {
      for (const med of direct_medicines) {
        const medicineId = med.medicine_id;
        const quantity = Number(med.quantity || 0);
        if (!medicineId || quantity <= 0) continue;

        const { rows: [medicine] } = await db.query(
          `SELECT medicine_name, price_per_unit FROM medicines WHERE medicine_id = ?`,
          [medicineId]
        );
        if (!medicine) continue;

        await db.query(`
          INSERT INTO bill_details (bill_id, charge_type, description, amount, ref_id)
          VALUES (?, 'pharmacy', ?, ?, ?)
        `, [
          bill_id,
          `${medicine.medicine_name} x ${quantity}`,
          quantity * parseFloat(medicine.price_per_unit),
          null,
        ]);
      }
    }

    // Apply discount if provided
    if (discount_amount > 0) {
      await db.query(`
        UPDATE bills SET discount_amount = ?, discount_reason = ?,
          net_amount = GREATEST(total_amount - ?, 0)
        WHERE bill_id = ?
      `, [discount_amount, discount_reason, discount_amount, bill_id]);
    }

    // ✅ Triggers handle automatic bill total updates:
    // - trg_bill_detail_after_insert: Updates bill.total_amount and bill.net_amount
    // - Bed status: trg_bed_on_admission_insert (occupied)

    const { rows: [finalBill] } = await db.query(`
      SELECT b.*, p.name AS patient_name
      FROM bills b JOIN patients p ON p.patient_id = b.patient_id
      WHERE b.bill_id = ?
    `, [bill_id]);

    res.status(201).json({ bill_id, ...finalBill });
  } catch (err) {
    console.error('Bill generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  POST /api/billing/:id/charges — add manual charge
//  ✅ Triggers automatically update bill totals (trg_bill_detail_after_insert)
// ─────────────────────────────────────────────────────────────
router.post('/:id/charges', requireAdmin, async (req, res) => {
  const { charge_type, description, amount, ref_id } = req.body;
  try {
    const insert = await db.query(`
      INSERT INTO bill_details (bill_id, charge_type, description, amount, ref_id)
      VALUES (?, ?, ?, ?, ?)
    `, [req.params.id, charge_type, description, parseFloat(amount), ref_id || null]);

    // ✅ Trigger trg_bill_detail_after_insert automatically updates:
    // - bills.total_amount (SUM of all bill_details)
    // - bills.net_amount (total - discount)

    const { rows } = await db.query(
      'SELECT * FROM bill_details WHERE detail_id = ?', [insert.result.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE charge
// ✅ Trigger trg_bill_detail_after_delete automatically updates bill totals
router.delete('/:id/charges/:detail_id', requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM bill_details WHERE detail_id = ? AND bill_id = ?',
      [req.params.detail_id, req.params.id]);

    // ✅ Trigger trg_bill_detail_after_delete automatically updates:
    // - bills.total_amount
    // - bills.net_amount

    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH discount
// ✅ Manually calculates net_amount since discount update doesn't trigger bill_detail triggers
//    net_amount = total_amount - discount_amount (enforced by triggers on detail changes)
router.patch('/:id/discount', requireAdmin, async (req, res) => {
  const { discount_amount, discount_reason } = req.body;
  try {
    await db.query(`
      UPDATE bills SET discount_amount = ?, discount_reason = ?,
        net_amount = GREATEST(total_amount - ?, 0)
      WHERE bill_id = ?
    `, [discount_amount, discount_reason || null, discount_amount, req.params.id]);
    const { rows } = await db.query('SELECT * FROM bills WHERE bill_id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH status
router.patch('/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  try {
    await db.query('UPDATE bills SET status = ? WHERE bill_id = ?', [status, req.params.id]);
    const { rows } = await db.query('SELECT * FROM bills WHERE bill_id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─────────────────────────────────────────────────────────────
//  ALERT ENGINE
// ─────────────────────────────────────────────────────────────
async function runBillingAlerts(bill_id, patient_id, admission_id, appt_id) {
  try {
    const { rows: highRows } = await db.query(`
      SELECT bd.description, bd.charge_type, bd.amount, av.avg_amount
      FROM bill_details bd
      JOIN (SELECT charge_type, AVG(amount) AS avg_amount FROM bill_details GROUP BY charge_type) av
        ON av.charge_type = bd.charge_type
      WHERE bd.bill_id = ? AND bd.amount > av.avg_amount * 2 AND av.avg_amount > 0
    `, [bill_id]);
    for (const r of highRows) {
      await db.query(`INSERT INTO billing_alerts (patient_id, bill_id, alert_type, severity, message)
        VALUES (?, ?, 'high_charge', 'high', ?)`,
        [patient_id, bill_id,
         `Charge "${r.description}" (₹${r.amount}) is 2× above average (₹${Math.round(r.avg_amount)}) for ${r.charge_type}.`]);
    }

    let rxQ = `SELECT m.medicine_name FROM prescriptions pr
      JOIN prescription_items pi ON pi.prescription_id = pr.prescription_id
      JOIN medicines m ON m.medicine_id = pi.medicine_id
      WHERE pr.patient_id = ?
        AND pi.item_id NOT IN (SELECT COALESCE(ref_id,-1) FROM bill_details WHERE bill_id = ? AND charge_type='pharmacy')`;
    const rxP = [patient_id, bill_id];
    if (admission_id) { rxQ += ' AND pr.admission_id = ?'; rxP.push(admission_id); }
    if (appt_id)      { rxQ += ' AND pr.appt_id = ?';      rxP.push(appt_id); }
    const { rows: missingRx } = await db.query(rxQ, rxP);
    if (missingRx.length) {
      await db.query(`INSERT INTO billing_alerts (patient_id, bill_id, alert_type, severity, message) VALUES (?,?,'missing_pharmacy','medium',?)`,
        [patient_id, bill_id,
         `${missingRx.length} prescribed medicine(s) not billed: ${missingRx.map(r=>r.medicine_name).join(', ')}.`]);
    }

    const { rows: dupRows } = await db.query(`
      SELECT charge_type, COUNT(*) AS cnt FROM bill_details
      WHERE bill_id = ? AND charge_type IN ('doctor','bed')
      GROUP BY charge_type HAVING cnt > 1
    `, [bill_id]);
    for (const r of dupRows) {
      await db.query(`INSERT INTO billing_alerts (patient_id, bill_id, alert_type, severity, message) VALUES (?,?,'duplicate_charge','high',?)`,
        [patient_id, bill_id, `"${r.charge_type}" charge appears ${r.cnt} times in bill #${bill_id}.`]);
    }
  } catch (err) { console.error('Alert engine (non-fatal):', err.message); }
}

async function scanLongAdmissions() {
  let inserted = 0;
  try {
    const { rows } = await db.query(`
      SELECT a.patient_id, p.name AS patient_name, DATEDIFF(NOW(), a.admit_date) AS days
      FROM admissions a JOIN patients p ON p.patient_id = a.patient_id
      WHERE a.status = 'admitted' AND DATEDIFF(NOW(), a.admit_date) >= 7
        AND a.patient_id NOT IN (SELECT patient_id FROM bills WHERE admission_id = a.admission_id)
    `);
    for (const r of rows) {
      const { rows: ex } = await db.query(
        `SELECT alert_id FROM billing_alerts WHERE patient_id = ? AND alert_type = 'long_admission' AND is_resolved = 0 LIMIT 1`,
        [r.patient_id]
      );
      if (!ex.length) {
        await db.query(`INSERT INTO billing_alerts (patient_id, alert_type, severity, message) VALUES (?, 'long_admission', 'high', ?)`,
          [r.patient_id, `${r.patient_name} admitted for ${r.days} days with no bill generated.`]);
        inserted++;
      }
    }
  } catch (err) { console.error('Scan error:', err.message); }
  return inserted;
}

module.exports = router;
