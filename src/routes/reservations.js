'use strict';
const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { sendNewReservationAlert, sendGuestCancellationAlert } = require('../services/email');

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

// GET /api/reservations/ical
// Public: returns all approved+blocked reservations as an iCal (.ics) feed
router.get('/ical', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, start_date, end_date
         FROM reservations
        WHERE status IN ('approved', 'blocked')
        ORDER BY start_date ASC`
    );

    const fmt = (dateStr) => {
      // Format as YYYYMMDD for iCal DATE values
      return String(dateStr).slice(0, 10).replace(/-/g, '');
    };

    const addDays = (dateStr, n) => {
      const [y, m, d] = String(dateStr).slice(0, 10).split('-').map(Number);
      const dt = new Date(y, m - 1, d + n);
      return [
        dt.getFullYear(),
        String(dt.getMonth() + 1).padStart(2, '0'),
        String(dt.getDate()).padStart(2, '0'),
      ].join('');
    };

    const events = result.rows.map(r => [
      'BEGIN:VEVENT',
      `UID:reservation-${r.id}@little-sister`,
      `DTSTART;VALUE=DATE:${fmt(r.start_date)}`,
      `DTEND;VALUE=DATE:${addDays(r.end_date, 1)}`,
      'SUMMARY:Little Sister — Reserved',
      'END:VEVENT',
    ].join('\r\n')).join('\r\n');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Little Sister//Reservation Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      events,
      'END:VCALENDAR',
    ].join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="little-sister.ics"');
    res.send(ics);
  } catch (err) {
    console.error('GET /api/reservations/ical error:', err);
    res.status(500).send('Failed to generate calendar');
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
    const reservation = result.rows[0];
    res.status(201).json(reservation);

    // Notify host — fire-and-forget, don't block the response
    sendNewReservationAlert(reservation, req.user).catch(err =>
      console.error('Failed to send new reservation alert:', err.message)
    );
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

    // Notify host — fire-and-forget
    sendGuestCancellationAlert(result.rows[0], req.user).catch(err =>
      console.error('Failed to send cancellation alert:', err.message)
    );
  } catch (err) {
    console.error('PATCH /api/reservations/:id/cancel error:', err);
    res.status(500).json({ error: 'Failed to cancel reservation' });
  }
});

module.exports = router;
