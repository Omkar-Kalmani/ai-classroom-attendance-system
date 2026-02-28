const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────
//  Session Schema
//  A session = one classroom video uploaded by a teacher.
//  Tracks the full lifecycle: upload → processing → completed.
// ─────────────────────────────────────────────────────────────
const sessionSchema = new mongoose.Schema(
  {
    // Which teacher owns this session
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
      index: true,                // Index for fast "get all sessions by teacher" queries
    },

    // Human-readable name given by teacher e.g. "Math 101 - Feb 27"
    name: {
      type: String,
      required: [true, 'Session name is required'],
      trim: true,
      maxlength: [200, 'Session name too long'],
    },

    // File storage info
    videoPath: {
      type: String,
      default: null,              // Set after file is uploaded
    },

    videoName: {
      type: String,
      default: null,              // Original filename
    },

    videoSize: {
      type: Number,
      default: null,              // File size in bytes
    },

    videoDurationSec: {
      type: Number,
      default: null,              // Filled after AI processes the video
    },

    // Processing lifecycle
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },

    processingProgress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,                 // 0% to 100% — updated in real-time
    },

    errorMessage: {
      type: String,
      default: null,              // Populated if status = 'failed'
    },

    // Results — filled after processing completes
    totalStudents: {
      type: Number,
      default: 0,
    },

    avgClassEngagement: {
      type: Number,
      default: 0,                 // Class average engagement percentage
    },

    // The threshold used for this session (default 70%)
    // Stored here so historical reports remain accurate if threshold changes
    engagementThreshold: {
      type: Number,
      default: 70,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Session', sessionSchema);
