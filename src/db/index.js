'use strict';
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Heroku Postgres requires SSL even from local machines.
// Use SSL whenever the DATABASE_URL points to a remote host (not localhost).
const isRemoteDb = process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('localhost') &&
  !process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  try {
    await pool.query(sql);
    console.log('Database schema initialized');
  } catch (err) {
    console.error('Failed to initialize DB schema:', err.message);
    throw err;
  }
}

module.exports = { pool, initDb };
