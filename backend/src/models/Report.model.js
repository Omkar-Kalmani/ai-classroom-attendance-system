const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────
//  Report Schema
//  One report per session. Generated after processing completes.
//  Stores file paths for PDF and CSV + pre-computed summary data.
// ─────────────────────────────────────────────────────────────
const reportSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      unique: true,               // Each session has exactly one report
    },

    // File paths (local or S3 key in production)
    pdfPath: {
      type: String,
      default: null,
    },

    csvPath: {
      type: String,
      default: null,
    },

    // Pre-computed summary so dashboard loads fast (no re-aggregation)
    summary: {
      totalStudents:      { type: Number, default: 0 },
      presentCount:       { type: Number, default: 0 },
      absentCount:        { type: Number, default: 0 },
      attendanceRate:     { type: Number, default: 0 },   // present/total * 100
      classEngagementAvg: { type: Number, default: 0 },   // avg of all engagement scores
    },

    // Top 3 students by engagement score
    topStudents: [
      {
        trackId:         Number,
        label:           String,
        engagementScore: Number,
        _id: false,
      },
    ],

    // Students who were marked ABSENT (score < threshold)
    lowFocusStudents: [
      {
        trackId:         Number,
        label:           String,
        engagementScore: Number,
        _id: false,
      },
    ],

    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Report', reportSchema);
