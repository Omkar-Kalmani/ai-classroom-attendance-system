const path = require('path');
const fs = require('fs');
const Session = require('../models/Session.model');
const Student = require('../models/Student.model');
const Report = require('../models/Report.model');
const { createError } = require('../middleware/error.middleware');
const aiService = require('../services/ai.service');
const socketService = require('../services/socket.service');

// ─────────────────────────────────────────────────────────────
//  GET /api/sessions   (protected)
//  Return all sessions for the logged-in teacher (newest first)
// ─────────────────────────────────────────────────────────────
const getAllSessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({ teacherId: req.teacher._id })
      .sort({ createdAt: -1 })    // Newest first
      .select('-__v');             // Exclude Mongoose version key

    res.status(200).json({
      success: true,
      count: sessions.length,
      sessions,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/sessions   (protected)
//  Create a new session + save the uploaded video
// ─────────────────────────────────────────────────────────────
const createSession = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Session name is required.',
      });
    }

    // req.file is populated by Multer upload middleware
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Video file is required.',
      });
    }

    const session = await Session.create({
      teacherId: req.teacher._id,
      name: name.trim(),
      videoPath: req.file.path,
      videoName: req.file.originalname,
      videoSize: req.file.size,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: 'Session created. Ready to process.',
      session,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/sessions/:id   (protected)
//  Get single session details
// ─────────────────────────────────────────────────────────────
const getSession = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      teacherId: req.teacher._id,     // Ensure teacher owns this session
    });

    if (!session) {
      return next(createError(404, 'Session not found.'));
    }

    res.status(200).json({ success: true, session });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/sessions/:id/status   (protected)
//  Lightweight endpoint — just returns status + progress
//  Frontend can poll this every few seconds as fallback
// ─────────────────────────────────────────────────────────────
const getSessionStatus = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      teacherId: req.teacher._id,
    }).select('status processingProgress totalStudents avgClassEngagement errorMessage');

    if (!session) {
      return next(createError(404, 'Session not found.'));
    }

    res.status(200).json({ success: true, ...session.toObject() });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/sessions/:id/process   (protected)
//  Trigger AI processing for this session
// ─────────────────────────────────────────────────────────────
const processSession = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      teacherId: req.teacher._id,
    });

    if (!session) return next(createError(404, 'Session not found.'));

    // Prevent re-processing if already running or done
    if (session.status === 'processing') {
      return res.status(400).json({
        success: false,
        message: 'This session is already being processed.',
      });
    }

    if (session.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'This session has already been processed. Delete it to reprocess.',
      });
    }

    if (!session.videoPath || !fs.existsSync(session.videoPath)) {
      return res.status(400).json({
        success: false,
        message: 'Video file not found. Please re-upload.',
      });
    }

    // ── Update status to processing ────────────────────────
    session.status = 'processing';
    session.processingProgress = 0;
    await session.save();

    // ── Respond immediately (don't wait for AI) ────────────
    res.status(200).json({
      success: true,
      message: 'Processing started. Watch progress via WebSocket.',
      sessionId: session._id,
    });

    // ── Call AI service in background ──────────────────────
    // This runs AFTER the response is sent (non-blocking)
    aiService.processVideo({
      sessionId: session._id.toString(),
      videoPath: path.resolve(session.videoPath),
      engagementThreshold: session.engagementThreshold,
      // Progress callback — emits Socket.IO event to teacher
      onProgress: (progress, studentsFound) => {
        // Update DB
        Session.findByIdAndUpdate(session._id, { processingProgress: progress }).exec();
        // Emit to frontend via WebSocket
        socketService.emitProgress(session._id.toString(), progress, studentsFound);
      },
      // Completion callback
      onComplete: async (results) => {
        await handleProcessingComplete(session._id, results);
      },
      // Error callback
      onError: async (errorMessage) => {
        await Session.findByIdAndUpdate(session._id, {
          status: 'failed',
          errorMessage,
        });
        socketService.emitError(session._id.toString(), errorMessage);
      },
    });

  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  handleProcessingComplete (internal helper)
//  Called by aiService when AI finishes processing
//  Saves all student data and updates session to 'completed'
// ─────────────────────────────────────────────────────────────
const handleProcessingComplete = async (sessionId, results) => {
  try {
    const { students, videoDurationSec } = results;

    // ── Save each student document ─────────────────────────
    const studentDocs = await Student.insertMany(
      students.map((s) => ({ ...s, sessionId }))
    );

    // ── Calculate class-level stats ────────────────────────
    const totalStudents = studentDocs.length;
    const avgClassEngagement =
      totalStudents > 0
        ? studentDocs.reduce((sum, s) => sum + s.engagementScore, 0) / totalStudents
        : 0;

    // ── Update session ─────────────────────────────────────
    await Session.findByIdAndUpdate(sessionId, {
      status: 'completed',
      processingProgress: 100,
      totalStudents,
      avgClassEngagement: Math.round(avgClassEngagement * 100) / 100,
      videoDurationSec,
      completedAt: new Date(),
    });

    // ── Create report document ─────────────────────────────
    const sorted = [...studentDocs].sort((a, b) => b.engagementScore - a.engagementScore);
    const topStudents = sorted.slice(0, 3).map((s) => ({
      trackId: s.trackId,
      label: s.label,
      engagementScore: s.engagementScore,
    }));
    const lowFocusStudents = sorted
      .filter((s) => s.attendanceStatus === 'absent')
      .map((s) => ({ trackId: s.trackId, label: s.label, engagementScore: s.engagementScore }));

    const presentCount = studentDocs.filter((s) => s.attendanceStatus === 'present').length;

    await Report.create({
      sessionId,
      summary: {
        totalStudents,
        presentCount,
        absentCount: totalStudents - presentCount,
        attendanceRate: totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 0,
        classEngagementAvg: Math.round(avgClassEngagement * 100) / 100,
      },
      topStudents,
      lowFocusStudents,
    });

    // ── Notify frontend via WebSocket ──────────────────────
    socketService.emitComplete(sessionId.toString(), {
      totalStudents,
      avgClassEngagement,
      presentCount,
    });

  } catch (err) {
    console.error('Error saving processing results:', err);
    await Session.findByIdAndUpdate(sessionId, {
      status: 'failed',
      errorMessage: 'Failed to save results. Please contact support.',
    });
  }
};

// ─────────────────────────────────────────────────────────────
//  DELETE /api/sessions/:id   (protected)
// ─────────────────────────────────────────────────────────────
const deleteSession = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      teacherId: req.teacher._id,
    });

    if (!session) return next(createError(404, 'Session not found.'));

    // Delete the video file from disk
    if (session.videoPath && fs.existsSync(session.videoPath)) {
      fs.unlinkSync(session.videoPath);
    }

    // Delete all related students and the report
    await Student.deleteMany({ sessionId: session._id });
    await Report.deleteOne({ sessionId: session._id });
    await session.deleteOne();

    res.status(200).json({ success: true, message: 'Session deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllSessions,
  createSession,
  getSession,
  getSessionStatus,
  processSession,
  deleteSession,
};
