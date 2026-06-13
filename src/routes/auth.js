'use strict';
const express = require('express');
const crypto = require('crypto');
const { pool } = require('../db');
const { sendMagicLink, sendAdminNewRequest } = require('../services/email');

const router = express.Router();

function isAdminEmail(email) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

// POST /api/auth/request
// Body: { email, start_date, end_date, description }
// Creates or upserts user, creates pending reservation, sends magic link
router.post('/request', async (req, res) => {
  const { email, start_date, end_date, description } = req.body;

  if (!email || !start_date || !end_date) {
    return res.status(400).json({ error: 'email, start_date, and end_date are required' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const start = new Date(start_date);
  const end = new Date(end_date);
  if (isNaN(start) || isNaN(end)) {
    return res.status(400).json({ error: 'Invalid date format' });
  }
  if (end <= start) {
    return res.status(400).json({ error: 'end_date must be after start_date' });
  }
  if (start < new Date()) {
    return res.status(400).json({ error: 'start_date cannot be in the past' });
  }

  try {
    const userResult = await pool.query(
      `INSERT INTO users (email, is_admin)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE
           SET is_admin = EXCLUDED.is_admin
         RETURNING id, email, is_admin`,
      [email.toLowerCase(), isAdminEmail(email)]
    );
    const user = userResult.rows[0];

    const reservationResult = await pool.query(
      `INSERT INTO reservations (user_id, start_date, end_date, description, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING id`,
      [user.id, start_date, end_date, description || null]
    );
    const reservationId = reservationResult.rows[0].id;

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      `INSERT INTO auth_tokens (email, token, expires_at) VALUES ($1, $2, $3)`,
      [email.toLowerCase(), token, expiresAt]
    );

    try {
      await sendMagicLink(email, token);
    } catch (emailErr) {
      console.error('Failed to send magic link email:', emailErr.message);
      const link = `${process.env.BASE_URL}/api/auth/verify?token=${token}`;
      console.warn('[DEV] Magic link (email failed):', link);
    }

    try {
      await sendAdminNewRequest({ start_date, end_date, description }, email);
    } catch (emailErr) {
      console.error('Failed to send admin notification email:', emailErr.message);
    }

    res.status(201).json({
      message: 'Reservation request received. Check your email for a sign-in link.',
      reservationId,
    });
  } catch (err) {
    console.error('POST /api/auth/request error:', err);
    res.status(500).json({ error: 'Failed to process reservation request' });
  }
});

// GET /api/auth/verify?token=...
// Server-side token validation — redirects directly to dashboard or admin.
// Designed for magic-link clicks in mobile/in-app browsers where JS may be unreliable.
router.get('/verify', async (req, res) => {
  const token = req.query.token;

  if (!token) {
    return res.status(400).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invalid Link</title></head><body style="font-family:sans-serif;text-align:center;padding:3rem"><h2>Invalid Link</h2><p>This sign-in link is missing a token.</p><p><a href="/">Back to Home</a></p></body></html>`);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tokenResult = await client.query(
      `SELECT id, email, expires_at, used_at
         FROM auth_tokens
        WHERE token = $1
        FOR UPDATE`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invalid Link</title></head><body style="font-family:sans-serif;text-align:center;padding:3rem"><h2>Sign-In Failed</h2><p>This sign-in link is invalid or has expired.</p><p><a href="/">Request a new link</a></p></body></html>`);
    }

    const authToken = tokenResult.rows[0];

    if (authToken.used_at) {
      await client.query('ROLLBACK');
      return res.status(401).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Link Already Used</title></head><body style="font-family:sans-serif;text-align:center;padding:3rem"><h2>Link Already Used</h2><p>This sign-in link has already been used. Please request a new one.</p><p><a href="/">Request a new link</a></p></body></html>`);
    }

    if (new Date(authToken.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(401).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Link Expired</title></head><body style="font-family:sans-serif;text-align:center;padding:3rem"><h2>Link Expired</h2><p>This sign-in link has expired (links are valid for 15 minutes). Please request a new one.</p><p><a href="/">Request a new link</a></p></body></html>`);
    }

    await client.query(
      `UPDATE auth_tokens SET used_at = NOW() WHERE id = $1`,
      [authToken.id]
    );

    const userResult = await client.query(
      `SELECT id, email, first_name, last_name, is_admin
         FROM users
        WHERE email = $1`,
      [authToken.email]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sign-In Failed</title></head><body style="font-family:sans-serif;text-align:center;padding:3rem"><h2>Sign-In Failed</h2><p>User not found. Please request a new sign-in link.</p><p><a href="/">Back to Home</a></p></body></html>`);
    }

    const user = userResult.rows[0];
    const sessionToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.query(
      `INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, sessionToken, expiresAt]
    );

    await client.query('COMMIT');

    res.cookie('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.redirect(user.is_admin ? '/admin.html' : '/dashboard.html');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('GET /api/auth/verify error:', err);
    res.status(500).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Error</title></head><body style="font-family:sans-serif;text-align:center;padding:3rem"><h2>Something went wrong</h2><p>Please try requesting a new sign-in link.</p><p><a href="/">Back to Home</a></p></body></html>`);
  } finally {
    client.release();
  }
});

// POST /api/auth/verify
// Body: { token } or ?token= query param
// Validates token, creates session cookie, returns user info
router.post('/verify', async (req, res) => {
  const token = req.body.token || req.query.token;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tokenResult = await client.query(
      `SELECT id, email, expires_at, used_at
         FROM auth_tokens
        WHERE token = $1
        FOR UPDATE`,
      [token]
    );

    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const authToken = tokenResult.rows[0];

    if (authToken.used_at) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Token has already been used' });
    }

    if (new Date(authToken.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Token has expired' });
    }

    await client.query(
      `UPDATE auth_tokens SET used_at = NOW() WHERE id = $1`,
      [authToken.id]
    );

    const userResult = await client.query(
      `SELECT id, email, first_name, last_name, is_admin
         FROM users
        WHERE email = $1`,
      [authToken.email]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    const sessionToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await client.query(
      `INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, sessionToken, expiresAt]
    );

    await client.query('COMMIT');

    res.cookie('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      message: 'Signed in successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isAdmin: user.is_admin,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /api/auth/verify error:', err);
    res.status(500).json({ error: 'Failed to verify token' });
  } finally {
    client.release();
  }
});

