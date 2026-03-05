// ─────────────────────────────────────────────────────────────
//  Socket Service
//  Manages all real-time WebSocket communication.
//
//  Room naming convention: "session_<sessionId>"
//  Each session gets its own room so events don't cross sessions.
//
//  Events emitted by server:
//    → progress_update       fired every 5% during AI processing
//    → processing_complete   fired when AI finishes successfully
//    → processing_error      fired if AI fails
//    → encoding_complete     fired when student face encoding is ready
//    → status_update         general session status change
// ─────────────────────────────────────────────────────────────

let io;

const setIO = (socketIO) => {
  io = socketIO;
};

const getRoomName = (sessionId) => `session_${sessionId}`;

// ─────────────────────────────────────────────────────────────
//  emitProgress
//  Fired every 5% while AI is processing video.
//  Frontend updates progress bar with this.
// ─────────────────────────────────────────────────────────────
const emitProgress = (sessionId, progress, studentsFound = 0) => {
  if (!io) return;

  io.to(getRoomName(sessionId)).emit('progress_update', {
    sessionId,
    progress:      Math.min(100, Math.round(progress)),
    studentsFound,
    message:       `Analyzing video... ${Math.round(progress)}% complete`,
    timestamp:     new Date().toISOString(),
  });

  console.log(`📡 [Socket] Progress ${Math.round(progress)}% | Students: ${studentsFound} → session_${sessionId}`);
};

// ─────────────────────────────────────────────────────────────
//  emitComplete
//  Fired when processing finishes successfully.
//  Frontend hides progress bar and shows results.
// ─────────────────────────────────────────────────────────────
const emitComplete = (sessionId, stats) => {
  if (!io) return;

  io.to(getRoomName(sessionId)).emit('processing_complete', {
    sessionId,
    totalStudents:      stats.totalStudents,
    avgClassEngagement: stats.avgClassEngagement,
    presentCount:       stats.presentCount,
    absentCount:        stats.totalStudents - stats.presentCount,
    identifiedCount:    stats.identifiedCount || 0,   // How many were identified by name
    unknownCount:       stats.unknownCount    || 0,   // How many were "Unknown"
    reportReady:        true,
    message:            `✅ Done! ${stats.totalStudents} students found. ${stats.presentCount} present, ${stats.totalStudents - stats.presentCount} absent.`,
    timestamp:          new Date().toISOString(),
  });

  console.log(`📡 [Socket] Complete → session_${sessionId} | ${stats.totalStudents} students`);
};

// ─────────────────────────────────────────────────────────────
//  emitError
//  Fired if AI processing fails.
// ─────────────────────────────────────────────────────────────
const emitError = (sessionId, errorMessage) => {
  if (!io) return;

  io.to(getRoomName(sessionId)).emit('processing_error', {
    sessionId,
    error:     errorMessage,
    message:   '❌ Processing failed. Please try again.',
    timestamp: new Date().toISOString(),
  });

  console.log(`📡 [Socket] Error → session_${sessionId} | ${errorMessage}`);
};

// ─────────────────────────────────────────────────────────────
//  emitEncodingComplete
//  Fired when a student's face encoding finishes generating.
//  Frontend can update the student's status from "pending" to "ready"
// ─────────────────────────────────────────────────────────────
const emitEncodingComplete = (teacherId, studentId, studentName, success) => {
  if (!io) return;

  // Emit to teacher's personal room (not session room)
  io.to(`teacher_${teacherId}`).emit('encoding_complete', {
    studentId,
    studentName,
    success,
    message: success
      ? `✅ ${studentName}'s face registered successfully`
      : `❌ Failed to register ${studentName}'s face — please re-upload photo`,
    timestamp: new Date().toISOString(),
  });

  console.log(`📡 [Socket] Encoding ${success ? 'done' : 'failed'} → ${studentName}`);
};

// ─────────────────────────────────────────────────────────────
//  emitStatusUpdate
//  General session status change notification.
// ─────────────────────────────────────────────────────────────
const emitStatusUpdate = (sessionId, status) => {
  if (!io) return;

  io.to(getRoomName(sessionId)).emit('status_update', {
    sessionId,
    status,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  setIO,
  getRoomName,
  emitProgress,
  emitComplete,
  emitError,
  emitEncodingComplete,
  emitStatusUpdate,
};
