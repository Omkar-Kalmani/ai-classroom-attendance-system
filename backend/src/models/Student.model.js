const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────
//  Frame Timeline Entry (sub-document)
//  One entry per frame where this student was visible.
//  Used to draw the engagement timeline chart in the frontend.
// ─────────────────────────────────────────────────────────────
const frameEntrySchema = new mongoose.Schema(
  {
    frameNo: Number,              // Frame number in the video
    timestampSec: Number,         // Timestamp in seconds (e.g. 12.4)
    frameScore: Number,           // Weighted score 0.0 to 1.0
    isAttentive: Boolean,         // frameScore >= 0.6 → true
  },
  { _id: false }                  // Don't create _id for each frame entry (saves space)
);

// ─────────────────────────────────────────────────────────────
//  Student Schema
//  One document per student per session.
//  "Student" here = a tracked face, not a named person.
// ─────────────────────────────────────────────────────────────
const studentSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true,
      index: true,
    },

    // ID assigned by the tracker (1, 2, 3...)
    trackId: {
      type: Number,
      required: true,
    },

    // Display label shown in the UI and reports
    label: {
      type: String,
      default: function () {
        return `Student #${this.trackId}`;
      },
    },

    // Frame counts
    totalFrames: {
      type: Number,
      default: 0,                 // How many frames this student appeared in
    },

    attentiveFrames: {
      type: Number,
      default: 0,                 // How many of those frames had frameScore >= 0.6
    },

    // Final calculated engagement score: (attentiveFrames / totalFrames) * 100
    engagementScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // PRESENT if engagementScore >= threshold, else ABSENT
    attendanceStatus: {
      type: String,
      enum: ['present', 'absent'],
      default: 'absent',
    },

    // Average scores per signal — used for the signal breakdown chart
    signalBreakdown: {
      gazeAvg: { type: Number, default: 0 },
      headPoseAvg: { type: Number, default: 0 },
      eyeOpenAvg: { type: Number, default: 0 },
      faceVisibleAvg: { type: Number, default: 0 },
      bodyOrientAvg: { type: Number, default: 0 },
    },

    // Frame-by-frame data for the engagement timeline chart
    // Sampled (every 10th frame) to keep document size manageable
    frameTimeline: [frameEntrySchema],
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────────────────────
//  Compound index — quickly find all students for a session
// ─────────────────────────────────────────────────────────────
studentSchema.index({ sessionId: 1, trackId: 1 });

module.exports = mongoose.model('Student', studentSchema);
