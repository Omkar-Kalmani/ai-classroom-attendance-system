const axios = require('axios');

// ─────────────────────────────────────────────────────────────
//  AI Service
//  Bridge between Node.js and Python FastAPI microservice.
//
//  Flow:
//    1. Node.js calls processVideo()
//    2. We POST to Python /api/ai/process
//    3. Python processes video (can take minutes)
//    4. Python returns results
//    5. We call onProgress during processing
//    6. We call onComplete with final results
// ─────────────────────────────────────────────────────────────

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const aiAxios = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: 3600000, // 1 hour timeout for large videos
});

// ─────────────────────────────────────────────────────────────
//  processVideo
//  Sends video to Python AI service and handles results.
//  Called AFTER HTTP response is sent — runs in background.
// ─────────────────────────────────────────────────────────────
const processVideo = async ({
  sessionId,
  videoPath,
  engagementThreshold,
  onProgress,
  onComplete,
  onError,
}) => {
  try {
    console.log(`🤖 Starting AI processing for session: ${sessionId}`);
    console.log(`📹 Video path: ${videoPath}`);

    // Simulate early progress so frontend shows activity immediately
    onProgress(5, 0);

    // ── Call Python AI service ─────────────────────────────
    const response = await aiAxios.post('/api/ai/process', {
      session_id: sessionId,
      video_path: videoPath,
      engagement_threshold: engagementThreshold || 70,
      frame_score_threshold: parseFloat(process.env.FRAME_SCORE_THRESHOLD) || 0.6,
      processing_fps: parseInt(process.env.PROCESSING_FPS) || 5,
    });

    const { data } = response;

    if (data.success && data.results) {
      console.log(`✅ AI processing complete for session: ${sessionId}`);
      console.log(`   Students found: ${data.results.students.length}`);
      onProgress(100, data.results.students.length);
      onComplete(data.results);
    } else {
      throw new Error(data.message || 'AI service returned no results');
    }

  } catch (error) {
    // Extract the most useful error message
    let message = 'AI processing failed';

    if (error.code === 'ECONNREFUSED') {
      message = 'AI service is not running. Please start the Python service.';
    } else if (error.code === 'ETIMEDOUT') {
      message = 'AI processing timed out. Try a shorter video.';
    } else if (error.response?.data?.detail) {
      message = error.response.data.detail;
    } else if (error.message) {
      message = error.message;
    }

    console.error(`❌ AI service error for session ${sessionId}:`, message);
    onError(message);
  }
};

// ─────────────────────────────────────────────────────────────
//  checkHealth
//  Called on server startup to verify AI service is reachable.
// ─────────────────────────────────────────────────────────────
const checkHealth = async () => {
  try {
    const response = await aiAxios.get('/api/ai/health', { timeout: 5000 });
    if (response.data.status === 'ok') {
      console.log('✅  AI service is reachable and healthy');
      return true;
    }
  } catch {
    console.warn('⚠️   AI service is not reachable. Start it before processing videos.');
    return false;
  }
};

module.exports = { processVideo, checkHealth };
