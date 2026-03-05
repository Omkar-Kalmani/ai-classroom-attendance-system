const path = require('path');
const fs = require('fs');
const Session = require('../models/Session.model');
const Student = require('../models/Student.model');
const Report = require('../models/Report.model');
const StudentRegister = require('../models/StudentRegister.model');
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

    res.status(200).json({ success: true, count: sessions.length, sessions });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  POST /api/sessions
// ─────────────────────────────────────────────────────────────
const createSession = async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ success: false, message: 'Session name is required.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Video file is required.' });
    }

    const session = await Session.create({
      teacherId:           req.teacher._id,
      name:                name.trim(),
      videoPath:           req.file.path,
      videoName:           req.file.originalname,
      videoSize:           req.file.size,
      status:              'pending',
      engagementThreshold: parseInt(process.env.ENGAGEMENT_THRESHOLD) || 70,
    });

    console.log(`📁 Session created: ${session._id}`);

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
//  GET /api/sessions/:id
// ─────────────────────────────────────────────────────────────
const getSession = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id, teacherId: req.teacher._id,
    });
    if (!session) return next(createError(404, 'Session not found.'));
    res.status(200).json({ success: true, session });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/sessions/:id/status
// ─────────────────────────────────────────────────────────────
const getSessionStatus = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id, teacherId: req.teacher._id,
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
//  Now fetches registered students and sends to Python
// ─────────────────────────────────────────────────────────────
const processSession = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id, teacherId: req.teacher._id,
    });

    if (!session) return next(createError(404, 'Session not found.'));

    if (session.status === 'processing') {
      return res.status(400).json({ success: false, message: 'Already processing.' });
    }

    if (session.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Already completed. Delete to reprocess.' });
    }

    // ── Verify video file exists ───────────────────────────
    const videoPath = path.resolve(session.videoPath);
    if (!fs.existsSync(videoPath)) {
      return res.status(400).json({ success: false, message: 'Video file not found. Please re-upload.' });
    }

    // ── Fetch registered students with face encodings ──────
    // Only fetch students whose encoding is ready
    const registeredStudents = await StudentRegister.find({
      teacherId:      req.teacher._id,
      encodingStatus: 'success',
    }).select('_id name prn className faceEncoding');

    console.log(`👥 Found ${registeredStudents.length} registered students with face encodings`);

    // ── Update session status ──────────────────────────────
    session.status             = 'processing';
    session.processingProgress = 0;
    session.errorMessage       = null;
    await session.save();

    // ── Respond immediately ────────────────────────────────
    res.status(200).json({
      success:            true,
      message:            `Processing started! ${registeredStudents.length} students registered for identification.`,
      sessionId:          session._id,
      registeredStudents: registeredStudents.length,
    });

    // ── Start AI processing in background ─────────────────
    aiService.processVideo({
      sessionId:          session._id.toString(),
      videoPath,
      engagementThreshold: session.engagementThreshold,
      registeredStudents: registeredStudents.map(s => ({
        _id:          s._id.toString(),
        name:         s.name,
        prn:          s.prn,
        className:    s.className,
        faceEncoding: s.faceEncoding,
      })),

      onProgress: async (progress, studentsFound) => {
        try {
          await Session.findByIdAndUpdate(session._id, { processingProgress: progress });
          socketService.emitProgress(session._id.toString(), progress, studentsFound);
        } catch (err) {
          console.error('Progress update error:', err.message);
        }
      },

      onComplete: async (results) => {
        await handleProcessingComplete(session._id, results, session.engagementThreshold);
      },

      onError: async (errorMessage) => {
        await Session.findByIdAndUpdate(session._id, { status: 'failed', errorMessage });
        socketService.emitError(session._id.toString(), errorMessage);
      },
    });

  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  handleProcessingComplete
//  Saves results to MongoDB after AI finishes
//  Now includes identified vs unknown student counts
// ─────────────────────────────────────────────────────────────
const handleProcessingComplete = async (sessionId, results, engagementThreshold) => {
  try {
    const { students, videoDurationSec } = results;

    console.log(`💾 Saving ${students.length} students for session ${sessionId}`);

    // ── Save student documents ─────────────────────────────
    const studentDocs = await Student.insertMany(
      students.map((s) => ({
        sessionId,
        trackId:          s.trackId,
        label:            s.label,
        // Face recognition fields
        name:             s.name        || null,
        prn:              s.prn         || null,
        className:        s.className   || null,
        studentDbId:      s.studentDbId || null,
        identified:       s.identified  || false,
        // Engagement fields
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
    const totalStudents    = studentDocs.length;
    const presentCount     = studentDocs.filter(s => s.attendanceStatus === 'present').length;
    const absentCount      = totalStudents - presentCount;
    const identifiedCount  = studentDocs.filter(s => s.identified).length;
    const unknownCount     = totalStudents - identifiedCount;
    const avgEngagement    = totalStudents > 0
      ? studentDocs.reduce((sum, s) => sum + s.engagementScore, 0) / totalStudents
      : 0;
    const attendanceRate   = totalStudents > 0
      ? Math.round((presentCount / totalStudents) * 100) : 0;

    // ── Update session ─────────────────────────────────────
    await Session.findByIdAndUpdate(sessionId, {
      status:             'completed',
      processingProgress: 100,
      totalStudents,
      avgClassEngagement: Math.round(avgEngagement * 100) / 100,
      videoDurationSec,
      completedAt:        new Date(),
    });

    // ── Create report ──────────────────────────────────────
    const sorted = [...studentDocs].sort((a, b) => b.engagementScore - a.engagementScore);

    await Report.create({
      sessionId,
      summary: {
        totalStudents,
        presentCount,
        absentCount,
        attendanceRate,
        classEngagementAvg: Math.round(avgEngagement * 100) / 100,
        identifiedCount,
        unknownCount,
      },
      topStudents: sorted.slice(0, 3).map(s => ({
        trackId:         s.trackId,
        label:           s.label,
        name:            s.name,
        prn:             s.prn,
        engagementScore: s.engagementScore,
      })),
      lowFocusStudents: sorted
        .filter(s => s.attendanceStatus === 'absent')
        .map(s => ({
          trackId:         s.trackId,
          label:           s.label,
          name:            s.name,
          prn:             s.prn,
          engagementScore: s.engagementScore,
        })),
    });

    // ── Notify frontend via Socket.IO ──────────────────────
    socketService.emitComplete(sessionId.toString(), {
      totalStudents,
      avgClassEngagement: Math.round(avgEngagement * 100) / 100,
      presentCount,
      absentCount,
      identifiedCount,
      unknownCount,
    });

    console.log(`✅ Session ${sessionId} complete!`);
    console.log(`   Present: ${presentCount}/${totalStudents} | Identified: ${identifiedCount}/${totalStudents}`);

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
      _id: req.params.id, teacherId: req.teacher._id,
    });
    if (!session) return next(createError(404, 'Session not found.'));

    if (session.videoPath && fs.existsSync(session.videoPath)) {
      fs.unlinkSync(session.videoPath);
    }

    await Student.deleteMany({ sessionId: session._id });
    await Report.deleteOne({ sessionId: session._id });
    await session.deleteOne();

    res.status(200).json({ success: true, message: 'Session deleted.' });
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
