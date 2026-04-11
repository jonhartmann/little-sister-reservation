'use strict';
const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { sendGuestMessage } = require('../services/email');

const router = express.Router();

// Simple in-memory rate limit: max 3 messages per user per hour
const rateLimitMap = new Map();
function isRateLimited(userId) {
  const now = Date.now();
  const window = 60 * 60 * 1000; // 1 hour
  const entry = rateLimitMap.get(userId) || { count: 0, windowStart: now };
  if (now - entry.windowStart > window) {
    entry.count = 0;
    entry.windowStart = now;
  }
  if (entry.count >= 3) return true;
  entry.count++;
  rateLimitMap.set(userId, entry);
  return false;
}

// POST /api/contact
// Auth required: send a message to the host
router.post('/', requireAuth, async (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.length > 1000) {
    return res.status(400).json({ error: 'Message must be 1000 characters or fewer' });
  }
  if (isRateLimited(req.user.id)) {
    return res.status(429).json({ error: 'Too many messages — please wait before sending another' });
  }

  try {
    await sendGuestMessage(req.user, message.trim());
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/contact error:', err.message);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

module.exports = router;
