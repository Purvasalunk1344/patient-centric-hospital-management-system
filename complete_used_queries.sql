-- ─────────────────────────────────────────────────────────────
--  WORKBENCH ONLY FILE - Hospital Project
--  Run this file in MySQL Workbench
--  Includes: Functions + Triggers + Views ONLY
--  DO NOT include backend queries (those have ? placeholders
--  and are handled automatically by Node.js)
-- ─────────────────────────────────────────────────────────────

USE hospital_db;  -- ← Change this to your actual database name

-- ─────────────────────────────────────────────────────────────
--  STEP 1: DROP OLD TRIGGERS (to avoid duplicate trigger error)
-- ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_bill_detail_after_insert;
DROP TRIGGER IF EXISTS trg_bill_detail_after_update;
DROP TRIGGER IF EXISTS trg_bill_detail_after_delete;
DROP TRIGGER IF EXISTS trg_payment_status_after_insert;
DROP TRIGGER IF EXISTS trg_payment_status_after_update;
DROP TRIGGER IF EXISTS trg_bed_on_admission_insert;
DROP TRIGGER IF EXISTS trg_bed_on_admission_update;
DROP TRIGGER IF EXISTS trg_stock_deduct;

-- ─────────────────────────────────────────────────────────────
--  STEP 2: DROP OLD VIEWS
-- ─────────────────────────────────────────────────────────────

DROP VIEW IF EXISTS v_bill_transparent;
DROP VIEW IF EXISTS v_outstanding_bills;
DROP VIEW IF EXISTS v_current_admissions;
DROP VIEW IF EXISTS v_low_stock_medicines;

-- ─────────────────────────────────────────────────────────────
--  STEP 3: STORED FUNCTIONS (2 total)
-- ─────────────────────────────────────────────────────────────

-- FUNCTION 1: Calculate bed charge for an admission
DELIMITER $$
DROP FUNCTION IF EXISTS fn_bed_charge$$
CREATE FUNCTION fn_bed_charge(p_admission_id INT)
RETURNS DECIMAL(10,2)
DETERMINISTIC
READS SQL DATA
BEGIN
    DECLARE v_days INT DEFAULT 0;
    DECLARE v_rate DECIMAL(10,2) DEFAULT 0;
    DECLARE v_discharge DATETIME;
    DECLARE v_admit DATETIME;

    SELECT a.discharge_date, w.daily_rate, a.admit_date
    INTO v_discharge, v_rate, v_admit
    FROM admissions a
    JOIN beds b ON b.bed_id = a.bed_id
    JOIN wards w ON w.ward_id = b.ward_id
    WHERE a.admission_id = p_admission_id
    LIMIT 1;

    SET v_days = CEIL(
        TIMESTAMPDIFF(SECOND, v_admit, COALESCE(v_discharge, NOW())) / 86400.0
    );
    IF v_days < 1 THEN
        SET v_days = 1;
    END IF;

    RETURN GREATEST(v_days, 1) * v_rate;
END$$
DELIMITER ;

-- FUNCTION 2: Generate complete bill for a patient visit
DELIMITER $$
DROP FUNCTION IF EXISTS fn_generate_bill$$
CREATE FUNCTION fn_generate_bill(
    p_patient_id INT,
    p_admission_id INT,
    p_appt_id INT,
    p_generated_by INT
)
RETURNS INT
DETERMINISTIC
MODIFIES SQL DATA
BEGIN
    DECLARE v_bill_id INT DEFAULT 0;
    DECLARE v_doctor_fee DECIMAL(10,2) DEFAULT 0;
    DECLARE v_bed_charge DECIMAL(10,2) DEFAULT 0;

    INSERT INTO bills (patient_id, admission_id, appt_id, bill_date, status, generated_by)
    VALUES (p_patient_id, p_admission_id, p_appt_id, CURRENT_DATE, 'generated', p_generated_by);
    SET v_bill_id = LAST_INSERT_ID();

    IF p_appt_id IS NOT NULL THEN
        SELECT dr.consultation_fee INTO v_doctor_fee
        FROM appointments a
        JOIN doctors dr ON dr.doctor_id = a.doctor_id
        WHERE a.appt_id = p_appt_id
        LIMIT 1;
        IF v_doctor_fee IS NOT NULL THEN
            INSERT INTO bill_details (bill_id, charge_type, description, amount, ref_id)
            VALUES (v_bill_id, 'doctor', 'Consultation fee', v_doctor_fee, p_appt_id);
        END IF;
    END IF;

    IF p_admission_id IS NOT NULL THEN
        SET v_bed_charge = fn_bed_charge(p_admission_id);
        INSERT INTO bill_details (bill_id, charge_type, description, amount, ref_id)
        VALUES (v_bill_id, 'bed', 'Ward / bed charges', v_bed_charge, p_admission_id);
    END IF;

    INSERT INTO bill_details (bill_id, charge_type, description, amount, ref_id)
    SELECT v_bill_id, 'lab', lt.test_name, lt.test_price, lo.order_id
    FROM lab_orders lo
    JOIN lab_tests lt ON lt.test_id = lo.test_id
    WHERE lo.patient_id = p_patient_id
      AND (p_admission_id IS NULL OR lo.admission_id = p_admission_id)
      AND (p_appt_id IS NULL OR lo.appt_id = p_appt_id);

    INSERT INTO bill_details (bill_id, charge_type, description, amount, ref_id)
    SELECT v_bill_id, 'pharmacy', CONCAT(m.medicine_name, ' x ', pi.quantity), pi.quantity * m.price_per_unit, pi.item_id
    FROM prescriptions pr
    JOIN prescription_items pi ON pi.prescription_id = pr.prescription_id
    JOIN medicines m ON m.medicine_id = pi.medicine_id
    WHERE pr.patient_id = p_patient_id
      AND (p_admission_id IS NULL OR pr.admission_id = p_admission_id)
      AND (p_appt_id IS NULL OR pr.appt_id = p_appt_id);

    INSERT INTO bill_details (bill_id, charge_type, description, amount, ref_id)
    SELECT v_bill_id, 'machinery', ma.machine_name, mu.amount_charged, mu.usage_id
    FROM machinery_usage mu
    JOIN machinery ma ON ma.machine_id = mu.machine_id
    WHERE mu.patient_id = p_patient_id
      AND (p_admission_id IS NULL OR mu.admission_id = p_admission_id);

    UPDATE bills
    SET total_amount = IFNULL((SELECT SUM(amount) FROM bill_details WHERE bill_id = v_bill_id),0)
    WHERE bill_id = v_bill_id;

    RETURN v_bill_id;
