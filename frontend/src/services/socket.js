import { io } from 'socket.io-client';

// ─────────────────────────────────────────────────────────────
//  Socket Service
//  Manages the WebSocket connection to Node.js backend.
//  Used for real-time progress updates during video processing.
// ─────────────────────────────────────────────────────────────

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

// ── Connect to server ──────────────────────────────────────
export const connectSocket = () => {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  socket.on('connect',    () => console.log('🔌 Socket connected:', socket.id));
  socket.on('disconnect', () => console.log('🔌 Socket disconnected'));
  socket.on('error',      (e) => console.error('Socket error:', e));

  return socket;
};

// ── Disconnect ─────────────────────────────────────────────
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// ── Get socket instance ────────────────────────────────────
export const getSocket = () => socket;

// ── Join session room (for progress updates) ───────────────
export const joinSession = (sessionId) => {
  if (!socket) connectSocket();
  socket.emit('join_session', sessionId);
};

// ── Leave session room ─────────────────────────────────────
export const leaveSession = (sessionId) => {
  socket?.emit('leave_session', sessionId);
};

// ── Join teacher room (for encoding notifications) ─────────
export const joinTeacherRoom = (teacherId) => {
  if (!socket) connectSocket();
  socket.emit('join_teacher', teacherId);
};

// ── Listen for progress updates ────────────────────────────
export const onProgress = (callback) => {
  socket?.on('progress_update', callback);
  return () => socket?.off('progress_update', callback);
};

// ── Listen for processing complete ────────────────────────
export const onComplete = (callback) => {
  socket?.on('processing_complete', callback);
  return () => socket?.off('processing_complete', callback);
};

// ── Listen for processing error ────────────────────────────
export const onError = (callback) => {
  socket?.on('processing_error', callback);
  return () => socket?.off('processing_error', callback);
};

// ── Listen for face encoding complete ─────────────────────
export const onEncodingComplete = (callback) => {
  socket?.on('encoding_complete', callback);
  return () => socket?.off('encoding_complete', callback);
};
