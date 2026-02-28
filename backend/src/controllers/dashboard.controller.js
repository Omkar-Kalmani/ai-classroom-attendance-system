const Session = require('../models/Session.model');

// ─────────────────────────────────────────────────────────────
//  GET /api/dashboard/summary   (protected)
//  Teacher's overall statistics across all sessions
// ─────────────────────────────────────────────────────────────
const getSummary = async (req, res, next) => {
  try {
    const teacherId = req.teacher._id;

    // Get all sessions for this teacher
    const sessions = await Session.find({ teacherId }).select(
      'status totalStudents avgClassEngagement createdAt name'
    );

    const completedSessions = sessions.filter((s) => s.status === 'completed');

    // Calculate overall average engagement across all completed sessions
    const overallAvgEngagement =
      completedSessions.length > 0
        ? completedSessions.reduce((sum, s) => sum + s.avgClassEngagement, 0) /
          completedSessions.length
        : 0;

    // Total students across all completed sessions
    const totalStudentsAnalyzed = completedSessions.reduce(
      (sum, s) => sum + s.totalStudents, 0
    );

    // Recent 5 sessions for the activity feed
    const recentSessions = sessions
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)
      .map((s) => ({
        id: s._id,
        name: s.name,
        status: s.status,
        totalStudents: s.totalStudents,
        avgEngagement: s.avgClassEngagement,
        createdAt: s.createdAt,
      }));

    res.status(200).json({
      success: true,
      summary: {
        totalSessions: sessions.length,
        completedSessions: completedSessions.length,
        processingSessions: sessions.filter((s) => s.status === 'processing').length,
        totalStudentsAnalyzed,
        overallAvgEngagement: Math.round(overallAvgEngagement * 100) / 100,
        recentSessions,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSummary };
