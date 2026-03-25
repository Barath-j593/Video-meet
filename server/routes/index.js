const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const meetingsRoutes = require('./meetings');
const jobRoutes = require('./job');

// Mount routes
router.use('/auth', authRoutes);
router.use('/meetings', meetingsRoutes);
router.use('/job', jobRoutes);

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
