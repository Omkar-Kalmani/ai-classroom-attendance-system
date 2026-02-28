const Session = require('../models/Session.model');
const Student = require('../models/Student.model');
const Report = require('../models/Report.model');
const { createError } = require('../middleware/error.middleware');

// ─────────────────────────────────────────────────────────────
//  GET /api/sessions/:id/results   (protected)
//  Return all students with engagement scores + attendance
// ─────────────────────────────────────────────────────────────
const getResults = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      teacherId: req.teacher._id,
    });

    if (!session) return next(createError(404, 'Session not found.'));

    if (session.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: `Session is not completed yet. Current status: ${session.status}`,
      });
    }

    // Fetch all students, sorted by engagement (highest first)
    const students = await Student.find({ sessionId: session._id })
      .sort({ engagementScore: -1 })
      .select('-frameTimeline -__v');   // Exclude heavy timeline data for list view

    res.status(200).json({
      success: true,
      session: {
        id: session._id,
        name: session.name,
        totalStudents: session.totalStudents,
        avgClassEngagement: session.avgClassEngagement,
        engagementThreshold: session.engagementThreshold,
        completedAt: session.completedAt,
      },
      students,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/sessions/:id/results/:studentId   (protected)
//  Single student — includes full frame timeline for charts
// ─────────────────────────────────────────────────────────────
const getStudentDetail = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      teacherId: req.teacher._id,
    });

    if (!session) return next(createError(404, 'Session not found.'));

    const student = await Student.findOne({
      _id: req.params.studentId,
      sessionId: session._id,
    });

    if (!student) return next(createError(404, 'Student not found.'));

    res.status(200).json({ success: true, student });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/sessions/:id/analytics   (protected)
//  Class-level analytics for charts on the dashboard
// ─────────────────────────────────────────────────────────────
const getAnalytics = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      teacherId: req.teacher._id,
    });

    if (!session) return next(createError(404, 'Session not found.'));
    if (session.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Session not completed yet.' });
    }

    const report = await Report.findOne({ sessionId: session._id });
    const students = await Student.find({ sessionId: session._id })
      .sort({ engagementScore: -1 })
      .select('label engagementScore attendanceStatus signalBreakdown trackId');

    // Build distribution buckets for bar chart (0-10%, 10-20%... 90-100%)
    const distribution = Array(10).fill(0);
    students.forEach((s) => {
      const bucket = Math.min(Math.floor(s.engagementScore / 10), 9);
      distribution[bucket]++;
    });

    res.status(200).json({
      success: true,
      analytics: {
        summary: report?.summary || {},
        topStudents: report?.topStudents || [],
        lowFocusStudents: report?.lowFocusStudents || [],
        engagementDistribution: distribution.map((count, i) => ({
          range: `${i * 10}–${(i + 1) * 10}%`,
          count,
        })),
        students: students.map((s) => ({
          label: s.label,
          engagementScore: s.engagementScore,
          attendanceStatus: s.attendanceStatus,
          signalBreakdown: s.signalBreakdown,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getResults, getStudentDetail, getAnalytics };
