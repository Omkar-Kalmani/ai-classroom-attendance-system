const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');
const Session = require('../models/Session.model');
const Student = require('../models/Student.model');
const Report = require('../models/Report.model');
const { createError } = require('../middleware/error.middleware');

// ─────────────────────────────────────────────────────────────
//  Helper: verify session ownership and completion
// ─────────────────────────────────────────────────────────────
const getVerifiedSession = async (sessionId, teacherId) => {
  const session = await Session.findOne({ _id: sessionId, teacherId });
  if (!session) throw createError(404, 'Session not found.');
  if (session.status !== 'completed') throw createError(400, 'Session not completed yet.');
  return session;
};

// ─────────────────────────────────────────────────────────────
//  GET /api/sessions/:id/report/pdf   (protected)
//  Generate and stream a PDF report
// ─────────────────────────────────────────────────────────────
const downloadPDF = async (req, res, next) => {
  try {
    const session = await getVerifiedSession(req.params.id, req.teacher._id);
    const report = await Report.findOne({ sessionId: session._id });
    const students = await Student.find({ sessionId: session._id })
      .sort({ engagementScore: -1 })
      .select('-frameTimeline -__v');

    // ── Set response headers for file download ─────────────
    const filename = `attendance-report-${session.name.replace(/\s+/g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // ── Create PDF document ────────────────────────────────
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    doc.pipe(res);   // Stream directly to the HTTP response

    // ── HEADER ─────────────────────────────────────────────
    doc.fontSize(22).fillColor('#0F2D5E').text('Classroom Attendance Report', { align: 'center' });
    doc.fontSize(12).fillColor('#6B7280').text(session.name, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#9CA3AF')
      .text(`Teacher: ${req.teacher.name}  |  Institution: ${req.teacher.institution || 'N/A'}`, { align: 'center' })
      .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });

    doc.moveDown(1);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#1D4ED8').lineWidth(2).stroke();
    doc.moveDown(1);

    // ── SUMMARY BOX ────────────────────────────────────────
    doc.fontSize(14).fillColor('#0F2D5E').text('Class Summary', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#374151');

    const s = report?.summary || {};
    const summaryLines = [
      `Total Students Detected: ${s.totalStudents || students.length}`,
      `Present (Engagement ≥ ${session.engagementThreshold}%): ${s.presentCount || 0}`,
      `Absent (Engagement < ${session.engagementThreshold}%): ${s.absentCount || 0}`,
      `Attendance Rate: ${s.attendanceRate || 0}%`,
      `Class Average Engagement: ${session.avgClassEngagement}%`,
      `Engagement Threshold Applied: ${session.engagementThreshold}%`,
    ];
    summaryLines.forEach((line) => doc.text(`• ${line}`));

    doc.moveDown(1.5);

    // ── TOP 3 STUDENTS ─────────────────────────────────────
    if (report?.topStudents?.length > 0) {
      doc.fontSize(14).fillColor('#15803D').text('🏆  Top 3 Most Attentive Students', { underline: true });
      doc.moveDown(0.5);
      report.topStudents.forEach((s, i) => {
        doc.fontSize(11).fillColor('#374151')
          .text(`${i + 1}. ${s.label}  —  ${s.engagementScore.toFixed(1)}% engagement`);
      });
      doc.moveDown(1.5);
    }

    // ── FULL ATTENDANCE TABLE ──────────────────────────────
    doc.fontSize(14).fillColor('#0F2D5E').text('Full Attendance Table', { underline: true });
    doc.moveDown(0.5);

    // Table header
    const colX = [50, 200, 340, 450];
    doc.fontSize(10).fillColor('#FFFFFF');
    doc.rect(50, doc.y, 495, 20).fill('#1D4ED8');
    const headerY = doc.y - 18;
    doc.fillColor('#FFFFFF')
      .text('Student', colX[0], headerY)
      .text('Engagement %', colX[1], headerY)
      .text('Status', colX[2], headerY)
      .text('Frames', colX[3], headerY);
    doc.moveDown(1.2);

    // Table rows
    students.forEach((student, i) => {
      const rowY = doc.y;
      const bgColor = i % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
      doc.rect(50, rowY - 4, 495, 18).fill(bgColor);

      const statusColor = student.attendanceStatus === 'present' ? '#15803D' : '#C2410C';
      doc.fontSize(9).fillColor('#374151')
        .text(student.label, colX[0], rowY)
        .text(`${student.engagementScore.toFixed(1)}%`, colX[1], rowY)
        .fillColor(statusColor)
        .text(student.attendanceStatus.toUpperCase(), colX[2], rowY)
        .fillColor('#374151')
        .text(student.totalFrames.toString(), colX[3], rowY);
      doc.moveDown(0.8);
    });

    doc.moveDown(1);

    // ── LOW FOCUS STUDENTS ─────────────────────────────────
    if (report?.lowFocusStudents?.length > 0) {
      doc.fontSize(14).fillColor('#C2410C').text('⚠️  Low Focus Students (Marked Absent)', { underline: true });
      doc.moveDown(0.5);
      report.lowFocusStudents.forEach((s) => {
        doc.fontSize(11).fillColor('#374151')
          .text(`• ${s.label}  —  ${s.engagementScore.toFixed(1)}% engagement (below threshold)`);
      });
    }

    // ── FOOTER ─────────────────────────────────────────────
    doc.moveDown(2);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E2E8F0').lineWidth(1).stroke();
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#9CA3AF')
      .text(`Session ID: ${session._id}  |  This report is auto-generated by the AI Classroom Attendance System`, { align: 'center' });

    doc.end();

  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/sessions/:id/report/csv   (protected)
//  Generate and download a CSV attendance file
// ─────────────────────────────────────────────────────────────
const downloadCSV = async (req, res, next) => {
  try {
    const session = await getVerifiedSession(req.params.id, req.teacher._id);
    const students = await Student.find({ sessionId: session._id })
      .sort({ engagementScore: -1 })
      .select('-frameTimeline -__v');

    // ── Build CSV rows ─────────────────────────────────────
    const csvData = students.map((s) => ({
      session_id: session._id.toString(),
      session_name: session.name,
      student_label: s.label,
      track_id: s.trackId,
      total_frames: s.totalFrames,
      attentive_frames: s.attentiveFrames,
      engagement_score: s.engagementScore.toFixed(2),
      attendance_status: s.attendanceStatus,
      gaze_score_avg: s.signalBreakdown.gazeAvg.toFixed(3),
      head_pose_avg: s.signalBreakdown.headPoseAvg.toFixed(3),
      eye_open_avg: s.signalBreakdown.eyeOpenAvg.toFixed(3),
      face_visible_avg: s.signalBreakdown.faceVisibleAvg.toFixed(3),
      body_orient_avg: s.signalBreakdown.bodyOrientAvg.toFixed(3),
    }));

    const parser = new Parser();
    const csv = parser.parse(csvData);

    const filename = `attendance-${session.name.replace(/\s+/g, '-')}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);

  } catch (error) {
    next(error);
  }
};

module.exports = { downloadPDF, downloadCSV };
