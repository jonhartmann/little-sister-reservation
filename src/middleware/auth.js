'use strict';
const { pool } = require('../db');

async function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies.session;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.is_admin
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token = $1
          AND s.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      res.clearCookie('session');
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    req.user = result.rows[0];
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
