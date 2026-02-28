// ─────────────────────────────────────────────────────────────
//  Global Error Handler
//  This must be the LAST middleware in app.js (after all routes).
//  Express recognizes it as an error handler because it has 4 args.
//
//  Usage: Just call next(error) from any controller or middleware.
//         Express will skip all normal middleware and come here.
// ─────────────────────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  // Log error details in development
  if (process.env.NODE_ENV === 'development') {
    console.error('─── ERROR ───────────────────────────');
    console.error('Path:   ', req.path);
    console.error('Method: ', req.method);
    console.error('Message:', err.message);
    console.error('Stack:  ', err.stack);
    console.error('─────────────────────────────────────');
  }

  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // ── Mongoose: Duplicate key (unique field already exists) ──
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `An account with this ${field} already exists.`;
  }

  // ── Mongoose: Validation error ────────────────────────────
  if (err.name === 'ValidationError') {
    statusCode = 400;
    // Collect all validation error messages into one string
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
  }

  // ── Mongoose: Invalid ObjectId ────────────────────────────
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found. Invalid ID format.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    // Only include stack trace in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// ─────────────────────────────────────────────────────────────
//  createError — helper to throw errors with status codes
//  Usage: throw createError(404, 'Session not found')
// ─────────────────────────────────────────────────────────────
const createError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

module.exports = { errorHandler, createError };
