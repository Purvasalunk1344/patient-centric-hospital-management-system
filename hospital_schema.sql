-- ============================================================
--  Patient-Centric Transparent Hospital Management System
--  Database : MySQL
--  File     : hospital_schema.sql
--  Covers   : ENUM columns, all 18 tables, constraints,
--             indexes, views, triggers, functions
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
DROP DATABASE IF EXISTS hospital_db;
CREATE DATABASE hospital_db;
USE hospital_db;

-- ─────────────────────────────────────────────────────────────
--  1.  TABLES
-- ─────────────────────────────────────────────────────────────

-- 2.1  USERS  (auth layer – supports role-based access)
CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100)    NOT NULL,
    email         VARCHAR(150)    NOT NULL UNIQUE,
    password_hash TEXT            NOT NULL,
    role          ENUM('patient','admin') NOT NULL DEFAULT 'patient',
    is_active     BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2.2  DEPARTMENTS
CREATE TABLE departments (
    dept_id     INT AUTO_INCREMENT PRIMARY KEY,
    dept_name   VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    head_doctor INT                          -- FK added after doctors table
);

-- 2.3  DOCTORS
CREATE TABLE doctors (
    doctor_id        INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT             NOT NULL,
    dept_id          INT             NOT NULL,
    specialization   VARCHAR(100)    NOT NULL,
    consultation_fee DECIMAL(10,2)   NOT NULL CHECK (consultation_fee >= 0),
    available_days   TEXT,           -- e.g. 'Mon,Tue,Wed'
    qualification    VARCHAR(200),
    experience_years INT             CHECK (experience_years >= 0),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

-- back-fill FK on departments
ALTER TABLE departments
    ADD CONSTRAINT fk_dept_head FOREIGN KEY (head_doctor)
    REFERENCES doctors(doctor_id) ON DELETE SET NULL;

-- 2.4  PATIENTS
CREATE TABLE patients (
    patient_id  INT AUTO_INCREMENT PRIMARY KEY,
    user_id     INT,
    name        VARCHAR(100) NOT NULL,          -- kept denormalised for walk-ins (no user account)
    phone       VARCHAR(15)  NOT NULL,
    dob         DATE,
    gender      ENUM('male','female','other'),
    blood_group VARCHAR(5),
    address     TEXT,
    emergency_contact VARCHAR(15),
    created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL
);

-- 2.5  WARDS
CREATE TABLE wards (
    ward_id    INT AUTO_INCREMENT PRIMARY KEY,
    ward_name  VARCHAR(100)    NOT NULL,
    ward_type  ENUM('general','icu','private','semi_private','emergency') NOT NULL,
    daily_rate DECIMAL(10,2)   NOT NULL CHECK (daily_rate >= 0),
    total_beds INT             NOT NULL CHECK (total_beds > 0),
    dept_id    INT,
    FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

-- 2.6  BEDS
CREATE TABLE beds (
    bed_id     INT AUTO_INCREMENT PRIMARY KEY,
    ward_id    INT         NOT NULL,
    bed_number VARCHAR(10) NOT NULL,
    status     ENUM('available','occupied','maintenance') NOT NULL DEFAULT 'available',
    UNIQUE (ward_id, bed_number),
    FOREIGN KEY (ward_id) REFERENCES wards(ward_id)
);

-- 2.7  APPOINTMENTS
CREATE TABLE appointments (
    appt_id    INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT          NOT NULL,
    doctor_id  INT          NOT NULL,
    appt_date  DATE         NOT NULL,
    appt_time  TIME         NOT NULL,
    status     ENUM('scheduled','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
    token_no   INT,
    notes      TEXT,
    created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
);

-- 2.8  ADMISSIONS
CREATE TABLE admissions (
    admission_id   INT AUTO_INCREMENT PRIMARY KEY,
    patient_id     INT              NOT NULL,
    doctor_id      INT              NOT NULL,
    bed_id         INT              NOT NULL,
    admit_date     TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    discharge_date TIMESTAMP,                             -- NULL until discharged
    reason         TEXT             NOT NULL,
    status         ENUM('admitted','discharged','transferred') NOT NULL DEFAULT 'admitted',
    notes          TEXT,
    CONSTRAINT chk_discharge CHECK (
        discharge_date IS NULL OR discharge_date > admit_date
    ),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    FOREIGN KEY (bed_id) REFERENCES beds(bed_id)
);

-- 2.9  LAB TESTS  (master catalogue)
CREATE TABLE lab_tests (
    test_id     INT AUTO_INCREMENT PRIMARY KEY,
    test_name   VARCHAR(150)    NOT NULL UNIQUE,
    test_price  DECIMAL(10,2)   NOT NULL CHECK (test_price >= 0),
    description TEXT,
    dept_id     INT,
    turnaround_hours INT        CHECK (turnaround_hours > 0),
    FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

-- 2.10  LAB ORDERS
CREATE TABLE lab_orders (
    order_id       INT AUTO_INCREMENT PRIMARY KEY,
    patient_id     INT         NOT NULL,
    doctor_id      INT         NOT NULL,
    test_id        INT         NOT NULL,
    appt_id        INT,
    admission_id   INT,
    prescription_id INT,
    ordered_date   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    result         TEXT,
    result_date    DATE,
    status         ENUM('pending','processing','completed','cancelled') NOT NULL DEFAULT 'pending',
    remarks        TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    FOREIGN KEY (test_id) REFERENCES lab_tests(test_id),
    FOREIGN KEY (appt_id) REFERENCES appointments(appt_id),
    FOREIGN KEY (admission_id) REFERENCES admissions(admission_id),
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id) ON DELETE CASCADE
);

-- 2.11  MEDICINES  (pharmacy catalogue)
CREATE TABLE medicines (
    medicine_id    INT AUTO_INCREMENT PRIMARY KEY,
    medicine_name  VARCHAR(150)    NOT NULL,
    category       VARCHAR(80),
    unit           VARCHAR(20)     NOT NULL,   -- tablet, ml, mg
    price_per_unit DECIMAL(10,2)   NOT NULL CHECK (price_per_unit >= 0),
    stock_quantity INT             NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    reorder_level  INT             NOT NULL DEFAULT 10,
    manufacturer   VARCHAR(150)
);

-- 2.12  PRESCRIPTIONS
CREATE TABLE prescriptions (
    prescription_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id      INT         NOT NULL,
    doctor_id       INT         NOT NULL,
    appt_id         INT,
    admission_id    INT,
    prescribed_date TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes           TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id),
    FOREIGN KEY (appt_id) REFERENCES appointments(appt_id),
    FOREIGN KEY (admission_id) REFERENCES admissions(admission_id)
);

-- 2.13  PRESCRIPTION ITEMS  (junction: prescription ↔ medicines)
CREATE TABLE prescription_items (
    item_id         INT AUTO_INCREMENT PRIMARY KEY,
    prescription_id INT          NOT NULL,
    medicine_id     INT          NOT NULL,
    quantity        INT          NOT NULL CHECK (quantity > 0),
    dosage          VARCHAR(80)  NOT NULL,   -- e.g. '1 tablet twice daily'
    duration_days   INT          CHECK (duration_days > 0),
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id) ON DELETE CASCADE,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id)
);

