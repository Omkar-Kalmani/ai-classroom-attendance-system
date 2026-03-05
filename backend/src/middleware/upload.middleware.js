const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────────────────────
//  Upload Middleware
//  Handles both VIDEO uploads (sessions) and PHOTO uploads (students)
// ─────────────────────────────────────────────────────────────

// Ensure upload directories exist
const VIDEO_DIR = process.env.UPLOAD_DIR || 'uploads/videos';
const PHOTO_DIR = 'uploads/photos';
[VIDEO_DIR, PHOTO_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Video Storage ──────────────────────────────────────────
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, VIDEO_DIR),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});

const videoFilter = (req, file, cb) => {
  const allowed = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-matroska', 'video/webm'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only video files are allowed (mp4, avi, mov, mkv, webm)'), false);
  }
};

// ── Photo Storage ──────────────────────────────────────────
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PHOTO_DIR),
  filename:    (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `student-${unique}${ext}`);
  },
});

const photoFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPG and PNG photos are allowed'), false);
  }
};

// ── Multer instances ───────────────────────────────────────
const maxVideoSize = parseInt(process.env.MAX_VIDEO_SIZE_MB || 500) * 1024 * 1024;

const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFilter,
  limits: { fileSize: maxVideoSize },
}).single('video');

const uploadPhoto = multer({
  storage: photoStorage,
  fileFilter: photoFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max for photos
}).single('photo');

// ── Error wrapper ──────────────────────────────────────────
const handleUpload = (uploadFn) => (req, res, next) => {
  uploadFn(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: err.field === 'photo'
            ? 'Photo must be under 5MB.'
            : `Video must be under ${process.env.MAX_VIDEO_SIZE_MB || 500}MB.`,
        });
      }
      return res.status(400).json({ success: false, message: err.message });
    }
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
};

module.exports = {
  uploadVideo: handleUpload(uploadVideo),
  uploadPhoto: handleUpload(uploadPhoto),
};
