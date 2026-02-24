'use strict';
require('dotenv').config();

const express = require('express');
const cookieParser = require('cookie-parser');

const { initDb } = require('./src/db');
const { startScheduler } = require('./src/services/scheduler');

const authRoutes        = require('./src/routes/auth');
const reservationRoutes = require('./src/routes/reservations');
const profileRoutes     = require('./src/routes/profile');
const adminRoutes       = require('./src/routes/admin');

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Little Sister Reservation System is running' });
});

// Static frontend (uncomment when public/ directory exists)
// app.use(express.static(path.join(__dirname, 'public')));

// 404 for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
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