// POST /api/auth/signin
// Body: { email }
// Upserts the user (creates account if new), then sends a magic link.
// Works for both new and returning users; no reservation required.
router.post('/signin', async (req, res) => {
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required' });
  }

  try {
    // Upsert user (re-evaluates admin status)
    await pool.query(
      `INSERT INTO users (email, is_admin)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE
           SET is_admin = EXCLUDED.is_admin`,
      [email.toLowerCase(), isAdminEmail(email)]
    );

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      `INSERT INTO auth_tokens (email, token, expires_at) VALUES ($1, $2, $3)`,
      [email.toLowerCase(), token, expiresAt]
    );

    try {
      await sendMagicLink(email, token);
    } catch (emailErr) {
      console.error('Failed to send sign-in email:', emailErr.message);
      const link = `${process.env.BASE_URL}/api/auth/verify?token=${token}`;
      console.warn('[DEV] Magic link (email failed):', link);
    }

    res.json({ message: 'Sign-in link sent. Check your email.' });
  } catch (err) {
    console.error('POST /api/auth/signin error:', err);
    res.status(500).json({ error: 'Failed to send sign-in link' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const token = req.cookies && req.cookies.session;
  if (token) {
    try {
      await pool.query(`DELETE FROM sessions WHERE token = $1`, [token]);
    } catch (err) {
      console.error('Logout DB error:', err.message);
    }
  }
  res.clearCookie('session');
  res.json({ message: 'Logged out' });
});

module.exports = router;
