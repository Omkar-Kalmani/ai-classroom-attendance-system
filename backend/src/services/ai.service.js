const axios = require('axios');

// ─────────────────────────────────────────────────────────────
//  AI Service
//  Bridge between Node.js and Python FastAPI microservice.
//  Now sends registered students for face recognition.
// ─────────────────────────────────────────────────────────────

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const aiAxios = axios.create({
  baseURL: AI_SERVICE_URL,
  timeout: 3600000, // 1 hour for large videos
});

// ─────────────────────────────────────────────────────────────
//  processVideo
//  Sends video + registered students to Python AI service
// ─────────────────────────────────────────────────────────────
const processVideo = async ({
  sessionId,
  videoPath,
  engagementThreshold,
  registeredStudents = [],   // ← NEW: array of {_id, name, prn, faceEncoding}
  onProgress,
  onComplete,
  onError,
}) => {
  try {
    console.log(`🤖 Starting AI processing for session: ${sessionId}`);
    console.log(`📹 Video: ${videoPath}`);
    console.log(`👥 Registered students: ${registeredStudents.length}`);

    onProgress(5, 0);

    const response = await aiAxios.post('/api/ai/process', {
      session_id:           sessionId,
      video_path:           videoPath,
      engagement_threshold: engagementThreshold || 70,
      frame_score_threshold: parseFloat(process.env.FRAME_SCORE_THRESHOLD) || 0.6,
      processing_fps:       parseInt(process.env.PROCESSING_FPS) || 5,
      registered_students:  registeredStudents,  // ← Sent to Python for face recognition
    });

    const { data } = response;

    if (data.success && data.results) {
      console.log(`✅ AI processing complete: ${data.results.students.length} students`);
      onProgress(100, data.results.students.length);
      onComplete(data.results);
    } else {
      throw new Error(data.message || 'AI service returned no results');
    }

  } catch (error) {
    let message = 'AI processing failed';

    if (error.code === 'ECONNREFUSED') {
      message = 'AI service is not running. Please start the Python service.';
    } else if (error.code === 'ETIMEDOUT') {
      message = 'Processing timed out. Try a shorter video.';
    } else if (error.response?.data?.detail) {
      message = error.response.data.detail;
    } else if (error.message) {
      message = error.message;
    }

    console.error(`❌ AI error for session ${sessionId}:`, message);
    onError(message);
  }
};

// ─────────────────────────────────────────────────────────────
//  checkHealth
// ─────────────────────────────────────────────────────────────
const checkHealth = async () => {
  try {
    const response = await aiAxios.get('/api/ai/health', { timeout: 5000 });
    if (response.data.status === 'ok') {
      console.log('✅  AI service is reachable and healthy');
      return true;
    }
  } catch {
    console.warn('⚠️   AI service is not reachable. Start Python service before processing videos.');
    return false;
  }
};

module.exports = { processVideo, checkHealth };
