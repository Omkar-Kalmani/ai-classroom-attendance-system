const path = require('path');
const fs   = require('fs');
const Session = require('../models/Session.model');
const Student = require('../models/Student.model');
const Report  = require('../models/Report.model');
const { createError } = require('../middleware/error.middleware');

// ─────────────────────────────────────────────────────────────
//  GET /api/sessions/:id/report/csv
//  Generate and stream a CSV attendance report
// ─────────────────────────────────────────────────────────────
const downloadCSV = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id, teacherId: req.teacher._id,
    });
    if (!session) return next(createError(404, 'Session not found.'));
    if (session.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Session not yet completed.' });
    }

    const students = await Student.find({ sessionId: session._id })
      .sort({ engagementScore: -1 });

    // ── Build CSV ──────────────────────────────────────────
    const rows = [];

    // Header
    rows.push([
      'Sr No',
      'Name / Label',
      'PRN',
      'Class',
      'Identified',
      'Engagement Score (%)',
      'Attendance Status',
      'Attentive Frames',
      'Total Frames',
      'Gaze Score (%)',
      'Head Pose Score (%)',
      'Eye Open Score (%)',
      'Face Visible Score (%)',
      'Body Orient Score (%)',
    ].join(','));

    // Data rows
    students.forEach((s, i) => {
      const sb = s.signalBreakdown || {};
      const pct = (v) => v != null ? Math.round(v * 100) : 0;
      rows.push([
        i + 1,
        `"${s.identified ? s.name : s.label}"`,
        `"${s.prn || 'N/A'}"`,
        `"${s.className || 'N/A'}"`,
        s.identified ? 'Yes' : 'No',
        s.engagementScore?.toFixed(2) ?? 0,
        s.attendanceStatus === 'present' ? 'Present' : 'Absent',
        s.attentiveFrames ?? 0,
        s.totalFrames ?? 0,
        pct(sb.gazeAvg),
        pct(sb.headPoseAvg),
        pct(sb.eyeOpenAvg),
        pct(sb.faceVisibleAvg),
        pct(sb.bodyOrientAvg),
      ].join(','));
    });

    // Summary rows at bottom
    const presentCount = students.filter(s => s.attendanceStatus === 'present').length;
    rows.push('');
    rows.push(`"Session Name","${session.name}"`);
    rows.push(`"Date","${new Date(session.createdAt).toLocaleDateString('en-IN')}"`);
    rows.push(`"Total Students","${students.length}"`);
    rows.push(`"Present","${presentCount}"`);
    rows.push(`"Absent","${students.length - presentCount}"`);
    rows.push(`"Attendance Rate","${students.length ? Math.round(presentCount/students.length*100) : 0}%"`);
    rows.push(`"Avg Engagement","${session.avgClassEngagement ?? 0}%"`);
    rows.push(`"Generated","${new Date().toLocaleString('en-IN')}"`);

    const csv = rows.join('\n');
    const filename = `attendance_${session.name.replace(/[^a-z0-9]/gi,'_')}_${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/sessions/:id/report/pdf
//  Generate a professional PDF report using HTML → PDF
// ─────────────────────────────────────────────────────────────
const downloadPDF = async (req, res, next) => {
  try {
    const session = await Session.findOne({
      _id: req.params.id, teacherId: req.teacher._id,
    }).populate('teacherId', 'name institution');

    if (!session) return next(createError(404, 'Session not found.'));
    if (session.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Session not yet completed.' });
    }

    const students = await Student.find({ sessionId: session._id })
      .sort({ engagementScore: -1 });

    const report = await Report.findOne({ sessionId: session._id });

    const presentCount     = students.filter(s => s.attendanceStatus === 'present').length;
    const absentCount      = students.length - presentCount;
    const attendanceRate   = students.length ? Math.round(presentCount / students.length * 100) : 0;
    const identifiedCount  = students.filter(s => s.identified).length;

    // ── Build HTML ─────────────────────────────────────────
    const html = generatePDFHTML({
      session,
      students,
      report,
      presentCount,
      absentCount,
      attendanceRate,
      identifiedCount,
      teacher: session.teacherId,
    });

    // ── Convert HTML → PDF using Puppeteer ────────────────
    let pdfBuffer;
    try {
      const puppeteer = require('puppeteer');
      const browser   = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
      const page      = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdfBuffer = await page.pdf({
        format:            'A4',
        printBackground:   true,
        margin:            { top: '0', right: '0', bottom: '0', left: '0' },
      });
      await browser.close();
    } catch (puppeteerErr) {
      // Puppeteer not installed — send HTML as fallback
      console.warn('Puppeteer not available, sending HTML:', puppeteerErr.message);
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="report_${session._id}.html"`);
      return res.send(html);
    }

    const filename = `report_${session.name.replace(/[^a-z0-9]/gi,'_')}_${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);

  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────
//  generatePDFHTML
//  Builds a beautiful HTML document that gets converted to PDF
// ─────────────────────────────────────────────────────────────
const generatePDFHTML = ({ session, students, presentCount, absentCount, attendanceRate, identifiedCount, teacher }) => {
  const date = new Date(session.createdAt).toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const scoreColor = (score) =>
    score >= 70 ? '#10B981' : score >= 50 ? '#F59E0B' : '#EF4444';

  const studentRows = students.map((s, i) => {
    const present = s.attendanceStatus === 'present';
    const sb = s.signalBreakdown || {};
    const pct = (v) => v != null ? Math.round(v * 100) : 0;
    return `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'}">
        <td style="padding:10px 12px; color:#64748b; font-size:12px;">${i + 1}</td>
        <td style="padding:10px 12px;">
          <div style="font-weight:600; font-size:13px; color:#1e293b;">
            ${s.identified ? s.name : s.label}
          </div>
          ${s.prn ? `<div style="font-size:11px; color:#94a3b8; font-family:monospace;">${s.prn}</div>` : ''}
          ${s.className ? `<div style="font-size:11px; color:#94a3b8;">${s.className}</div>` : ''}
        </td>
        <td style="padding:10px 12px; text-align:center;">
          <span style="font-size:10px; padding:3px 8px; border-radius:20px; font-weight:600;
            background:${s.identified ? '#dbeafe' : '#f1f5f9'};
            color:${s.identified ? '#2563eb' : '#64748b'}">
            ${s.identified ? '✓ ID' : 'Unknown'}
          </span>
        </td>
        <td style="padding:10px 12px; text-align:center;">
          <span style="font-weight:700; font-size:14px; color:${scoreColor(s.engagementScore)}">
            ${s.engagementScore?.toFixed(1) ?? 0}%
          </span>
        </td>
        <td style="padding:10px 12px; text-align:center;">
          <span style="font-size:11px; padding:4px 10px; border-radius:20px; font-weight:600;
            background:${present ? '#dcfce7' : '#fee2e2'};
            color:${present ? '#16a34a' : '#dc2626'}">
            ${present ? 'Present' : 'Absent'}
          </span>
        </td>
        <td style="padding:10px 12px; text-align:center; font-size:12px; color:#475569;">
          ${pct(sb.gazeAvg)}%
        </td>
        <td style="padding:10px 12px; text-align:center; font-size:12px; color:#475569;">
          ${pct(sb.headPoseAvg)}%
        </td>
        <td style="padding:10px 12px; text-align:center; font-size:12px; color:#475569;">
          ${pct(sb.eyeOpenAvg)}%
        </td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #1e293b; }

    .header {
      background: linear-gradient(135deg, #1e3a5f 0%, #0f2044 100%);
      color: white;
      padding: 36px 48px;
      position: relative;
      overflow: hidden;
    }
    .header::after {
      content: '';
      position: absolute;
      right: -60px; top: -60px;
      width: 240px; height: 240px;
      border-radius: 50%;
      background: rgba(255,255,255,0.04);
    }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .logo { display: flex; align-items: center; gap: 12px; }
    .logo-icon {
      width: 44px; height: 44px; border-radius: 12px;
      background: linear-gradient(135deg, #3b82f6, #06b6d4);
      display: flex; align-items: center; justify-content: center;
      font-size: 20px;
    }
    .logo-text { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .logo-sub  { font-size: 11px; opacity: 0.6; margin-top: 2px; }
    .badge {
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 20px; padding: 6px 14px;
      font-size: 11px; font-weight: 600;
    }
    .session-name { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 6px; }
    .session-meta { font-size: 13px; opacity: 0.7; }

    .stats-bar {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 20px 48px;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
    }
    .stat { text-align: center; }
    .stat-val { font-size: 26px; font-weight: 800; line-height: 1; letter-spacing: -1px; }
    .stat-lbl { font-size: 11px; color: #64748b; margin-top: 4px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }

    .content { padding: 32px 48px; }
    .section-title {
      font-size: 13px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 1px; color: #64748b;
      margin-bottom: 14px; padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }

    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    thead tr { background: #1e293b; }
    thead th {
      padding: 11px 12px; text-align: left;
      font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.5px;
      color: #94a3b8;
    }
    thead th:not(:first-child) { text-align: center; }
    tbody tr:hover { background: #f0f9ff !important; }
    tbody td { border-bottom: 1px solid #f1f5f9; }

    .footer {
      margin-top: 32px; padding: 20px 48px;
      background: #f8fafc; border-top: 1px solid #e2e8f0;
      display: flex; justify-content: space-between; align-items: center;
    }
    .footer-left { font-size: 11px; color: #94a3b8; }
    .footer-right { font-size: 11px; color: #94a3b8; text-align: right; }

    .info-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 12px; margin-bottom: 28px;
    }
    .info-card {
      background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 12px; padding: 16px;
    }
    .info-card-label { font-size: 11px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .info-card-value { font-size: 15px; font-weight: 700; color: #1e293b; }

    .engagement-bar-wrap { margin-top: 4px; background: #e2e8f0; border-radius: 4px; height: 4px; }
    .engagement-bar { height: 4px; border-radius: 4px; background: linear-gradient(90deg,#3b82f6,#06b6d4); }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="header-top">
      <div class="logo">
        <div class="logo-icon">👥</div>
        <div>
          <div class="logo-text">AttendAI</div>
          <div class="logo-sub">AI-Powered Attendance System</div>
        </div>
      </div>
      <div class="badge">Attendance Report</div>
    </div>
    <div class="session-name">${session.name}</div>
    <div class="session-meta">
      ${date}
      ${session.videoDurationSec ? ` &nbsp;·&nbsp; ${Math.round(session.videoDurationSec / 60)} min video` : ''}
      ${teacher?.institution ? ` &nbsp;·&nbsp; ${teacher.institution}` : ''}
    </div>
  </div>

  <!-- Stats bar -->
  <div class="stats-bar">
    <div class="stat">
      <div class="stat-val" style="color:#1e3a5f">${students.length}</div>
      <div class="stat-lbl">Total Students</div>
    </div>
    <div class="stat">
      <div class="stat-val" style="color:#16a34a">${presentCount}</div>
      <div class="stat-lbl">Present</div>
    </div>
    <div class="stat">
      <div class="stat-val" style="color:#dc2626">${absentCount}</div>
      <div class="stat-lbl">Absent</div>
    </div>
    <div class="stat">
      <div class="stat-val" style="color:#2563eb">${attendanceRate}%</div>
      <div class="stat-lbl">Attendance Rate</div>
    </div>
    <div class="stat">
      <div class="stat-val" style="color:#7c3aed">${session.avgClassEngagement ?? 0}%</div>
      <div class="stat-lbl">Avg Engagement</div>
    </div>
  </div>

  <!-- Content -->
  <div class="content">

    <!-- Session info -->
    <div class="section-title">Session Information</div>
    <div class="info-grid">
      <div class="info-card">
        <div class="info-card-label">Teacher</div>
        <div class="info-card-value">${teacher?.name || 'N/A'}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Institution</div>
        <div class="info-card-value">${teacher?.institution || 'N/A'}</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Face Recognition</div>
        <div class="info-card-value">${identifiedCount} of ${students.length} students identified</div>
      </div>
      <div class="info-card">
        <div class="info-card-label">Engagement Threshold</div>
        <div class="info-card-value">${session.engagementThreshold ?? 70}% (to be marked Present)</div>
      </div>
    </div>

    <!-- Attendance table -->
    <div class="section-title">Student Attendance Detail</div>
    <table>
      <thead>
        <tr>
          <th style="width:40px">#</th>
          <th style="text-align:left">Student</th>
          <th>ID Status</th>
          <th>Engagement</th>
          <th>Attendance</th>
          <th>Gaze</th>
          <th>Head Pose</th>
          <th>Eye Open</th>
        </tr>
      </thead>
      <tbody>${studentRows}</tbody>
    </table>

    <!-- Engagement scale legend -->
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:16px; margin-bottom:24px;">
      <div class="section-title" style="margin-bottom:10px;">Engagement Scale</div>
      <div style="display:flex; gap:24px; font-size:12px;">
        <div style="display:flex; align-items:center; gap:6px;">
          <div style="width:12px;height:12px;border-radius:50%;background:#10B981"></div>
          <span>High (≥ 70%) — Present</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <div style="width:12px;height:12px;border-radius:50%;background:#F59E0B"></div>
          <span>Medium (50–69%) — Absent</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <div style="width:12px;height:12px;border-radius:50%;background:#EF4444"></div>
          <span>Low (&lt; 50%) — Absent</span>
        </div>
      </div>
    </div>

  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      Generated by AttendAI &nbsp;·&nbsp; ${new Date().toLocaleString('en-IN')}
    </div>
    <div class="footer-right">
      AI Signals: Gaze (35%) + Head Pose (30%) + Eye Open (20%) + Face (10%) + Body (5%)
    </div>
  </div>

</body>
</html>`;
};

module.exports = { downloadPDF, downloadCSV };
