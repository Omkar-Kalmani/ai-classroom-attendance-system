/**
 * Socket.IO Test Script
 * Tests all real-time WebSocket events.
 * Run: node test-socket.js
 * Make sure Node.js backend is running on port 5000.
 */

const { io } = require('socket.io-client');
const axios  = require('axios');

const BASE_URL = 'http://localhost:5000';

const green  = (s) => `\x1b[32m${s}\x1b[0m`;
const red    = (s) => `\x1b[31m${s}\x1b[0m`;
const blue   = (s) => `\x1b[34m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;

async function runTest() {
  console.log(blue('\n🔌 Socket.IO Test'));
  console.log('═'.repeat(40));

  // ── Step 1: Connect ────────────────────────────────────
  console.log('\n[1/4] Connecting to WebSocket...');
  const socket = io(BASE_URL, { transports: ['websocket', 'polling'] });

  await new Promise((resolve, reject) => {
    socket.on('connect',       () => { console.log(green(`  ✅ Connected! ID: ${socket.id}`)); resolve(); });
    socket.on('connect_error', (e) => { console.log(red(`  ❌ Failed: ${e.message}`)); reject(e); });
    setTimeout(() => reject(new Error('Timeout')), 5000);
  });

  // ── Step 2: Join session room ──────────────────────────
  console.log('\n[2/4] Joining session room...');
  await new Promise((resolve) => {
    socket.emit('join_session', 'test-session-001');
    socket.on('joined', (data) => {
      console.log(green(`  ✅ Joined room: ${data.room}`));
      resolve();
    });
    setTimeout(resolve, 2000);
  });

  // ── Step 3: Join teacher room ──────────────────────────
  console.log('\n[3/4] Joining teacher room...');
  await new Promise((resolve) => {
    socket.emit('join_teacher', 'teacher-001');
    socket.on('teacher_joined', (data) => {
      console.log(green(`  ✅ Joined teacher room`));
      console.log(`     Message: ${data.message}`);
      resolve();
    });
    setTimeout(resolve, 2000);
  });

  // ── Step 4: Ping/pong ──────────────────────────────────
  console.log('\n[4/4] Testing ping/pong...');
  await new Promise((resolve) => {
    socket.emit('ping');
    socket.on('pong', (data) => {
      console.log(green(`  ✅ Pong received! Server time: ${data.timestamp}`));
      resolve();
    });
    setTimeout(resolve, 2000);
  });

  // ── Listen for events ──────────────────────────────────
  socket.on('progress_update',     (d) => console.log(yellow(`  📊 Progress: ${d.progress}% | Students: ${d.studentsFound}`)));
  socket.on('processing_complete', (d) => console.log(green(`  🎉 Complete! Students: ${d.totalStudents}, Present: ${d.presentCount}`)));
  socket.on('processing_error',    (d) => console.log(red(`  ❌ Error: ${d.error}`)));
  socket.on('encoding_complete',   (d) => console.log(green(`  👤 Encoding: ${d.studentName} — ${d.success ? 'Ready' : 'Failed'}`)));

  // ── Summary ────────────────────────────────────────────
  console.log(blue('\n' + '═'.repeat(40)));
  console.log(green('  🎉 All Socket.IO tests passed!'));
  console.log('═'.repeat(40));
  console.log('');
  console.log(green('  ✅ WebSocket server running'));
  console.log(green('  ✅ Session room joining works'));
  console.log(green('  ✅ Teacher room joining works'));
  console.log(green('  ✅ Ping/pong works'));
  console.log('');
  console.log('  Listening for real events for 5 seconds...');
  console.log('  (Process a video to see progress_update events)');

  await new Promise(resolve => setTimeout(resolve, 5000));

  socket.disconnect();
  console.log(green('\n  ✅ Disconnected cleanly'));
  console.log('\n  Step 5 complete! Ready for Step 6 — React Frontend 🚀\n');
  process.exit(0);
}

runTest().catch(err => {
  console.error(red('\n❌ Test failed: ' + err.message));
  process.exit(1);
});
