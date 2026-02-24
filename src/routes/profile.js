'use strict';
const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/profile
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, email, first_name, last_name, is_admin, created_at
         FROM users
        WHERE id = $1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('GET /api/profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/profile
// Only allows updating first_name and last_name
router.put('/', requireAuth, async (req, res) => {
  const { first_name, last_name } = req.body;

  if (first_name !== undefined && typeof first_name !== 'string') {
    return res.status(400).json({ error: 'first_name must be a string' });
  }
  if (last_name !== undefined && typeof last_name !== 'string') {
    return res.status(400).json({ error: 'last_name must be a string' });
  }

  try {
    const result = await pool.query(
      `UPDATE users
          SET first_name = COALESCE($1, first_name),
              last_name  = COALESCE($2, last_name)
        WHERE id = $3
        RETURNING id, email, first_name, last_name, is_admin`,
      [first_name ?? null, last_name ?? null, req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
