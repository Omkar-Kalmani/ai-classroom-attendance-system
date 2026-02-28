const express = require('express');
const { protect } = require('../middleware/auth.middleware');
const { upload, handleUploadError } = require('../middleware/upload.middleware');
const {
  getAllSessions, createSession, getSession,
  getSessionStatus, processSession, deleteSession,
} = require('../controllers/sessions.controller');
const { getResults, getStudentDetail, getAnalytics } = require('../controllers/results.controller');
const { downloadPDF, downloadCSV } = require('../controllers/report.controller');

const router = express.Router();

// All routes below require a valid JWT token
router.use(protect);

router.get('/',    getAllSessions);
router.post('/',   upload.single('video'), handleUploadError, createSession);
router.get('/:id', getSession);
router.delete('/:id', deleteSession);

router.get('/:id/status',  getSessionStatus);
router.post('/:id/process', processSession);

router.get('/:id/results',              getResults);
router.get('/:id/results/:studentId',   getStudentDetail);
router.get('/:id/analytics',            getAnalytics);

router.get('/:id/report/pdf', downloadPDF);
router.get('/:id/report/csv', downloadCSV);

module.exports = router;
