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

// POST /api/reservations
// Auth required: create a new reservation for the signed-in user
router.post('/', requireAuth, async (req, res) => {
  const { start_date, end_date, description } = req.body;

  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date are required' });
  }
  if (start_date >= end_date) {
    return res.status(400).json({ error: 'end_date must be after start_date' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO reservations (user_id, start_date, end_date, description, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, start_date, end_date, description, status, created_at`,
      [req.user.id, start_date, end_date, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/reservations error:', err);
    res.status(500).json({ error: 'Failed to create reservation' });
  }
});

// PATCH /api/reservations/:id/cancel
// Auth required: guest cancels their own pending or approved reservation
router.patch('/:id/cancel', requireAuth, async (req, res) => {
  const reservationId = parseInt(req.params.id, 10);
  if (isNaN(reservationId)) {
    return res.status(400).json({ error: 'Invalid reservation ID' });
  }

  try {
    const result = await pool.query(
      `UPDATE reservations
          SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
          AND user_id = $2
          AND status IN ('pending', 'approved')
        RETURNING id, start_date, end_date, status`,
      [reservationId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found or cannot be cancelled' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/reservations/:id/cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel reservation' });
  }
});

// PATCH /api/reservations/:id/dates
// Auth required: guest requests new dates on their own pending reservation
router.patch('/:id/dates', requireAuth, async (req, res) => {
  const reservationId = parseInt(req.params.id, 10);
  if (isNaN(reservationId)) {
    return res.status(400).json({ error: 'Invalid reservation ID' });
  }

  const { start_date, end_date } = req.body;
  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date and end_date are required' });
  }
  if (start_date >= end_date) {
    return res.status(400).json({ error: 'end_date must be after start_date' });
  }

  try {
    const result = await pool.query(
      `UPDATE reservations
          SET start_date = $1, end_date = $2, updated_at = NOW()
        WHERE id = $3
          AND user_id = $4
          AND status = 'pending'
        RETURNING id, start_date, end_date, status`,
      [start_date, end_date, reservationId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found or cannot be changed' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('PATCH /api/reservations/:id/dates error:', err);
    res.status(500).json({ error: 'Failed to update reservation dates' });
  }
});

// GET /api/property-info
// Public: returns property details from env vars (no PII)
router.get('/property-info', async (req, res) => {
  res.json({
    address:       process.env.PROPERTY_ADDRESS      || null,
    checkin_time:  process.env.PROPERTY_CHECKIN_TIME  || null,
    checkout_time: process.env.PROPERTY_CHECKOUT_TIME || null,
    contact_name:  process.env.PROPERTY_CONTACT_NAME  || null,
    contact_phone: process.env.PROPERTY_CONTACT_PHONE || null,
  });
});

module.exports = router;
