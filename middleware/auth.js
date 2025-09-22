const jwt = require('jsonwebtoken');
const User = require('../models/User');
const config = require('../config/config');

// Protect routes
const protect = async (req, res, next) => {
  let token;

  // Prefer HttpOnly cookie
  if (req.cookies && req.cookies.access_token) {
    token = req.cookies.access_token;
  }
  // Fallback to Authorization header for backward compatibility
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, config.JWT_SECRET);
    

    req.user = await User.findById(decoded.id).select('-password');
    
    if (!req.user) {
      
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!req.user.isActive) {
    
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

   
    next();
  } catch (err) {
    
    
    // Provide more specific error messages
    let message = 'Not authorized to access this route';
    if (err.name === 'TokenExpiredError') {
      message = 'Token has expired';
    } else if (err.name === 'JsonWebTokenError') {
      message = 'Invalid token';
    }
    
    return res.status(401).json({
      success: false,
      message
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Optional authentication (for routes that work with both authenticated and guest users)
const optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (err) {
      // Token is invalid, but continue as guest
      req.user = null;
    }
  }

  next();
};

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRE,
  });
};

module.exports = {
  protect,
  authorize,
  optionalAuth,
  generateToken
}; 