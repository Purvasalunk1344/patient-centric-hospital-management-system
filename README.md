# 🏥 Patient-Centric Transparent Hospital Management System

> DBMS Course Project · MySQL + Node.js + React

---

## 📁 Project Structure

```
hospital-project/
├── backend/                  ← Node.js + Express API
│   ├── server.js             ← Entry point
│   ├── config/db.js          ← MySQL connection
│   ├── routes/
│   │   ├── patients.js
│   │   ├── doctors.js
│   │   ├── departments.js
│   │   ├── appointments.js
│   │   ├── admissions.js
│   │   ├── wards.js
│   │   ├── labs.js
│   │   ├── pharmacy.js
│   │   ├── machinery.js
│   │   ├── billing.js        ← Core billing logic
│   │   ├── payments.js
│   │   └── dashboard.js
│   └── package.json
│
├── frontend/                 ← React App
│   ├── src/
│   │   ├── App.js            ← Routing
│   │   ├── App.css           ← Design system
│   │   ├── utils/api.js      ← All API calls
│   │   ├── components/
│   │   │   └── Layout.js     ← Sidebar + topbar
│   │   └── pages/
│   │       ├── Dashboard.js  ← Stats + charts
│   │       ├── Patients.js
│   │       ├── Doctors.js
│   │       ├── Appointments.js
│   │       ├── Admissions.js
│   │       ├── Labs.js
│   │       ├── Pharmacy.js
│   │       ├── Billing.js    ← Bill list
│   │       └── BillDetail.js ← Transparent bill view ⭐
│   └── package.json
│
├── hospital_schema.sql       ← Full DB schema
└── hospital_queries.sql      ← 38 unique SQL queries
```

---

## ⚙️ Setup Instructions

### Step 1: Database Setup

```bash
# Run the schema script with MySQL
mysql -u root -p < hospital_schema.sql
```

### Step 2: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env → set your DB_PASSWORD

# Start server
npm run dev        # development (auto-restart)
# or
npm start          # production
```

Backend runs at: **http://localhost:5000**

### Step 3: Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start React app
npm start
```

Frontend runs at: **http://localhost:3000**

---

## 🌐 API Endpoints

| Method | Endpoint                        | Description                    |
|--------|---------------------------------|--------------------------------|
| GET    | /api/patients                   | All patients                   |
| POST   | /api/patients                   | Add patient                    |
| GET    | /api/patients/:id/history       | Full patient history           |
| GET    | /api/doctors                    | All doctors with dept          |
| GET    | /api/appointments?date=&status= | Filtered appointments          |
| POST   | /api/appointments               | Book appointment (auto token)  |
| GET    | /api/admissions?status=admitted | Current admissions             |
| POST   | /api/admissions                 | Admit patient                  |
| PATCH  | /api/admissions/:id/discharge   | Discharge patient              |
| GET    | /api/wards/available-beds       | Available beds list            |
| GET    | /api/labs/orders                | All lab orders                 |
| POST   | /api/labs/orders                | Create lab order               |
| GET    | /api/pharmacy/medicines         | Medicine catalogue             |
| POST   | /api/pharmacy/prescriptions     | Create prescription            |
| GET    | /api/billing                    | All bills                      |
| GET    | /api/billing/:id                | **Full itemized bill**         |
| POST   | /api/billing/generate           | **Auto-generate bill**         |
| POST   | /api/billing/:id/charges        | Add manual charge              |
| POST   | /api/payments                   | Record payment                 |
| GET    | /api/dashboard/stats            | Admin dashboard stats          |

---

## 🗄️ Database Highlights

- **18 tables** — fully normalized to 3NF
- **10 ENUM types** — for clean categorical data
- **4 Triggers** — bed status, bill total sync, payment status, stock deduction
- **2 Functions** — `fn_bed_charge()`, `fn_generate_bill()`
- **4 Views** — transparent bill, outstanding, admissions, low stock
- **13 Indexes** — for query performance

### Core Billing Flow

```
fn_generate_bill(patient_id, admission_id, appt_id)
        │
        ├── Doctor consultation fee   → bill_details (charge_type='doctor')
        ├── Bed charges (days × rate) → bill_details (charge_type='bed')
        ├── Lab tests                 → bill_details (charge_type='lab')
        ├── Pharmacy items            → bill_details (charge_type='pharmacy')
        └── Machinery usage          → bill_details (charge_type='machinery')
                                              │
                                      TRIGGER auto-updates bills.total_amount
```

---

## 📊 SQL Query Categories (38 Total)

| Category         | Count | Concepts                              |
|------------------|-------|---------------------------------------|
| Basic JOINs      | 6     | INNER, LEFT JOIN, multi-table         |
| Aggregates       | 4     | SUM, COUNT, GROUP BY, HAVING          |
| Subqueries       | 4     | Correlated, EXISTS, scalar            |
| CTEs             | 3     | WITH, chained CTEs, pivot-style       |
| Window Functions | 5     | RANK, LAG, NTILE, SUM OVER, FIRST_VALUE |
| CASE + COALESCE  | 3     | Risk classification, NULL handling    |
| Set Operations   | 2     | UNION ALL, EXCEPT                     |
| ROLLUP           | 1     | Subtotals + grand total               |
| Views            | 1     | Query on view                         |
| Functions        | 1     | Stored function call                  |
| Advanced         | 5     | 360° view, FILTER, multi-CTE          |
| Bonus            | 3     | Management queries                    |

---

## 🎯 Key Features

1. **Transparent Billing** — Every charge (doctor, lab, bed, pharmacy, machinery) shown as separate line item
2. **Auto Bill Generation** — One function call generates complete itemized bill
3. **Real-time Bed Management** — Triggers update bed status on admit/discharge
4. **Stock Management** — Trigger deducts medicine stock on prescription
5. **Payment Tracking** — Partial payments supported, running balance shown
6. **Dashboard Analytics** — Revenue charts, occupancy, department stats

---

*DBMS Course Project — MySQL · Node.js · Html . CSS . JavaScript*
