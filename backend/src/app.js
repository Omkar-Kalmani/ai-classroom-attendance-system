const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const authRoutes = require("./routes/auth.routes");
const sessionRoutes = require("./routes/sessions.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const { errorHandler } = require("./middleware/error.middleware");

const app = express();

// ─────────────────────────────────────────────────────────────
//  Security Middleware
// ─────────────────────────────────────────────────────────────

// Helmet sets secure HTTP response headers automatically
app.use(helmet());

// CORS — only allow requests from your React frontend
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// Rate limiting on auth routes — prevents brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 requests per window
  message: {
    success: false,
    message: "Too many attempts. Please try again in 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─────────────────────────────────────────────────────────────
//  General Middleware
// ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// HTTP request logger (only in development)
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ─────────────────────────────────────────────────────────────
//  Health Check (no auth required)
// ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Classroom Attendance API is running",
    timestamp: new Date().toISOString(),
  });
});

// ─────────────────────────────────────────────────────────────
//  API Routes
// ─────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/students", require("./routes/students.routes"));

// ─────────────────────────────────────────────────────────────
//  404 Handler — catches any undefined routes
// ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found.`,
  });
});

// ─────────────────────────────────────────────────────────────
//  Global Error Handler — MUST be last
// ─────────────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
