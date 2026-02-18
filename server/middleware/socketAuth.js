const jwt = require('jsonwebtoken');
const jwtConfig = require('../config/jwt');

/**
 * Socket.IO Authentication Middleware
 * Verifies JWT token during socket connection handshake
 * 
 * Client should connect with:
 * io("http://server", { auth: { token: "your-jwt-token" } })
 */
const socketAuthMiddleware = (socket, next) => {
  try {
    // Get token from socket handshake auth
    const token = socket.handshake.auth?.token;

    if (!token) {
      console.log(`❌ Socket auth failed: No token provided (${socket.id})`);
      return next(new Error('Authentication required. Please provide a valid token.'));
    }

    // Verify token
    const decoded = jwt.verify(token, jwtConfig.secret);

    // Attach user info to socket object
    socket.user = {
      userId: decoded.userId,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
    };

    console.log(`✅ Socket authenticated: ${socket.user.name} (${socket.user.role})`);
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.log(`❌ Socket auth failed: Token expired (${socket.id})`);
      return next(new Error('Token has expired. Please login again.'));
    }

    if (error.name === 'JsonWebTokenError') {
      console.log(`❌ Socket auth failed: Invalid token (${socket.id})`);
      return next(new Error('Invalid token.'));
    }

    console.error('❌ Socket auth error:', error.message);
    return next(new Error('Authentication error.'));
  }
};

/**
 * Socket.IO Room Authorization Middleware
 * Can be used to check if user has permission to join a specific room
 * This is an example for future role-based room access
 */
const socketRoomAuthMiddleware = (socket, roomId, callback) => {
  // Example: Check if user can join this room
  // For now, all authenticated users can join any room
  
  if (!socket.user) {
    callback(new Error('Not authenticated'));
    return false;
  }

  // Future: Add role-based room access checks here
  // Example:
  // if (socket.user.role === 'student' && roomInfo.restricted) {
  //   callback(new Error('Students cannot join restricted rooms'));
  //   return false;
  // }

  callback(null);
  return true;
};

module.exports = {
  socketAuthMiddleware,
  socketRoomAuthMiddleware,
};
