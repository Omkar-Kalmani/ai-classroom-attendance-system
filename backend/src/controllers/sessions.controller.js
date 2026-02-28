const path = require('path');
const fs = require('fs');
const Session = require('../models/Session.model');
const Student = require('../models/Student.model');
const Report = require('../models/Report.model');
const { createError } = require('../middleware/error.middleware');
const aiService = require('../services/ai.service');
const socketService = require('../services/socket.service');

// ─────────────────────────────────────────────────────────────
//  GET /api/sessions
// ─────────────────────────────────────────────────────────────
const getAllSessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({ teacherId: req.teacher._id })
      .sort({ createdAt: -1 })
      .select('-__v');

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
//  POST /api/sessions
//  Create session + upload video
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
      engagementThreshold: parseInt(process.env.ENGAGEMENT_THRESHOLD) || 70,
    });

    console.log(`📁 Session created: ${session._id} | Video: ${req.file.path}`);

    res.status(201).json({
      success: true,
      message: 'Session created successfully. Ready to process.',
      session,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/sessions/:id
// ─────────────────────────────────────────────────────────────
const getSession = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      teacherId: req.teacher._id,
    });

    if (!session) return next(createError(404, 'Session not found.'));

    res.status(200).json({ success: true, session });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/sessions/:id/status
//  Lightweight polling endpoint
// ─────────────────────────────────────────────────────────────
const getSessionStatus = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      teacherId: req.teacher._id,
    }).select('status processingProgress totalStudents avgClassEngagement errorMessage');

    if (!session) return next(createError(404, 'Session not found.'));

    res.status(200).json({ success: true, ...session.toObject() });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/sessions/:id/process
//  THE MAIN ENDPOINT — triggers full AI pipeline
// ─────────────────────────────────────────────────────────────
const processSession = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      teacherId: req.teacher._id,
    });

    if (!session) return next(createError(404, 'Session not found.'));

    // ── Guard against re-processing ────────────────────────
    if (session.status === 'processing') {
      return res.status(400).json({
        success: false,
        message: 'Session is already being processed.',
      });
    }

    if (session.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Session already processed. Delete it to reprocess.',
      });
    }

    // ── Verify video file exists ───────────────────────────
    const videoPath = path.resolve(session.videoPath);
    if (!fs.existsSync(videoPath)) {
      return res.status(400).json({
        success: false,
        message: 'Video file not found on server. Please re-upload.',
      });
    }

    // ── Update status to processing ────────────────────────
    session.status = 'processing';
    session.processingProgress = 0;
    session.errorMessage = null;
    await session.save();

    // ── Respond immediately to teacher ─────────────────────
    // Don't make teacher wait — processing happens in background
    res.status(200).json({
      success: true,
      message: 'Processing started! Watch live progress via WebSocket.',
      sessionId: session._id,
    });

    // ── Start AI processing in background ─────────────────
    // This runs AFTER the response is sent
    aiService.processVideo({
      sessionId: session._id.toString(),
      videoPath,
      engagementThreshold: session.engagementThreshold,

      // Called every 5% progress by AI service
      onProgress: async (progress, studentsFound) => {
        try {
          await Session.findByIdAndUpdate(session._id, {
            processingProgress: progress,
          });
          socketService.emitProgress(
            session._id.toString(),
            progress,
            studentsFound
          );
        } catch (err) {
          console.error('Progress update error:', err.message);
        }
      },

      // Called when AI finishes successfully
      onComplete: async (results) => {
        await handleProcessingComplete(session._id, results, session.engagementThreshold);
      },

      // Called if AI fails
      onError: async (errorMessage) => {
        await Session.findByIdAndUpdate(session._id, {
          status: 'failed',
          errorMessage,
        });
        socketService.emitError(session._id.toString(), errorMessage);
        console.error(`❌ Session ${session._id} failed:`, errorMessage);
      },
    });

  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  handleProcessingComplete
