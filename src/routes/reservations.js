'use strict';
const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/reservations/calendar
// Public: returns approved reservations as date ranges (no PII)
router.get('/calendar', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT start_date, end_date
         FROM reservations
        WHERE status IN ('approved', 'blocked')
        ORDER BY start_date ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/reservations/calendar error:', err);
    res.status(500).json({ error: 'Failed to fetch calendar' });
  }
});

// GET /api/reservations/mine
// Auth required: returns current user's reservations with status
router.get('/mine', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, start_date, end_date, description, status, admin_note, created_at, updated_at
         FROM reservations
        WHERE user_id = $1
        ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/reservations/mine error:', err);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

module.exports = router;
