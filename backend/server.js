require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const app = require('./src/app');
const connectDB = require('./src/config/db');
const socketService = require('./src/services/socket.service');
const aiService = require('./src/services/ai.service');

const PORT = process.env.PORT || 5000;

// ─────────────────────────────────────────────────────────────
//  Create HTTP server (needed to attach Socket.IO)
// ─────────────────────────────────────────────────────────────
const server = http.createServer(app);

// ─────────────────────────────────────────────────────────────
//  Initialize Socket.IO
// ─────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Pass io instance to the socket service
socketService.setIO(io);

// ─────────────────────────────────────────────────────────────
//  Socket.IO Event Handlers
// ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`🔌  Client connected: ${socket.id}`);

  // Teacher joins the room for their specific session
  // Frontend emits this right after starting processing
  socket.on('join_session', (sessionId) => {
    const room = `session_${sessionId}`;
    socket.join(room);
    console.log(`📺  Client ${socket.id} joined room: ${room}`);

    // Confirm to client that they joined successfully
    socket.emit('joined', { sessionId, room, message: 'Listening for updates...' });
  });

  socket.on('leave_session', (sessionId) => {
    socket.leave(`session_${sessionId}`);
  });

  socket.on('disconnect', () => {
    console.log(`🔌  Client disconnected: ${socket.id}`);
  });
});

// ─────────────────────────────────────────────────────────────
//  Start Server
// ─────────────────────────────────────────────────────────────
const startServer = async () => {
  // 1. Connect to MongoDB first
  await connectDB();

  // 2. Check if AI service is reachable (non-blocking)
  await aiService.checkHealth();

  // 3. Start HTTP server
  server.listen(PORT, () => {
    console.log('');
    console.log('🚀  ─────────────────────────────────────────────');
    console.log(`🚀  Classroom Attendance API running on port ${PORT}`);
    console.log(`🚀  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🚀  Frontend URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
    console.log(`🚀  AI Service:   ${process.env.AI_SERVICE_URL || 'http://localhost:8000'}`);
    console.log('🚀  ─────────────────────────────────────────────');
    console.log('');
  });
};

startServer();
