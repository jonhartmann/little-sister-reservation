const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Little Sister Reservation System is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Little Sister Reservation System running on port ${PORT}`);
});
