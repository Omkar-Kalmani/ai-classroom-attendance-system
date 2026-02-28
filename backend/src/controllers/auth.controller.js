const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const Teacher = require('../models/Teacher.model');
const { createError } = require('../middleware/error.middleware');

// ─────────────────────────────────────────────────────────────
//  generateToken — create a signed JWT for a teacher
// ─────────────────────────────────────────────────────────────
const generateToken = (id) => {
  return jwt.sign(
    { id },                           // Payload: just the teacher's MongoDB _id
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/register
//  Create a new teacher account
// ─────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    // ── Validate request body ──────────────────────────────
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    const { name, email, password, institution } = req.body;

    // ── Check if teacher already exists ───────────────────
    const existingTeacher = await Teacher.findOne({ email: email.toLowerCase() });
    if (existingTeacher) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // ── Create teacher (password gets hashed by pre-save hook) ──
    const teacher = await Teacher.create({
      name,
      email: email.toLowerCase(),
      passwordHash: password,     // The pre-save hook in model will hash this
      institution: institution || '',
    });

    // ── Generate token ─────────────────────────────────────
    const token = generateToken(teacher._id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      teacher: teacher.toPublicJSON(),
    });

  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/auth/login
//  Log in with email + password, receive JWT
// ─────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }

    const { email, password } = req.body;

    // ── Find teacher — include passwordHash (excluded by default) ──
    const teacher = await Teacher.findOne({ email: email.toLowerCase() }).select('+passwordHash');

    if (!teacher || !teacher.isActive) {
      // Use a generic message — don't reveal whether email exists
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // ── Verify password ────────────────────────────────────
    const isPasswordCorrect = await teacher.comparePassword(password);
    if (!isPasswordCorrect) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // ── Update last login timestamp ────────────────────────
    teacher.lastLogin = new Date();
    await teacher.save({ validateBeforeSave: false });

    // ── Generate token and respond ─────────────────────────
    const token = generateToken(teacher._id);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully.',
      token,
      teacher: teacher.toPublicJSON(),
    });

  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/auth/me   (protected)
//  Return the currently logged-in teacher's profile
// ─────────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    // req.teacher is set by the protect middleware
    res.status(200).json({
      success: true,
      teacher: req.teacher.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe };
