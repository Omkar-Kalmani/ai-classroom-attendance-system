require('dotenv').config();

const http    = require('http');
const { Server } = require('socket.io');

const app           = require('./src/app');
const connectDB     = require('./src/config/db');
const socketService = require('./src/services/socket.service');
const aiService     = require('./src/services/ai.service');

const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────────────────────
//  Create HTTP server
// ─────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ─────────────────────────────────────────────────────────────
//  Initialize Socket.IO
// ─────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin:      process.env.CLIENT_URL || 'http://localhost:5173',
    methods:     ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout:  60000,
});

// Pass io instance to socket service
socketService.setIO(io);

// ─────────────────────────────────────────────────────────────
//  Socket.IO Event Handlers
// ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // ── Join session room ──────────────────────────────────
  // Frontend emits this after clicking "Process Video"
  // Server will emit progress_update events to this room
  socket.on('join_session', (data) => {
    const sessionId = typeof data === 'string' ? data : data?.sessionId;
    if (!sessionId) return;

    const room = socketService.getRoomName(sessionId);
    socket.join(room);
    console.log(`📺 ${socket.id} joined room: ${room}`);

    socket.emit('joined', {
      sessionId,
      room,
      message:   'Connected! Listening for processing updates...',
      timestamp: new Date().toISOString(),
    });
  });

  // ── Leave session room ─────────────────────────────────
  socket.on('leave_session', (data) => {
    const sessionId = typeof data === 'string' ? data : data?.sessionId;
    if (sessionId) {
      socket.leave(socketService.getRoomName(sessionId));
      console.log(`👋 ${socket.id} left session room: ${sessionId}`);
    }
  });

  // ── Join teacher personal room ─────────────────────────
  // Used for encoding_complete notifications
  // Frontend emits this after login
  socket.on('join_teacher', (data) => {
    const teacherId = typeof data === 'string' ? data : data?.teacherId;
    if (!teacherId) return;

    const room = `teacher_${teacherId}`;
    socket.join(room);
    console.log(`👨‍🏫 ${socket.id} joined teacher room: ${room}`);

    socket.emit('teacher_joined', {
      teacherId,
      message:   'Connected to your personal notification channel',
      timestamp: new Date().toISOString(),
    });
  });

  // ── Ping/pong health check ─────────────────────────────
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: new Date().toISOString() });
  });

  // ── Disconnect ─────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Disconnected: ${socket.id} | Reason: ${reason}`);
  });

  socket.on('error', (error) => {
    console.error(`Socket error from ${socket.id}:`, error);
  });
});

// ─────────────────────────────────────────────────────────────
//  Start Server
// ─────────────────────────────────────────────────────────────
const startServer = async () => {
  await connectDB();
  await aiService.checkHealth();

  server.listen(PORT, () => {
    console.log('');
    console.log('🚀 ─────────────────────────────────────────');
    console.log(`🚀  Server:      http://localhost:${PORT}`);
    console.log(`🚀  WebSocket:   ws://localhost:${PORT}`);
    console.log(`🚀  AI Service:  ${process.env.AI_SERVICE_URL || 'http://localhost:8000'}`);
    console.log(`🚀  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('🚀 ─────────────────────────────────────────');
    console.log('');
  });
};

startServer();
