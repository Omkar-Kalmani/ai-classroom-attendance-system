const axios = require('axios');

// ─────────────────────────────────────────────────────────────
//  AI Service
//  This module is the bridge between Node.js and the Python
//  FastAPI AI microservice running on port 8000.
//
//  Node.js never does any AI processing itself.
//  It just sends the video path to Python and handles callbacks.
// ─────────────────────────────────────────────────────────────

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// Axios instance with timeout for AI service calls
const aiAxios = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: 3600000,   // 1 hour — large videos can take a long time
});

// ─────────────────────────────────────────────────────────────
//  processVideo
//  Sends a POST request to the Python AI service to start processing.
//  The Python service will:
//    1. Extract frames from the video
//    2. Detect + track students
//    3. Score engagement per frame
//    4. Return final results
//
//  This function is called AFTER the HTTP response is sent to the
//  teacher's browser, so it runs in the background.
// ─────────────────────────────────────────────────────────────
const processVideo = async ({ sessionId, videoPath, engagementThreshold, onProgress, onComplete, onError }) => {
  try {
    console.log(`🤖 Sending video to AI service: session ${sessionId}`);

    // Call the Python AI microservice
    const response = await aiAxios.post('/api/ai/process', {
      session_id: sessionId,
      video_path: videoPath,
      engagement_threshold: engagementThreshold || 70,
      frame_score_threshold: 0.6,
      processing_fps: parseInt(process.env.PROCESSING_FPS) || 5,
    });

    const { data } = response;

    if (data.success) {
      console.log(`✅ AI processing complete for session ${sessionId}`);
      onComplete(data.results);
    } else {
      throw new Error(data.message || 'AI service returned an error');
    }

  } catch (error) {
    const message = error.response?.data?.message || error.message || 'AI service unavailable';
    console.error(`❌ AI service error for session ${sessionId}:`, message);
    onError(message);
  }
};

// ─────────────────────────────────────────────────────────────
//  checkHealth
//  Called on server startup to verify AI service is reachable.
//  If it fails, log a warning (don't crash — AI service might start later).
// ─────────────────────────────────────────────────────────────
const checkHealth = async () => {
  try {
    const response = await aiAxios.get('/api/ai/health', { timeout: 5000 });
    if (response.data.status === 'ok') {
      console.log('✅  AI service is reachable and healthy');
    }
  } catch {
    console.warn('⚠️   AI service is not reachable. Start it before processing videos.');
  }
};

module.exports = { processVideo, checkHealth };
