const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

/**
 * Example protected routes for meetings
 * These demonstrate how to protect meeting-related endpoints
 */

/**
 * @route   GET /api/meetings
 * @desc    Get all meetings (example)
 * @access  Private - Any authenticated user
 */
router.get('/', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Protected meetings endpoint',
    user: req.user,
  });
});

/**
 * @route   POST /api/meetings/create
 * @desc    Create a new meeting
 * @access  Private - Teachers and Admins only
 */
router.post(
  '/create',
  authenticateToken,
  authorizeRoles('admin', 'teacher'),
  (req, res) => {
    const roomId = Math.random().toString(36).substring(2, 9).toUpperCase();
    
    res.json({
      success: true,
      message: 'Meeting created successfully',
      data: {
        roomId,
        createdBy: req.user.name,
        role: req.user.role,
      },
    });
  }
);

/**
 * @route   GET /api/meetings/:roomId
 * @desc    Get meeting details
 * @access  Private - Any authenticated user
 */
router.get('/:roomId', authenticateToken, (req, res) => {
  const { roomId } = req.params;
  
  res.json({
    success: true,
    data: {
      roomId,
      accessedBy: req.user.name,
    },
  });
});

module.exports = router;