-- 2.14  MACHINERY
CREATE TABLE machinery (
    machine_id   INT AUTO_INCREMENT PRIMARY KEY,
    machine_name VARCHAR(150)    NOT NULL,
    dept_id      INT,
    usage_rate   DECIMAL(10,2)   NOT NULL CHECK (usage_rate >= 0),  -- per minute
    description  TEXT,
    is_active    BOOLEAN         NOT NULL DEFAULT TRUE,
    FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
);

-- 2.15  MACHINERY USAGE
CREATE TABLE machinery_usage (
    usage_id       INT AUTO_INCREMENT PRIMARY KEY,
    patient_id     INT             NOT NULL,
    machine_id     INT             NOT NULL,
    admission_id   INT,
    usage_date     DATE            NOT NULL,
    duration_mins  INT             NOT NULL CHECK (duration_mins > 0),
    amount_charged DECIMAL(10,2)   NOT NULL,
    operated_by    INT,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (machine_id) REFERENCES machinery(machine_id),
    FOREIGN KEY (admission_id) REFERENCES admissions(admission_id),
    FOREIGN KEY (operated_by) REFERENCES users(user_id)
);

-- 2.16  BILLS  (one bill per visit/admission)
CREATE TABLE bills (
    bill_id      INT AUTO_INCREMENT PRIMARY KEY,
    patient_id   INT          NOT NULL,
    admission_id INT,
    appt_id      INT,
    bill_date    DATE         NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_reason VARCHAR(200) DEFAULT NULL,
    net_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
    status       ENUM('draft','generated','partially_paid','paid','cancelled') NOT NULL DEFAULT 'draft',
    generated_by INT,
    notes        TEXT,
    CONSTRAINT chk_bill_source CHECK (
        admission_id IS NOT NULL OR appt_id IS NOT NULL
    ),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (admission_id) REFERENCES admissions(admission_id),
    FOREIGN KEY (appt_id) REFERENCES appointments(appt_id),
    FOREIGN KEY (generated_by) REFERENCES users(user_id)
);

