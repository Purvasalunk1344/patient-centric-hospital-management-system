const express = require('express');
const cors    = require('cors');
require('dotenv').config();

const app = express();
const { verifyToken, requireAdmin } = require('./middleware/auth');


app.use(cors());
app.use(express.json());

app.use('/api/auth',         require('./routes/auth'));

app.use('/api/patients',     verifyToken, require('./routes/patients'));
app.use('/api/doctors',      verifyToken, require('./routes/doctors'));
app.use('/api/appointments', verifyToken, require('./routes/appointments'));
app.use('/api/billing',      verifyToken, require('./routes/billing'));


app.use('/api/departments',  verifyToken, requireAdmin, require('./routes/departments'));
app.use('/api/admissions',   verifyToken, requireAdmin, require('./routes/admissions'));
app.use('/api/wards',        verifyToken, requireAdmin, require('./routes/wards'));
app.use('/api/labs',         verifyToken, requireAdmin, require('./routes/labs'));
app.use('/api/pharmacy',     verifyToken, require('./routes/pharmacy'));
app.use('/api/machinery',    verifyToken, requireAdmin, require('./routes/machinery'));
app.use('/api/payments',     verifyToken, requireAdmin, require('./routes/payments'));
app.use('/api/dashboard',    verifyToken, require('./routes/dashboard'));
app.use('/api/reports',      verifyToken, requireAdmin, require('./routes/reports'));



app.get('/', (req, res) => {
  res.json({ message: 'Hospital Management API running ✅', version: '1.0.0' });
});


app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🏥 Hospital API running on http://localhost:${PORT}`);
});
