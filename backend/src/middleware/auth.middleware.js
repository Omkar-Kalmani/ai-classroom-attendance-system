const jwt = require('jsonwebtoken');
const Teacher = require('../models/Teacher.model');

// ─────────────────────────────────────────────────────────────
//  protect middleware
//  Attach this to any route that requires a logged-in teacher.
//
//  Usage in routes:
//    router.get('/sessions', protect, sessionController.getAll)
//
//  Flow:
//    1. Read Authorization header
//    2. Verify JWT signature
//    3. Find teacher in DB (ensures account still exists/active)
//    4. Attach teacher to req.teacher for downstream use
// ─────────────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    // ── Step 1: Extract token ──────────────────────────────
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      // Token format: "Bearer eyJhbGci..."
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    // ── Step 2: Verify token ───────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please log in again.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.',
      });
    }

    // ── Step 3: Find teacher in DB ─────────────────────────
    // This also ensures the account wasn't deleted after token was issued
    const teacher = await Teacher.findById(decoded.id).select('-passwordHash');

    if (!teacher || !teacher.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account not found or deactivated.',
      });
    }

    // ── Step 4: Attach to request ──────────────────────────
    req.teacher = teacher;
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error. Please try again.',
    });
  }
};

module.exports = { protect };