-- 2.17  BILL DETAILS  (itemized charges — THE transparency table)
CREATE TABLE bill_details (
    detail_id   INT AUTO_INCREMENT PRIMARY KEY,
    bill_id     INT             NOT NULL,
    charge_type ENUM('doctor','lab','bed','pharmacy','machinery','misc') NOT NULL,
    description VARCHAR(200)    NOT NULL,
    amount      DECIMAL(10,2)   NOT NULL CHECK (amount >= 0),
    ref_id      INT,             -- references the source row (lab_order_id, machine_usage_id, etc.)
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bill_id) REFERENCES bills(bill_id) ON DELETE CASCADE
);

-- 2.18  PAYMENTS
CREATE TABLE payments (
    payment_id      INT AUTO_INCREMENT PRIMARY KEY,
    bill_id         INT             NOT NULL,
    amount_paid     DECIMAL(12,2)   NOT NULL CHECK (amount_paid > 0),
    payment_date    DATE            NOT NULL,
    payment_method  ENUM('cash','card','upi','insurance','netbanking') NOT NULL,
    transaction_ref VARCHAR(100),
    received_by     INT,
    notes           TEXT,
    FOREIGN KEY (bill_id) REFERENCES bills(bill_id),
    FOREIGN KEY (received_by) REFERENCES users(user_id)
);

