const fs = require('fs');
const path = require('path');
const axios = require('axios');
const StudentRegister = require('../models/StudentRegister.model');
const { createError } = require('../middleware/error.middleware');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

// ─────────────────────────────────────────────────────────────
//  POST /api/students/register
//  Register one student with their photo
// ─────────────────────────────────────────────────────────────
const registerStudent = async (req, res, next) => {
  try {
    const { name, prn, className } = req.body;

    if (!name || !prn) {
      return res.status(400).json({
        success: false,
        message: 'Name and PRN are required.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Student photo is required.',
      });
    }

    // ── Check for duplicate PRN ────────────────────────────
    const existing = await StudentRegister.findOne({
      teacherId: req.teacher._id,
      prn: prn.trim(),
    });

    if (existing) {
      // Delete uploaded photo since we won't use it
      fs.unlinkSync(req.file.path);
      return res.status(409).json({
        success: false,
        message: `Student with PRN ${prn} already registered.`,
      });
    }

    // ── Save student to DB first ───────────────────────────
    const student = await StudentRegister.create({
      teacherId:      req.teacher._id,
      name:           name.trim(),
      prn:            prn.trim(),
      className:      className?.trim() || '',
      photoPath:      req.file.path,
      encodingStatus: 'pending',
    });

    // ── Ask Python to generate face encoding ───────────────
    // This runs async — don't block the response
    generateFaceEncoding(student._id, req.file.path);

    res.status(201).json({
      success: true,
      message: `${name} registered. Face encoding being generated...`,
      student: {
        _id:            student._id,
        name:           student.name,
        prn:            student.prn,
        className:      student.className,
        encodingStatus: student.encodingStatus,
      },
    });

  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  generateFaceEncoding — background job
//  Calls Python to extract 128-number face fingerprint
// ─────────────────────────────────────────────────────────────
const generateFaceEncoding = async (studentId, photoPath) => {
  try {
    const absolutePath = path.resolve(photoPath);

    const response = await axios.post(
      `${AI_SERVICE_URL}/api/ai/encode-face`,
      { student_id: studentId.toString(), photo_path: absolutePath },
      { timeout: 30000 }
    );

    if (response.data.success) {
      await StudentRegister.findByIdAndUpdate(studentId, {
        faceEncoding:   response.data.encoding,
        encodingStatus: 'success',
      });
      console.log(`✅ Face encoding generated for student: ${studentId}`);
    } else {
      throw new Error(response.data.message || 'Encoding failed');
    }

  } catch (error) {
    console.error(`❌ Face encoding failed for ${studentId}:`, error.message);
    await StudentRegister.findByIdAndUpdate(studentId, {
      encodingStatus: 'failed',
      encodingError:  error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/students
//  Get all registered students for this teacher
// ─────────────────────────────────────────────────────────────
const getStudents = async (req, res, next) => {
  try {
    const students = await StudentRegister.find({ teacherId: req.teacher._id })
      .select('-faceEncoding -__v')  // Don't send 128 numbers to frontend
      .sort({ className: 1, name: 1 });

    res.status(200).json({
      success: true,
      count:   students.length,
      students,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/students/:id
// ─────────────────────────────────────────────────────────────
const getStudent = async (req, res, next) => {
  try {
    const student = await StudentRegister.findOne({
      _id:       req.params.id,
      teacherId: req.teacher._id,
    }).select('-faceEncoding -__v');

    if (!student) return next(createError(404, 'Student not found.'));

    res.status(200).json({ success: true, student });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  DELETE /api/students/:id
// ─────────────────────────────────────────────────────────────
const deleteStudent = async (req, res, next) => {
  try {
    const student = await StudentRegister.findOne({
      _id:       req.params.id,
      teacherId: req.teacher._id,
    });

    if (!student) return next(createError(404, 'Student not found.'));

    // Delete photo from disk
    if (student.photoPath && fs.existsSync(student.photoPath)) {
      fs.unlinkSync(student.photoPath);
    }

    await student.deleteOne();

    res.status(200).json({
      success: true,
      message: `${student.name} removed from register.`,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/students/:id/encoding-status
//  Frontend polls this to know when encoding is ready
// ─────────────────────────────────────────────────────────────
const getEncodingStatus = async (req, res, next) => {
  try {
    const student = await StudentRegister.findOne({
      _id:       req.params.id,
      teacherId: req.teacher._id,
    }).select('name prn encodingStatus encodingError');

    if (!student) return next(createError(404, 'Student not found.'));

    res.status(200).json({ success: true, student });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerStudent,
  getStudents,
  getStudent,
  deleteStudent,
  getEncodingStatus,
};
