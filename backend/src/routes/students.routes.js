const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { uploadPhoto } = require('../middleware/upload.middleware');
const {
  registerStudent,
  getStudents,
  getStudent,
  deleteStudent,
  getEncodingStatus,
} = require('../controllers/students.controller');

// All routes protected — teacher must be logged in
router.use(protect);

router.get('/',           getStudents);
router.post('/register',  uploadPhoto, registerStudent);
router.get('/:id',        getStudent);
router.delete('/:id',     deleteStudent);
router.get('/:id/status', getEncodingStatus);

module.exports = router;
