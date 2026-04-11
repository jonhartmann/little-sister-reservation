'use strict';
require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

const { initDb } = require('./src/db');
const { startScheduler } = require('./src/services/scheduler');

const authRoutes        = require('./src/routes/auth');
const reservationRoutes = require('./src/routes/reservations');
const profileRoutes     = require('./src/routes/profile');
const adminRoutes       = require('./src/routes/admin');
const contactRoutes     = require('./src/routes/contact');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// API routes
app.use('/api/auth',         authRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/profile',      profileRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/contact',      contactRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Little Sister Reservation System is running' });
});

// Serve frontend from public/
app.use(express.static(path.join(__dirname, 'public')));

// 404 for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

function checkEnv() {
  const required = [
    'DATABASE_URL',
    'MAILJET_API_KEY',
    'MAILJET_SECRET_KEY',
    'MAILJET_FROM_EMAIL',
    'BASE_URL',
  ];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.warn('WARNING: Missing environment variables:', missing.join(', '));
    console.warn('Email sending will fail until these are set in .env');
  }
}

async function start() {
  checkEnv();
  await initDb();
  startScheduler();
  app.listen(PORT, () => {
    console.log(`Little Sister Reservation System running on port ${PORT}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
