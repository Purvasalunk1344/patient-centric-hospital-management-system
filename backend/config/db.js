const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME     || 'hospital_db',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool.getConnection()
  .then((conn) => {
    conn.release();
    console.log('✅ MySQL connected');
  })
  .catch((err) => {
    console.error('❌ MySQL connection error:', err.message);
  });

const query = async (sql, params = []) => {
  const [rows] = await pool.query(sql, params);
  return { rows: Array.isArray(rows) ? rows : [], result: rows };
};

const connect = async () => {
  const conn = await pool.getConnection();
  return conn;
};

module.exports = { query, connect, getConnection: connect };
