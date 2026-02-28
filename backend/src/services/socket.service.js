// ─────────────────────────────────────────────────────────────
//  Socket Service
//  Provides helper functions to emit Socket.IO events to the
//  correct session room.
//
//  The `io` instance is initialized in server.js and set here
//  via setIO() before any events are emitted.
// ─────────────────────────────────────────────────────────────

let io;   // Holds the Socket.IO server instance

// Called from server.js after Socket.IO is initialized
const setIO = (socketIO) => {
  io = socketIO;
};

// ─────────────────────────────────────────────────────────────
//  Room naming convention
//  Every session gets its own Socket.IO room: "session_<id>"
//  The frontend client joins this room after starting processing.
// ─────────────────────────────────────────────────────────────
const getRoomName = (sessionId) => `session_${sessionId}`;

// ─────────────────────────────────────────────────────────────
//  emitProgress
//  Broadcast processing progress to all clients watching a session
// ─────────────────────────────────────────────────────────────
const emitProgress = (sessionId, progress, studentsFound = 0) => {
  if (!io) return;
  io.to(getRoomName(sessionId)).emit('progress_update', {
    sessionId,
    progress: Math.round(progress),
    studentsFound,
    message: `Processing... ${Math.round(progress)}% complete`,
    timestamp: new Date().toISOString(),
  });
};

// ─────────────────────────────────────────────────────────────
//  emitComplete
//  Notify frontend that processing finished successfully
// ─────────────────────────────────────────────────────────────
const emitComplete = (sessionId, stats) => {
  if (!io) return;
  io.to(getRoomName(sessionId)).emit('processing_complete', {
    sessionId,
    totalStudents: stats.totalStudents,
    avgClassEngagement: stats.avgClassEngagement,
    presentCount: stats.presentCount,
    reportReady: true,
    message: 'Processing complete! Results are ready.',
    timestamp: new Date().toISOString(),
  });
};

// ─────────────────────────────────────────────────────────────
//  emitError
//  Notify frontend that processing failed
// ─────────────────────────────────────────────────────────────
const emitError = (sessionId, errorMessage) => {
  if (!io) return;
  io.to(getRoomName(sessionId)).emit('processing_error', {
    sessionId,
    error: errorMessage,
    message: 'Processing failed. Please try again.',
    timestamp: new Date().toISOString(),
  });
};

module.exports = { setIO, emitProgress, emitComplete, emitError, getRoomName };