END$$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────
--  STEP 4: TRIGGERS (8 total)
-- ─────────────────────────────────────────────────────────────

-- TRIGGER 1: Auto-update bill total when bill_details changes (INSERT)
DELIMITER $$
CREATE TRIGGER trg_bill_detail_after_insert
AFTER INSERT ON bill_details
FOR EACH ROW
BEGIN
    UPDATE bills
    SET total_amount = IFNULL((SELECT SUM(amount) FROM bill_details WHERE bill_id = NEW.bill_id),0),
        net_amount = GREATEST(
            IFNULL((SELECT SUM(amount) FROM bill_details WHERE bill_id = NEW.bill_id),0)
            - COALESCE(discount_amount,0), 0)
    WHERE bill_id = NEW.bill_id;
END$$
DELIMITER ;

-- TRIGGER 2: Auto-update bill total when bill_details changes (UPDATE)
DELIMITER $$
CREATE TRIGGER trg_bill_detail_after_update
AFTER UPDATE ON bill_details
FOR EACH ROW
BEGIN
    UPDATE bills
    SET total_amount = IFNULL((SELECT SUM(amount) FROM bill_details WHERE bill_id = NEW.bill_id),0),
        net_amount = GREATEST(
            IFNULL((SELECT SUM(amount) FROM bill_details WHERE bill_id = NEW.bill_id),0)
            - COALESCE(discount_amount,0), 0)
    WHERE bill_id = NEW.bill_id;
END$$
DELIMITER ;

-- TRIGGER 3: Auto-update bill total when bill_details changes (DELETE)
DELIMITER $$
CREATE TRIGGER trg_bill_detail_after_delete
AFTER DELETE ON bill_details
FOR EACH ROW
BEGIN
    UPDATE bills
    SET total_amount = IFNULL((SELECT SUM(amount) FROM bill_details WHERE bill_id = OLD.bill_id),0),
        net_amount = GREATEST(
            IFNULL((SELECT SUM(amount) FROM bill_details WHERE bill_id = OLD.bill_id),0)
            - COALESCE(discount_amount,0), 0)
    WHERE bill_id = OLD.bill_id;
END$$
DELIMITER ;

-- TRIGGER 4: Mark bed as occupied on admission
DELIMITER $$
CREATE TRIGGER trg_bed_on_admission_insert
AFTER INSERT ON admissions
FOR EACH ROW
BEGIN
    UPDATE beds SET status = 'occupied' WHERE bed_id = NEW.bed_id;
END$$
DELIMITER ;

-- TRIGGER 5: Mark bed as available on discharge
DELIMITER $$
CREATE TRIGGER trg_bed_on_admission_update
AFTER UPDATE ON admissions
FOR EACH ROW
BEGIN
    IF NEW.status = 'discharged' THEN
        UPDATE beds SET status = 'available' WHERE bed_id = NEW.bed_id;
    END IF;
END$$
DELIMITER ;

