const express = require('express');
const router = express.Router();
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const { rows: users } = await db.query('SELECT * FROM users WHERE email = ? AND is_active = TRUE', [email]);
    if (users.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = users[0];
    
    // For demo purposes with sample data passwords like 'hashed_pw_1'
    const isValid = password === user.password_hash;
    if (!isValid) return res.status(401).json({ error: 'Invalid password' });

    let patient_id = null;
    if (user.role === 'patient') {
      const { rows: patients } = await db.query('SELECT patient_id FROM patients WHERE user_id = ?', [user.user_id]);
      if (patients.length > 0) patient_id = patients[0].patient_id;
    }

    const token = jwt.sign(
      { id: user.user_id, role: user.role, patient_id },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({ token, user: { id: user.user_id, name: user.name, role: user.role, patient_id } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password || !phone) {
      return res.status(400).json({ error: 'Name, email, password, and phone are required' });
    }

    const { rows: existing } = await db.query('SELECT user_id FROM users WHERE email = ?', [email]);
    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // 1. Create User
    const userResult = await db.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, password, 'patient']
    );
    const userId = userResult.result.insertId;

    // 2. Link to existing Patient or Create New
    // Try to find a patient with same phone who doesn't have a user yet
    const { rows: existingPatients } = await db.query(
      'SELECT patient_id FROM patients WHERE phone = ? AND user_id IS NULL',
      [phone]
    );

    if (existingPatients.length > 0) {
      // Link existing record
      await db.query(
        'UPDATE patients SET user_id = ?, name = ? WHERE patient_id = ?',
        [userId, name, existingPatients[0].patient_id]
      );
    } else {
      // Create new record
      await db.query(
        'INSERT INTO patients (user_id, name, phone) VALUES (?, ?, ?)',
        [userId, name, phone]
      );
    }

    res.status(201).json({ message: 'Registration successful! Please login.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
