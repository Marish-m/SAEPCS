import {
  calculateStudentRisk,
  getDepartmentRiskAnalysis,
  recalculateAllStudentsRisk,
  getStudentRiskHistory as fetchStudentRiskHistory,
  resolveRiskRecord as markRiskRecordResolved,
} from '../services/riskAnalysisService.js';
import Student from '../models/Student.js';
import Parent from '../models/Parent.js';
import Notification from '../models/Notification.js';
import AcademicRisk from '../models/AcademicRisk.js';
import SystemConfig from '../models/SystemConfig.js';
import emailService from '../services/emailService.js';
import smsService from '../services/smsService.js';

// @desc    Get system-wide or department risk overview with summary counts & filtering
// @route   GET /api/risk/overview
// @access  Private (Admin, Faculty)
export const getRiskOverview = async (req, res, next) => {
  try {
    const { department, severity, riskType, search, sortBy = 'compositeRiskScore', sortOrder = 'desc' } = req.query;
    const analysis = await getDepartmentRiskAnalysis(department);

    let filteredReports = [...analysis.reports];

    // Filter by severity (High, Medium, Low)
    if (severity && severity !== 'All') {
      filteredReports = filteredReports.filter(
        (r) =>
          r.severity === severity ||
          r.riskLevel === severity ||
          (severity === 'High' && (r.riskLevel === 'Critical Risk' || r.severity === 'High')) ||
          (severity === 'Medium' && (r.riskLevel === 'Moderate Risk' || r.severity === 'Medium')) ||
          (severity === 'Low' && (r.riskLevel === 'Low Risk' || r.severity === 'Low'))
      );
    }

    // Filter by specific risk type
    if (riskType && riskType !== 'All') {
      filteredReports = filteredReports.filter((r) =>
        r.activeRisks?.some((ar) => ar.riskType === riskType)
      );
    }

    // Search by student name or rollNumber
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filteredReports = filteredReports.filter(
        (r) =>
          r.student.name.toLowerCase().includes(q) ||
          r.student.rollNumber.toLowerCase().includes(q)
      );
    }

    // Sorting
    filteredReports.sort((a, b) => {
      let valA, valB;
      if (sortBy === 'attendance') {
        valA = a.metrics?.attendancePercentage || 0;
        valB = b.metrics?.attendancePercentage || 0;
      } else if (sortBy === 'marks') {
        valA = a.metrics?.marksAveragePercentage || 0;
        valB = b.metrics?.marksAveragePercentage || 0;
      } else if (sortBy === 'missingAssignments') {
        valA = a.metrics?.missingAssignmentsCount || 0;
        valB = b.metrics?.missingAssignmentsCount || 0;
      } else if (sortBy === 'name') {
        valA = a.student.name.toLowerCase();
        valB = b.student.name.toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        valA = a.metrics?.compositeRiskScore || 0;
        valB = b.metrics?.compositeRiskScore || 0;
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    res.status(200).json({
      success: true,
      data: {
        summary: analysis.summary,
        reports: filteredReports,
        totalFiltered: filteredReports.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed risk analysis for a student including active risks and audit trail
// @route   GET /api/risk/student/:studentId
// @access  Private
export const getStudentRiskDetails = async (req, res, next) => {
  try {
    let studentId = req.params.studentId;

    let studentDoc = null;
    if (studentId.match(/^[0-9a-fA-F]{24}$/)) {
      studentDoc = await Student.findById(studentId);
      if (!studentDoc) {
        studentDoc = await Student.findOne({ user: studentId });
      }
    }
    if (!studentDoc) {
      studentDoc = await Student.findOne({ rollNumber: studentId });
    }

    if (!studentDoc) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    studentId = studentDoc._id;

    // Privacy authorization check
    if (req.user.role === 'student') {
      const myStudent = await Student.findOne({ user: req.user._id });
      if (!myStudent || myStudent._id.toString() !== studentId.toString()) {
        return res.status(403).json({ success: false, message: 'Forbidden access.' });
      }
    } else if (req.user.role === 'parent') {
      const parentDoc = await Parent.findOne({ user: req.user._id });
      if (!parentDoc || !parentDoc.students.some((s) => s.toString() === studentId.toString())) {
        return res.status(403).json({ success: false, message: 'Forbidden access to non-linked student.' });
      }
    }

    // Run real-time rule engine calculation
    const report = await calculateStudentRisk(studentId);

    // Fetch full history and audit logs
    const history = await fetchStudentRiskHistory(studentId);

    const activeRisks = history.filter((h) => h.status === 'Active' && h.riskType !== 'Composite');
    const resolvedRisks = history.filter((h) => (h.status === 'Resolved' || h.status === 'Closed') && h.riskType !== 'Composite');

    res.status(200).json({
      success: true,
      report,
      activeRisks,
      resolvedRisks,
      history,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get chronological risk history and complete audit trail for a student
// @route   GET /api/risk/history/:studentId
// @access  Private
export const getStudentRiskHistory = async (req, res, next) => {
  try {
    let studentId = req.params.studentId;

    let studentDoc = null;
    if (studentId.match(/^[0-9a-fA-F]{24}$/)) {
      studentDoc = await Student.findById(studentId);
    }
    if (!studentDoc) {
      studentDoc = await Student.findOne({ rollNumber: studentId });
    }
    if (!studentDoc) {
      studentDoc = await Student.findOne({ user: req.user._id });
    }

    if (!studentDoc) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    // Privacy check
    if (req.user.role === 'student') {
      const myStudent = await Student.findOne({ user: req.user._id });
      if (!myStudent || myStudent._id.toString() !== studentDoc._id.toString()) {
        return res.status(403).json({ success: false, message: 'Forbidden access.' });
      }
    } else if (req.user.role === 'parent') {
      const parentDoc = await Parent.findOne({ user: req.user._id });
      if (!parentDoc || !parentDoc.students.some((s) => s.toString() === studentDoc._id.toString())) {
        return res.status(403).json({ success: false, message: 'Forbidden access.' });
      }
    }

    const history = await fetchStudentRiskHistory(studentDoc._id);

    res.status(200).json({
      success: true,
      studentId: studentDoc._id,
      count: history.length,
      history,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Manually resolve or close an individual risk record
// @route   PUT /api/risk/:riskId/resolve
// @access  Private (Faculty, Admin)
export const resolveRisk = async (req, res, next) => {
  try {
    const { riskId } = req.params;
    const { notes } = req.body;

    const risk = await markRiskRecordResolved(riskId, req.user._id, notes);

    res.status(200).json({
      success: true,
      message: 'Risk record resolved and audit trail updated.',
      risk,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send alert notification to student's parent regarding academic risk
// @route   POST /api/risk/notify-parent/:studentId
// @access  Private (Faculty, Admin)
export const sendRiskAlertToParent = async (req, res, next) => {
  try {
    const studentId = req.params.studentId;
    const { customNote, channels = ['system', 'email', 'sms'] } = req.body;

    const student = await Student.findById(studentId)
      .populate('user', 'name rollNumber')
      .populate({
        path: 'parents',
        populate: { path: 'user' },
      });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    if (!student.parents || student.parents.length === 0 || !student.parents[0].user) {
      return res.status(400).json({
        success: false,
        message: 'No verified parent account is linked to this student.',
      });
    }

    const parentUser = student.parents[0].user;
    const riskReport = await calculateStudentRisk(student._id);

    const subject = `Urgent: Academic Performance & Attendance Alert for ${student.user.name}`;
    const message = `Dear Parent (${parentUser.name}),\n\nThis is an urgent academic intervention notice regarding ${student.user.name} (Roll: ${student.rollNumber}).\n\nAcademic Standing: ${riskReport.severity.toUpperCase()} RISK\nAttendance Rate: ${riskReport.metrics.attendancePercentage}%\nInternal Assessment Average: ${riskReport.metrics.marksAveragePercentage}%\nRisk Factors:\n- ${riskReport.riskFactors.join('\n- ')}\n\nRecommended Action: ${riskReport.recommendedAction}\n${customNote ? `\nFaculty Advisory Note: ${customNote}` : ''}\n\nPlease review your ward's dashboard on the SAEPCS portal.`;

    const notification = await Notification.create({
      recipient: parentUser._id,
      sender: req.user._id,
      title: subject,
      message,
      type: 'academic_risk',
      channel: 'all',
      deliveryStatus: { emailSent: false, smsSent: false },
    });

    let emailSent = false;
    let smsSent = false;

    if (channels.includes('email') && parentUser.email) {
      const emailRes = await emailService.sendEmail({
        to: parentUser.email,
        subject,
        text: message,
      });
      emailSent = emailRes.success;
      notification.deliveryStatus.emailSent = emailSent;
    }

    if (channels.includes('sms') && parentUser.phone) {
      const smsRes = await smsService.sendSMS({
        to: parentUser.phone,
        message: `SAEPCS Alert: Academic counseling alert for ${student.user.name}. Attendance: ${riskReport.metrics.attendancePercentage}%. Please inspect email or portal.`,
      });
      smsSent = smsRes.success;
      notification.deliveryStatus.smsSent = smsSent;
    }

    await notification.save();

    // Update AcademicRisk lastAlertSentAt & log in audit trail
    const compositeRisk = await AcademicRisk.findOne({ student: student._id, riskType: 'Composite' });
    if (compositeRisk) {
      compositeRisk.lastAlertSentAt = new Date();
      compositeRisk.auditTrail.push({
        action: 'ALERT_SENT',
        performedBy: req.user._id,
        timestamp: new Date(),
        notes: `Intervention notice dispatched to parent via ${channels.join(', ')}. ${customNote || ''}`,
      });
      await compositeRisk.save();
    }

    res.status(200).json({
      success: true,
      message: 'Parent alerted successfully via specified communication channels.',
      deliveryStatus: {
        system: true,
        email: emailSent,
        sms: smsSent,
      },
      notification,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get configurable academic risk threshold settings
// @route   GET /api/risk/settings
// @access  Private
export const getRiskSettings = async (req, res, next) => {
  try {
    const config = await SystemConfig.getRiskThresholds();
    res.status(200).json({
      success: true,
      settings: config,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update configurable academic risk threshold (Authorized Administrator)
// @route   PUT /api/risk/settings
// @access  Private (Admin only)
export const updateRiskSettings = async (req, res, next) => {
  try {
    const { attendanceThreshold, marksThreshold, missingAssignmentsThreshold, excessiveLeaveThreshold, description } = req.body;

    let config = await SystemConfig.findOne({ key: 'risk_policy' });
    if (!config) {
      config = new SystemConfig({ key: 'risk_policy' });
    }

    if (attendanceThreshold !== undefined) {
      const attThreshold = Number(attendanceThreshold);
      if (isNaN(attThreshold) || attThreshold < 1 || attThreshold > 100) {
        return res.status(400).json({
          success: false,
          message: 'Attendance threshold must be a number between 1 and 100.',
        });
      }
      config.attendanceThreshold = attThreshold;
    }

    if (marksThreshold !== undefined) {
      const mThreshold = Number(marksThreshold);
      if (!isNaN(mThreshold) && mThreshold >= 1 && mThreshold <= 100) {
        config.marksThreshold = mThreshold;
      }
    }

    if (missingAssignmentsThreshold !== undefined) {
      const assignThresh = Number(missingAssignmentsThreshold);
      if (!isNaN(assignThresh) && assignThresh >= 1 && assignThresh <= 20) {
        config.missingAssignmentsThreshold = assignThresh;
      }
    }

    if (excessiveLeaveThreshold !== undefined) {
      const leaveThresh = Number(excessiveLeaveThreshold);
      if (!isNaN(leaveThresh) && leaveThresh >= 1 && leaveThresh <= 60) {
        config.excessiveLeaveThreshold = leaveThresh;
      }
    }

    if (description) config.description = description;
    config.updatedBy = req.user._id;
    await config.save();

    // Re-evaluate all student risk records against the new thresholds
    const updatedReports = await recalculateAllStudentsRisk();

    res.status(200).json({
      success: true,
      message: `Risk policy updated. Re-evaluated ${updatedReports.length} student risk records.`,
      settings: config,
      recalculatedCount: updatedReports.length,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getRiskOverview,
  getStudentRiskDetails,
  getStudentRiskHistory,
  resolveRisk,
  sendRiskAlertToParent,
  getRiskSettings,
  updateRiskSettings,
};
