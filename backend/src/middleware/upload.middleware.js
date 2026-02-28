const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ─────────────────────────────────────────────────────────────
//  Ensure the uploads directory exists
// ─────────────────────────────────────────────────────────────
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ─────────────────────────────────────────────────────────────
//  Storage — where and how to save the file on disk
// ─────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-originalname
    // e.g. "1709123456789-classroom-video.mp4"
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, uniqueName);
  },
});

// ─────────────────────────────────────────────────────────────
//  File filter — only allow video formats
// ─────────────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'video/mp4',
    'video/avi',
    'video/quicktime',    // .mov
    'video/x-matroska',   // .mkv
    'video/webm',
  ];

  const allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);   // Accept the file
  } else {
    cb(
      new Error('Invalid file type. Only MP4, AVI, MOV, MKV, and WEBM videos are allowed.'),
      false
    );
  }
};

// ─────────────────────────────────────────────────────────────
//  Multer instance
// ─────────────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: (parseInt(process.env.MAX_VIDEO_SIZE_MB) || 500) * 1024 * 1024, // Convert MB to bytes
  },
});

// ─────────────────────────────────────────────────────────────
//  Error handler specifically for Multer errors
//  Attach after upload middleware in routes
// ─────────────────────────────────────────────────────────────
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `File too large. Maximum size is ${process.env.MAX_VIDEO_SIZE_MB || 500}MB.`,
      });
    }
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }

  next();
};

module.exports = { upload, handleUploadError };