-- TRIGGER 6: Auto-update bill status based on payments (INSERT)
DELIMITER $$
CREATE TRIGGER trg_payment_status_after_insert
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
    DECLARE v_net DECIMAL(12,2);
    DECLARE v_paid DECIMAL(12,2);
    SELECT net_amount INTO v_net FROM bills WHERE bill_id = NEW.bill_id LIMIT 1;
    SELECT IFNULL(SUM(amount_paid),0) INTO v_paid FROM payments WHERE bill_id = NEW.bill_id;
    UPDATE bills
    SET status = CASE
        WHEN v_paid >= v_net THEN 'paid'
        WHEN v_paid > 0 THEN 'partially_paid'
        ELSE 'generated'
    END
    WHERE bill_id = NEW.bill_id;
END$$
DELIMITER ;

-- TRIGGER 7: Auto-update bill status based on payments (UPDATE)
DELIMITER $$
CREATE TRIGGER trg_payment_status_after_update
AFTER UPDATE ON payments
FOR EACH ROW
BEGIN
    DECLARE v_net DECIMAL(12,2);
    DECLARE v_paid DECIMAL(12,2);
    SELECT net_amount INTO v_net FROM bills WHERE bill_id = NEW.bill_id LIMIT 1;
    SELECT IFNULL(SUM(amount_paid),0) INTO v_paid FROM payments WHERE bill_id = NEW.bill_id;
    UPDATE bills
    SET status = CASE
        WHEN v_paid >= v_net THEN 'paid'
        WHEN v_paid > 0 THEN 'partially_paid'
        ELSE 'generated'
    END
    WHERE bill_id = NEW.bill_id;
END$$
DELIMITER ;

-- TRIGGER 8: Reduce medicine stock when prescription item is added
DELIMITER $$
CREATE TRIGGER trg_stock_deduct
AFTER INSERT ON prescription_items
FOR EACH ROW
BEGIN
    UPDATE medicines
    SET stock_quantity = stock_quantity - NEW.quantity
    WHERE medicine_id = NEW.medicine_id;

    IF (SELECT stock_quantity FROM medicines WHERE medicine_id = NEW.medicine_id) < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient stock for medicine_id';
    END IF;
END$$
DELIMITER ;

-- ─────────────────────────────────────────────────────────────
--  STEP 5: VIEWS (4 total)
-- ─────────────────────────────────────────────────────────────

-- VIEW 1: Transparent bill view (patient sees every charge)
CREATE VIEW v_bill_transparent AS
SELECT
    b.bill_id,
    p.name          AS patient_name,
    p.phone,
    b.bill_date,
    bd.charge_type,
    bd.description,
    bd.amount,
    b.total_amount  AS bill_total,
    b.status        AS bill_status
FROM bills b
JOIN patients    p  ON p.patient_id = b.patient_id
JOIN bill_details bd ON bd.bill_id  = b.bill_id
ORDER BY b.bill_id, bd.charge_type;

-- VIEW 2: Outstanding bills (unpaid / partial)
CREATE VIEW v_outstanding_bills AS
SELECT
    b.bill_id,
    p.name                                           AS patient_name,
    b.total_amount,
    COALESCE(SUM(py.amount_paid), 0)                 AS amount_paid,
    b.total_amount - COALESCE(SUM(py.amount_paid),0) AS balance_due,
    b.status
FROM bills b
JOIN patients p ON p.patient_id = b.patient_id
LEFT JOIN payments py ON py.bill_id = b.bill_id
WHERE b.status IN ('generated','partially_paid')
GROUP BY b.bill_id, p.name, b.total_amount, b.status;

-- VIEW 3: Currently admitted patients
CREATE VIEW v_current_admissions AS
SELECT
    a.admission_id,
    p.name          AS patient_name,
    d.name          AS doctor_name,
    w.ward_name,
    bd.bed_number,
    a.admit_date,
    DATEDIFF(CURRENT_DATE, DATE(a.admit_date)) AS days_admitted
FROM admissions a
JOIN patients   p  ON p.patient_id = a.patient_id
JOIN doctors    dr ON dr.doctor_id = a.doctor_id
JOIN users      d  ON d.user_id    = dr.user_id
JOIN beds       bd ON bd.bed_id    = a.bed_id
JOIN wards      w  ON w.ward_id    = bd.ward_id
WHERE a.status = 'admitted';

-- VIEW 4: Medicine stock alert view
CREATE VIEW v_low_stock_medicines AS
SELECT
    medicine_id,
    medicine_name,
    stock_quantity,
    reorder_level,
    (reorder_level - stock_quantity) AS shortage
FROM medicines
WHERE stock_quantity <= reorder_level
ORDER BY shortage DESC;

-- ─────────────────────────────────────────────────────────────
--  DONE! All functions, triggers, and views created successfully.
--  Your Node.js backend handles all the remaining queries automatically.
-- ─────────────────────────────────────────────────────────────