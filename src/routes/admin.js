'use strict';
const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendStatusUpdate } = require('../services/email');

const router = express.Router();

const ALLOWED_STATUSES = ['approved', 'denied', 'cancelled'];

// GET /api/admin/reservations
// Returns all reservations with user info
router.get('/reservations', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
          r.id,
          r.start_date,
          r.end_date,
          r.description,
          r.status,
          r.admin_note,
          r.created_at,
          r.updated_at,
          u.id         AS user_id,
          u.email      AS user_email,
          u.first_name AS user_first_name,
          u.last_name  AS user_last_name
         FROM reservations r
         JOIN users u ON u.id = r.user_id
        ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('GET /api/admin/reservations error:', err);
    res.status(500).json({ error: 'Failed to fetch reservations' });
  }
});

// PUT /api/admin/reservations/:id
// Updates reservation status and optional note; sends email to guest
router.put('/reservations/:id', requireAuth, requireAdmin, async (req, res) => {
  const reservationId = parseInt(req.params.id, 10);
  const { status, admin_note } = req.body;

  if (isNaN(reservationId)) {
    return res.status(400).json({ error: 'Invalid reservation ID' });
  }

  if (!status) {
    return res.status(400).json({ error: 'status is required' });
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status must be one of: ${ALLOWED_STATUSES.join(', ')}`,
    });
  }

  try {
    const result = await pool.query(
      `UPDATE reservations
          SET status     = $1,
              admin_note = COALESCE($2, admin_note),
              updated_at = NOW()
        WHERE id = $3
        RETURNING
          id, start_date, end_date, status, admin_note,
          (SELECT email FROM users WHERE id = reservations.user_id) AS user_email`,
      [status, admin_note ?? null, reservationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const reservation = result.rows[0];

    try {
      await sendStatusUpdate(reservation.user_email, reservation, admin_note);
    } catch (emailErr) {
      console.error('Failed to send status update email:', emailErr.message);
    }

    res.json(reservation);
  } catch (err) {
    console.error('PUT /api/admin/reservations/:id error:', err);
    res.status(500).json({ error: 'Failed to update reservation' });
  }
});

module.exports = router;