-- 2.19  BILLING ALERTS
CREATE TABLE billing_alerts (
    alert_id    INT AUTO_INCREMENT PRIMARY KEY,
    patient_id  INT NOT NULL,
    bill_id     INT DEFAULT NULL,
    alert_type  ENUM(
                  'high_charge', 'missing_pharmacy', 'pending_lab',
                  'long_admission', 'overpayment_risk', 'duplicate_charge'
                ) NOT NULL,
    severity    ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
    message     TEXT NOT NULL,
    is_resolved TINYINT(1) NOT NULL DEFAULT 0,
    created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL DEFAULT NULL,
    resolved_by INT DEFAULT NULL,
    FOREIGN KEY (patient_id)  REFERENCES patients(patient_id)  ON DELETE CASCADE,
    FOREIGN KEY (bill_id)     REFERENCES bills(bill_id)        ON DELETE SET NULL,
    FOREIGN KEY (resolved_by) REFERENCES users(user_id)        ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────
--  3.  INDEXES  (performance)
-- ─────────────────────────────────────────────────────────────
CREATE INDEX idx_appointments_patient  ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor   ON appointments(doctor_id);
CREATE INDEX idx_appointments_date     ON appointments(appt_date);
CREATE INDEX idx_admissions_patient    ON admissions(patient_id);
CREATE INDEX idx_admissions_status     ON admissions(status);
CREATE INDEX idx_lab_orders_patient    ON lab_orders(patient_id);
CREATE INDEX idx_lab_orders_status     ON lab_orders(status);
CREATE INDEX idx_lab_orders_prescription ON lab_orders(prescription_id);
CREATE INDEX idx_bill_details_bill     ON bill_details(bill_id);
CREATE INDEX idx_bill_details_type     ON bill_details(charge_type);
CREATE INDEX idx_billing_alerts_patient ON billing_alerts(patient_id);
CREATE INDEX idx_billing_alerts_resolved ON billing_alerts(is_resolved);
CREATE INDEX idx_payments_bill         ON payments(bill_id);
CREATE INDEX idx_beds_status           ON beds(status);
CREATE INDEX idx_medicines_stock       ON medicines(stock_quantity);

SET FOREIGN_KEY_CHECKS = 1;
(7, 4, 'Orthopaedic Surg', 700.00, 'MS Orthopaedics',  15);

-- Update dept heads
UPDATE departments SET head_doctor = 1 WHERE dept_id = 1;
UPDATE departments SET head_doctor = 2 WHERE dept_id = 2;

-- Patients
INSERT INTO patients (user_id, name, phone, dob, gender, blood_group, address) VALUES
(4, 'Anil Sharma',  '9876543210', '1985-04-12', 'male',   'B+', 'Pune, MH'),
(5, 'Sunita Patil', '9123456780', '1992-09-25', 'female', 'O+', 'Nashik, MH'),
(NULL,'Ramesh Joshi','9000011111','1978-01-30', 'male',   'A+', 'Mumbai, MH');

-- Wards
INSERT INTO wards (ward_name, ward_type, daily_rate, total_beds, dept_id) VALUES
('ICU Ward A',        'icu',        4500.00, 10, 1),
('General Ward B',    'general',    1200.00, 30, 5),
('Private Room C',    'private',    3000.00, 20, NULL),
('Emergency Ward',    'emergency',  2000.00, 15, NULL);

-- Beds
INSERT INTO beds (ward_id, bed_number, status) VALUES
(1,'ICU-01','occupied'), (1,'ICU-02','available'),
(2,'GEN-01','occupied'), (2,'GEN-02','available'), (2,'GEN-03','available'),
(3,'PVT-01','available'),(3,'PVT-02','occupied'),
(4,'EMG-01','available');

-- Appointments
INSERT INTO appointments (patient_id, doctor_id, appt_date, appt_time, status, token_no) VALUES
(1, 1, CURRENT_DATE,       '10:00', 'completed', 5),
(2, 2, CURRENT_DATE,       '11:30', 'scheduled', 8),
(1, 3, CURRENT_DATE - INTERVAL 2 DAY,  '09:00', 'completed', 2),
(3, 1, CURRENT_DATE - INTERVAL 1 DAY,  '14:00', 'completed', 3);

-- Admissions
INSERT INTO admissions (patient_id, doctor_id, bed_id, admit_date, reason, status) VALUES
(1, 1, 1, NOW() - INTERVAL 3 DAY, 'Chest pain evaluation',  'admitted'),
(3, 2, 3, NOW() - INTERVAL 5 DAY, 'Severe headache & MRI',  'admitted');

-- Lab Tests
INSERT INTO lab_tests (test_name, test_price, dept_id, turnaround_hours) VALUES
('Complete Blood Count (CBC)',   350.00, 3, 4),
('Lipid Profile',                500.00, 3, 6),
('MRI Brain',                   4500.00, 2, 24),
('ECG',                          250.00, 1, 1),
('Blood Sugar Fasting',          120.00, 3, 3),
('X-Ray Knee',                   400.00, 4, 2);

-- Lab Orders
INSERT INTO lab_orders (patient_id, doctor_id, test_id, appt_id, admission_id, prescription_id, status) VALUES
(1, 1, 4, 1, 1, NULL, 'completed'),   -- ECG for Anil (admission)
(1, 1, 2, 1, 1, NULL, 'completed'),   -- Lipid Profile
(3, 2, 3, NULL, 2, NULL, 'processing'),-- MRI Brain for Ramesh
(2, 2, 1, 2, NULL, NULL,'pending');    -- CBC for Sunita (outpatient)

-- Medicines
INSERT INTO medicines (medicine_name, category, unit, price_per_unit, stock_quantity, reorder_level) VALUES
('Aspirin 75mg',        'Antiplatelet',  'tablet', 2.50,  500, 100),
('Atorvastatin 10mg',   'Statin',        'tablet', 8.00,  300, 50),
('Paracetamol 500mg',   'Analgesic',     'tablet', 1.50,  800, 200),
('Omeprazole 20mg',     'PPI',           'capsule',5.00,  400, 80),
('Amoxicillin 500mg',   'Antibiotic',    'capsule',12.00, 250, 60),
('Normal Saline 500ml', 'IV Fluid',      'bottle', 45.00, 100, 20);

-- Prescriptions
INSERT INTO prescriptions (patient_id, doctor_id, appt_id, admission_id, notes) VALUES
(1, 1, 1, 1, 'Take after meals'),
(3, 2, NULL, 2, 'Monitor BP daily');

-- Prescription Items (triggers stock deduction)
INSERT INTO prescription_items (prescription_id, medicine_id, quantity, dosage, duration_days) VALUES
(1, 1, 30, '1 tablet once daily', 30),
(1, 2, 30, '1 tablet at night',   30),
(1, 4, 14, '1 capsule before food', 14),
(2, 3, 20, '1 tablet SOS for headache', 5),
(2, 6,  2, '500ml IV over 4 hours', 2);

-- Machinery
INSERT INTO machinery (machine_name, dept_id, usage_rate, description) VALUES
('Ventilator V1',       1, 150.00, 'ICU ventilator per 30 min'),
('ECG Machine',         1,  80.00, 'Electrocardiogram per use'),
('MRI Scanner',         2, 300.00, 'Magnetic resonance imaging per 30 min'),
('Dialysis Machine',    NULL,200.00,'Kidney dialysis per session'),
('Pulse Oximeter',      NULL, 20.00,'Continuous monitoring per day');

-- Machinery Usage
INSERT INTO machinery_usage (patient_id, machine_id, admission_id, usage_date, duration_mins, amount_charged, operated_by) VALUES
(1, 2, 1, CURRENT_DATE - INTERVAL 2 DAY, 15,  80.00, 6),
(3, 3, 2, CURRENT_DATE - INTERVAL 4 DAY, 60, 600.00, 6),
(1, 5, 1, CURRENT_DATE - INTERVAL 2 DAY,  1,  20.00, 6);

-- ─────────────────────────────────────────────────────────────
--  END OF SCHEMA FILE
-- ─────────────────────────────────────────────────────────────
SELECT * FROM doctors;

-- apoitnment
SELECT a.*, p.name AS patient_name, p.phone,
       u.name AS doctor_name, dept.dept_name,
       d.consultation_fee
FROM appointments a
JOIN patients p ON p.patient_id = a.patient_id
JOIN doctors d ON d.doctor_id = a.doctor_id
JOIN users u ON u.user_id = d.user_id
JOIN departments dept ON dept.dept_id = d.dept_id
WHERE 1=1;

-- all pateint 
SELECT p.patient_id, p.name, p.phone, p.dob, p.gender,
       p.blood_group, p.address, p.emergency_contact,
       p.created_at, u.email
FROM patients p
LEFT JOIN users u ON u.user_id = p.user_id
ORDER BY p.patient_id DESC;

-- specific pateint
SELECT p.*, u.email, u.role, u.created_at AS registered_on
FROM patients p
LEFT JOIN users u ON u.user_id = p.user_id
WHERE p.patient_id = 1;


-- Appointments History
SELECT a.*, u.name AS doctor_name, d.dept_id,
       dept.dept_name
FROM appointments a
JOIN doctors d ON d.doctor_id = a.doctor_id
JOIN users u ON u.user_id = d.user_id
JOIN departments dept ON dept.dept_id = d.dept_id
WHERE a.patient_id = 1
ORDER BY a.appt_date DESC;


-- admission details specific pateint
SELECT a.*, u.name AS doctor_name, b.bed_number, w.ward_name
FROM admissions a
JOIN doctors dr ON dr.doctor_id = a.doctor_id
JOIN users u ON u.user_id = dr.user_id
JOIN beds b ON b.bed_id = a.bed_id
JOIN wards w ON w.ward_id = b.ward_id
WHERE a.patient_id = 1
ORDER BY a.admit_date DESC;



-- revenue
SELECT 
  DATE_FORMAT(b.bill_date, '%b %Y') AS month,
  SUM(b.total_amount) AS billed,
  COALESCE(SUM(py.paid),0) AS collected
FROM bills b
LEFT JOIN (
  SELECT bill_id, SUM(amount_paid) AS paid 
  FROM payments 
  GROUP BY bill_id
) py ON py.bill_id = b.bill_id
WHERE b.bill_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
GROUP BY DATE_FORMAT(b.bill_date, '%Y-%m-01');


-- dept wise revenue
SELECT dept.dept_name,
       COUNT(a.appt_id) AS appointments,
       SUM(CASE WHEN a.status='completed' THEN 1 ELSE 0 END) AS completed
FROM departments dept
LEFT JOIN doctors d ON d.dept_id = dept.dept_id
LEFT JOIN appointments a ON a.doctor_id = d.doctor_id;