//  Saves all results to MongoDB after AI finishes
// ─────────────────────────────────────────────────────────────
const handleProcessingComplete = async (sessionId, results, engagementThreshold) => {
  try {
    const { students, videoDurationSec } = results;

    console.log(`💾 Saving results for session ${sessionId}...`);
    console.log(`   Students: ${students.length}`);

    // ── Save student documents ─────────────────────────────
    const studentDocs = await Student.insertMany(
      students.map((s) => ({
        sessionId,
        trackId:          s.trackId,
        label:            s.label,
        totalFrames:      s.totalFrames,
        attentiveFrames:  s.attentiveFrames,
        engagementScore:  s.engagementScore,
        attendanceStatus: s.attendanceStatus,
        signalBreakdown: {
          gazeAvg:        s.signalBreakdown?.gazeAvg        || 0,
          headPoseAvg:    s.signalBreakdown?.headPoseAvg    || 0,
          eyeOpenAvg:     s.signalBreakdown?.eyeOpenAvg     || 0,
          faceVisibleAvg: s.signalBreakdown?.faceVisibleAvg || 0,
          bodyOrientAvg:  s.signalBreakdown?.bodyOrientAvg  || 0,
        },
        frameTimeline: s.frameTimeline || [],
      }))
    );

    // ── Calculate class statistics ─────────────────────────
    const totalStudents = studentDocs.length;
    const presentCount  = studentDocs.filter((s) => s.attendanceStatus === 'present').length;
    const absentCount   = totalStudents - presentCount;
    const avgEngagement = totalStudents > 0
      ? studentDocs.reduce((sum, s) => sum + s.engagementScore, 0) / totalStudents
      : 0;
    const attendanceRate = totalStudents > 0
      ? Math.round((presentCount / totalStudents) * 100)
      : 0;

    // ── Update session to completed ────────────────────────
    await Session.findByIdAndUpdate(sessionId, {
      status:               'completed',
      processingProgress:   100,
      totalStudents,
      avgClassEngagement:   Math.round(avgEngagement * 100) / 100,
      videoDurationSec,
      completedAt:          new Date(),
    });

    // ── Create report ──────────────────────────────────────
    const sorted = [...studentDocs].sort((a, b) => b.engagementScore - a.engagementScore);

    const topStudents = sorted.slice(0, 3).map((s) => ({
      trackId:         s.trackId,
      label:           s.label,
      engagementScore: s.engagementScore,
    }));

    const lowFocusStudents = sorted
      .filter((s) => s.attendanceStatus === 'absent')
      .map((s) => ({
        trackId:         s.trackId,
        label:           s.label,
        engagementScore: s.engagementScore,
      }));

    await Report.create({
      sessionId,
      summary: {
        totalStudents,
        presentCount,
        absentCount,
        attendanceRate,
        classEngagementAvg: Math.round(avgEngagement * 100) / 100,
      },
      topStudents,
      lowFocusStudents,
    });

    // ── Notify frontend ────────────────────────────────────
    socketService.emitComplete(sessionId.toString(), {
      totalStudents,
      avgClassEngagement: Math.round(avgEngagement * 100) / 100,
      presentCount,
    });

    console.log(`✅ Session ${sessionId} complete!`);
    console.log(`   Present: ${presentCount}/${totalStudents} (${attendanceRate}%)`);
    console.log(`   Avg engagement: ${Math.round(avgEngagement)}%`);

  } catch (err) {
    console.error('❌ Error saving results:', err);
    await Session.findByIdAndUpdate(sessionId, {
      status:       'failed',
      errorMessage: 'Failed to save results: ' + err.message,
    });
    socketService.emitError(sessionId.toString(), 'Failed to save results.');
  }
};

// ─────────────────────────────────────────────────────────────
//  DELETE /api/sessions/:id
// ─────────────────────────────────────────────────────────────
const deleteSession = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id,
      teacherId: req.teacher._id,
    });

    if (!session) return next(createError(404, 'Session not found.'));

    // Delete video file from disk
    if (session.videoPath && fs.existsSync(session.videoPath)) {
      fs.unlinkSync(session.videoPath);
      console.log(`🗑️  Deleted video: ${session.videoPath}`);
    }

    // Delete all related data
    await Student.deleteMany({ sessionId: session._id });
    await Report.deleteOne({ sessionId: session._id });
    await session.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Session and all related data deleted.',
    });
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
