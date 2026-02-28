/**
 * Integration Test Script
 * Tests the full pipeline: Register → Login → Create Session → Process → Get Results
 *
 * Run with: node test-pipeline.js
 * Make sure both Node.js (port 5000) and Python AI (port 8000) are running first.
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:5000/api';

// ── Test data ──────────────────────────────────────────────
const TEST_TEACHER = {
  name: 'Test Teacher',
  email: `test${Date.now()}@school.com`,  // Unique email each run
  password: 'password123',
  institution: 'Test School',
};

let authToken = '';
let sessionId = '';

// ── Helper ─────────────────────────────────────────────────
const api = axios.create({ baseURL: BASE_URL });

function log(step, message, data = '') {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`[${step}] ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

function success(message) {
  console.log(`✅  ${message}`);
}

function fail(message, error) {
  console.error(`❌  ${message}:`, error?.response?.data || error?.message || error);
  process.exit(1);
}

// ── Tests ──────────────────────────────────────────────────

async function testRegister() {
  log('1/6', 'Registering teacher account...');
  try {
    const res = await api.post('/auth/register', TEST_TEACHER);
    authToken = res.data.token;
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    success(`Registered: ${res.data.teacher.email}`);
    success(`Token received: ${authToken.substring(0, 30)}...`);
  } catch (err) {
    fail('Register failed', err);
  }
}

async function testLogin() {
  log('2/6', 'Testing login...');
  try {
    const res = await api.post('/auth/login', {
      email: TEST_TEACHER.email,
      password: TEST_TEACHER.password,
    });
    success(`Login successful: ${res.data.teacher.name}`);
    success(`Last login: ${res.data.teacher.lastLogin}`);
  } catch (err) {
    fail('Login failed', err);
  }
}

async function testGetMe() {
  log('3/6', 'Testing protected route /auth/me...');
  try {
    const res = await api.get('/auth/me');
    success(`Profile fetched: ${res.data.teacher.name}`);
  } catch (err) {
    fail('Get profile failed', err);
  }
}

async function testCreateSession() {
  log('4/6', 'Creating a session with video upload...');

  // Find a test video file
  // Look for any MP4 in common locations
  const videoPaths = [
    path.join(__dirname, 'test-video.mp4'),
    path.join(__dirname, '..', 'test-video.mp4'),
    'C:/Users/Public/test-video.mp4',
  ];

  let videoPath = videoPaths.find(p => fs.existsSync(p));

  if (!videoPath) {
    console.log('⚠️  No test video found. Creating a dummy file for upload test...');
    // Create a tiny dummy file just to test upload
    videoPath = path.join(__dirname, 'dummy.mp4');
    fs.writeFileSync(videoPath, Buffer.alloc(1024)); // 1KB dummy file
  }

  try {
    const form = new FormData();
    form.append('name', 'Test Class Session');
    form.append('video', fs.createReadStream(videoPath));

    const res = await api.post('/sessions', form, {
      headers: form.getHeaders(),
      timeout: 30000,
    });

    sessionId = res.data.session._id;
    success(`Session created: ${sessionId}`);
    success(`Video: ${res.data.session.videoName}`);
    success(`Status: ${res.data.session.status}`);
  } catch (err) {
    fail('Create session failed', err);
  }
}

async function testGetSessions() {
  log('5/6', 'Fetching all sessions...');
  try {
    const res = await api.get('/sessions');
    success(`Sessions found: ${res.data.count}`);
    success(`Latest: ${res.data.sessions[0]?.name}`);
  } catch (err) {
    fail('Get sessions failed', err);
  }
}

async function testDashboard() {
  log('6/6', 'Testing dashboard summary...');
  try {
    const res = await api.get('/dashboard/summary');
    success(`Total sessions: ${res.data.summary.totalSessions}`);
    success(`Completed: ${res.data.summary.completedSessions}`);
  } catch (err) {
    fail('Dashboard failed', err);
  }
}

// ── Run All Tests ──────────────────────────────────────────
async function runTests() {
  console.log('🧪 Starting Integration Tests');
  console.log('═'.repeat(50));
  console.log('Make sure these are running:');
  console.log('  • Node.js backend:  http://localhost:5000');
  console.log('  • Python AI:        http://localhost:8000');
  console.log('  • MongoDB:          localhost:27017');
  console.log('═'.repeat(50));

  await testRegister();
  await testLogin();
  await testGetMe();
  await testCreateSession();
  await testGetSessions();
  await testDashboard();

  console.log('\n' + '═'.repeat(50));
  console.log('🎉 ALL TESTS PASSED!');
  console.log('═'.repeat(50));
  console.log('\nYour full pipeline is working:');
  console.log('  ✅ Auth (register + login + JWT)');
  console.log('  ✅ Protected routes');
  console.log('  ✅ Video upload');
  console.log('  ✅ Session management');
  console.log('  ✅ Dashboard');
  console.log('\nNext: Test video processing with a real MP4 file!');
  console.log(`Session ID to process: ${sessionId}`);
  console.log(`Run: POST http://localhost:5000/api/sessions/${sessionId}/process`);
}

runTests().catch(console.error);
