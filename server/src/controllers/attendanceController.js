import Attendance from '../models/Attendance.js';
import Student from '../models/Student.js';
import Subject from '../models/Subject.js';
import Faculty from '../models/Faculty.js';
import Parent from '../models/Parent.js';
import Notification from '../models/Notification.js';
import SystemConfig from '../models/SystemConfig.js';
import { calculateStudentRisk } from '../services/riskAnalysisService.js';
import emailService from '../services/emailService.js';
import smsService from '../services/smsService.js';
import notificationService from '../services/notificationService.js';

// Helper: Normalize date to YYYY-MM-DD
const formatDateStr = (dateInput) => {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  return d.toISOString().split('T')[0];
};

// @desc    Check if attendance has already been recorded for a subject + date
// @route   GET /api/attendance/check
// @access  Private (Faculty, Admin)
export const checkAttendanceSession = async (req, res, next) => {
  try {
    const { subject: subjectParam, date } = req.query;
    if (!subjectParam || !date) {
      return res.status(400).json({ success: false, message: 'Subject and date are required.' });
    }

    const dateStr = formatDateStr(date);

    let subjectDoc = null;
    if (subjectParam.match(/^[0-9a-fA-F]{24}$/)) {
      subjectDoc = await Subject.findById(subjectParam);
    } else {
      subjectDoc = await Subject.findOne({
        $or: [{ name: subjectParam }, { code: subjectParam }],
      });
    }

    if (!subjectDoc) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }

    const existingRecords = await Attendance.find({
      subject: subjectDoc._id,
      dateStr,
    })
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'name email rollNumber' },
      })
      .populate('faculty', 'employeeId')
      .populate('auditTrail.correctedBy', 'name email');

    res.status(200).json({
      success: true,
      isMarked: existingRecords.length > 0,
      count: existingRecords.length,
      dateStr,
      subject: { _id: subjectDoc._id, name: subjectDoc.name, code: subjectDoc.code },
      records: existingRecords,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark attendance (batch) - Prevents duplicate attendance entries
// @route   POST /api/attendance/mark
// @access  Private (Faculty, Admin)
export const markAttendance = async (req, res, next) => {
  try {
    const { records, subject: subjectIdentifier, date, semester, section } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Records array is required with student attendance data.',
      });
    }

    // Resolve subject ObjectId
    let subjectDoc = null;
    if (subjectIdentifier && subjectIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
      subjectDoc = await Subject.findById(subjectIdentifier);
    } else if (subjectIdentifier) {
      subjectDoc = await Subject.findOne({
        $or: [{ name: subjectIdentifier }, { code: subjectIdentifier }],
      });
    }

    if (!subjectDoc) {
      subjectDoc = await Subject.findOne(); // Fallback to first available subject
    }

    if (!subjectDoc) {
      return res.status(404).json({ success: false, message: 'No valid subject found.' });
    }

    // Resolve faculty document
    let facultyDoc = await Faculty.findOne({ user: req.user._id });
    if (!facultyDoc) {
      facultyDoc = await Faculty.findOne(); // Fallback if admin marks
    }

    const attendanceDate = date ? new Date(date) : new Date();
    const dateStr = formatDateStr(attendanceDate);

    // Duplicate Check: Prevent duplicate attendance entries for the same student, subject and date
    const studentIds = [];
    for (const item of records) {
      if (item.studentId) studentIds.push(item.studentId);
    }

    // Find all student docs
    const studentDocs = await Student.find({
      $or: [
        { _id: { $in: studentIds.filter((id) => id.match(/^[0-9a-fA-F]{24}$/)) } },
        { rollNumber: { $in: studentIds } },
      ],
    }).populate('user', 'name rollNumber');

    const studentMap = {};
    studentDocs.forEach((st) => {
      studentMap[st._id.toString()] = st;
      studentMap[st.rollNumber] = st;
    });

    const resolvedStudentIds = studentDocs.map((s) => s._id);

    // Check for existing records on this date for this subject
    const existingEntries = await Attendance.find({
      subject: subjectDoc._id,
      dateStr,
      student: { $in: resolvedStudentIds },
    }).populate({
      path: 'student',
      populate: { path: 'user', select: 'name' },
    });

    if (existingEntries.length > 0) {
      const duplicateNames = existingEntries
        .map((e) => e.student?.user?.name || e.student?.rollNumber || 'Student')
        .slice(0, 5)
        .join(', ');

      return res.status(409).json({
        success: false,
        message: `Duplicate attendance entry prevented: Attendance for ${subjectDoc.name} on ${dateStr} has already been recorded for ${existingEntries.length} student(s) (${duplicateNames}${existingEntries.length > 5 ? '...' : ''}). Please use Attendance Correction with an audit trail to make changes.`,
        duplicatesCount: existingEntries.length,
        dateStr,
        isDuplicate: true,
      });
    }

    // Load active config threshold
    const config = await SystemConfig.getRiskThresholds();
    const attendanceThreshold = config.attendanceThreshold || 75;

    const savedRecords = [];
    const alertNotifications = [];

    // Valid statuses include Present, Absent, and approved additional statuses (Late, Excused, On Duty)
    const validStatuses = ['Present', 'Absent', 'Late', 'Excused', 'On Duty'];

    for (const item of records) {
      const { studentId, status, remarks } = item;
      if (!studentId) continue;

      const student = studentMap[studentId];
      if (!student) continue;

      const normalizedStatus = validStatuses.includes(status) ? status : 'Present';

      const record = await Attendance.create({
        student: student._id,
        faculty: facultyDoc._id,
        subject: subjectDoc._id,
        date: attendanceDate,
        dateStr,
        status: normalizedStatus,
        remarks: remarks || '',
        semester: semester || student.semester || 1,
        section: section || student.section || 'A',
      });

      savedRecords.push(record);

      // Recalculate academic risk for this student
      const riskReport = await calculateStudentRisk(student._id);

      // Check if attendance is below configured threshold
      const isShortage = riskReport.metrics.attendancePercentage < attendanceThreshold;

      // Check frequent absences in past 14 days
      let frequentAbsences = false;
      if (normalizedStatus === 'Absent') {
        const past14Days = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const recentAbsencesCount = await Attendance.countDocuments({
          student: student._id,
          status: 'Absent',
          date: { $gte: past14Days },
        });
        if (recentAbsencesCount >= 3) {
          frequentAbsences = true;
        }
      }

      // If absent and attendance falls below threshold OR student is frequently absent, alert parents
      if (normalizedStatus === 'Absent' && (isShortage || frequentAbsences)) {
        const studentName = student.user?.name || student.rollNumber;
        const eventType = isShortage ? 'attendance_alert' : 'frequent_absent';
        const metricValue = `${riskReport.metrics.attendancePercentage}% Attendance`;
        const alertMsg = isShortage
          ? `Academic Alert: ${studentName}'s attendance has fallen to ${riskReport.metrics.attendancePercentage}% in ${subjectDoc.name}. Institution threshold mandates a minimum of ${attendanceThreshold}%.`
          : `Academic Alert: ${studentName} was absent today and has multiple recent absences in ${subjectDoc.name}.`;

        const dispatchResult = await notificationService.dispatchDirectParentNotification({
          studentId: student._id,
          eventType,
          title: `Attendance Notice: ${studentName} (${riskReport.metrics.attendancePercentage}%)`,
          message: alertMsg,
          metricValue,
          details: `Attendance in ${subjectDoc.name}: ${metricValue}`,
          recommendedAction: 'Please contact the faculty advisor to discuss attendance improvement.',
          facultyId: req.user?._id || facultyDoc.user,
        });

        if (dispatchResult.notification) {
          alertNotifications.push(dispatchResult.notification);
        }
      }
    }

    res.status(201).json({
      success: true,
      message: `Recorded ${savedRecords.length} attendance records for ${subjectDoc.name} on ${dateStr}.`,
      recordsCount: savedRecords.length,
      alertsTriggered: alertNotifications.length,
      dateStr,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate entry prevented: Attendance has already been recorded for this student, subject, and date.',
        isDuplicate: true,
      });
    }
    next(error);
  }
};

// @desc    Correct attendance with audit trail (Authorized Faculty / Admin)
// @route   PUT /api/attendance/correct/:id
// @access  Private (Faculty, Admin)
export const correctAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks, reason } = req.body;

    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A valid reason for attendance correction is required for the audit trail (minimum 3 characters).',
      });
    }

    const validStatuses = ['Present', 'Absent', 'Late', 'Excused', 'On Duty'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid attendance status. Allowed values: ${validStatuses.join(', ')}`,
      });
    }

    const record = await Attendance.findById(id)
      .populate('student')
      .populate('subject', 'name code')
      .populate('faculty');

    if (!record) {
      return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    }

    // Role check: Faculty can only correct if authorized or admin
    if (req.user.role === 'faculty') {
      const faculty = await Faculty.findOne({ user: req.user._id });
      // If needed, check if faculty teaches the subject or marked it
    }

    const previousStatus = record.status;
    const previousRemarks = record.remarks || '';
    const newRemarks = remarks !== undefined ? remarks : previousRemarks;

    // Append to audit trail
    record.auditTrail.push({
      previousStatus,
      newStatus: status,
      previousRemarks,
      newRemarks,
      correctedBy: req.user._id,
      correctedByName: req.user.name || 'Faculty',
      reason: reason.trim(),
      correctedAt: new Date(),
    });

    record.status = status;
    record.remarks = newRemarks;
    await record.save();

    // Recalculate academic risk for this student
    const riskReport = await calculateStudentRisk(record.student._id);

    const populatedRecord = await Attendance.findById(record._id)
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'name email rollNumber' },
      })
      .populate('subject', 'name code')
      .populate('faculty', 'employeeId')
      .populate('auditTrail.correctedBy', 'name email');

    res.status(200).json({
      success: true,
      message: `Attendance corrected from ${previousStatus} to ${status} with audit trail entry logged.`,
      record: populatedRecord,
      updatedAttendancePercentage: riskReport.metrics.attendancePercentage,
      riskLevel: riskReport.riskLevel,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get attendance records with filter & privacy enforcement
// @route   GET /api/attendance
// @access  Private
export const getAttendance = async (req, res, next) => {
  try {
    const { studentId, subject, startDate, endDate, status, semester, section } = req.query;
    const query = {};

    if (status) query.status = status;
    if (semester) query.semester = Number(semester);
    if (section) query.section = section;

    if (startDate || endDate) {
      query.dateStr = {};
      if (startDate) query.dateStr.$gte = formatDateStr(startDate);
      if (endDate) query.dateStr.$lte = formatDateStr(endDate);
    }

    if (subject) {
      if (subject.match(/^[0-9a-fA-F]{24}$/)) {
        query.subject = subject;
      } else {
        const subDoc = await Subject.findOne({
          $or: [{ name: subject }, { code: subject }],
        });
        if (subDoc) query.subject = subDoc._id;
      }
    }

    // Role-based privacy guard
    if (req.user.role === 'student') {
      const studentDoc = await Student.findOne({ user: req.user._id });
      if (!studentDoc) return res.status(200).json({ success: true, count: 0, records: [] });
      query.student = studentDoc._id;
    } else if (req.user.role === 'parent') {
      const parentDoc = await Parent.findOne({ user: req.user._id });
      if (!parentDoc || !parentDoc.students || parentDoc.students.length === 0) {
        return res.status(200).json({ success: true, count: 0, records: [] });
      }
      if (studentId && parentDoc.students.some((s) => s.toString() === studentId)) {
        query.student = studentId;
      } else {
        query.student = { $in: parentDoc.students };
      }
    } else if (studentId) {
      if (studentId.match(/^[0-9a-fA-F]{24}$/)) {
        query.student = studentId;
      } else {
        const st = await Student.findOne({ rollNumber: studentId });
        if (st) query.student = st._id;
      }
    }

    const records = await Attendance.find(query)
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'name email rollNumber' },
      })
      .populate('subject', 'name code')
      .populate({
        path: 'faculty',
        populate: { path: 'user', select: 'name designation' },
      })
      .populate('auditTrail.correctedBy', 'name email role')
      .sort({ dateStr: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get attendance summary for a student calculated from actual records
// @route   GET /api/attendance/summary/:studentId
// @access  Private
export const getAttendanceSummary = async (req, res, next) => {
  try {
    let studentId = req.params.studentId;

    // Resolve if rollNumber or user id
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
      return res.status(404).json({ success: false, message: 'Student not found.' });
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

    // Configurable threshold
    const config = await SystemConfig.getRiskThresholds();
    const attendanceThreshold = config.attendanceThreshold || 75;

    // Fetch actual attendance records from MongoDB
    const records = await Attendance.find({ student: studentId })
      .populate('subject', 'name code')
      .sort({ dateStr: 1 });

    const totalClasses = records.length;
    // Approved attended statuses: Present, Excused, On Duty
    const presentClasses = records.filter(
      (r) => r.status === 'Present' || r.status === 'Excused' || r.status === 'On Duty'
    ).length;
    const absentClasses = records.filter((r) => r.status === 'Absent').length;
    const lateClasses = records.filter((r) => r.status === 'Late').length;
    const excusedClasses = records.filter((r) => r.status === 'Excused').length;
    const onDutyClasses = records.filter((r) => r.status === 'On Duty').length;

    const overallPercentage =
      totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100 * 10) / 10 : 100;

    // Course-wise aggregation from actual records
    const subjectMap = {};
    records.forEach((r) => {
      const subKey = r.subject ? r.subject._id.toString() : 'unknown';
      const subName = r.subject ? r.subject.name : 'Unknown Subject';
      const subCode = r.subject ? r.subject.code : '';

      if (!subjectMap[subKey]) {
        subjectMap[subKey] = {
          subjectId: subKey,
          subject: subName,
          code: subCode,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          onDuty: 0,
        };
      }
      subjectMap[subKey].total += 1;
      if (r.status === 'Present' || r.status === 'Excused' || r.status === 'On Duty') {
        subjectMap[subKey].present += 1;
      }
      if (r.status === 'Absent') subjectMap[subKey].absent += 1;
      if (r.status === 'Late') subjectMap[subKey].late += 1;
      if (r.status === 'Excused') subjectMap[subKey].excused += 1;
      if (r.status === 'On Duty') subjectMap[subKey].onDuty += 1;
    });

    const subjectStats = Object.values(subjectMap).map((item) => {
      const percentage =
        item.total > 0 ? Math.round((item.present / item.total) * 100 * 10) / 10 : 100;
      return {
        ...item,
        percentage,
        isShortage: percentage < attendanceThreshold,
      };
    });

    res.status(200).json({
      success: true,
      summary: {
        studentId,
        totalClasses,
        presentClasses,
        absentClasses,
        lateClasses,
        excusedClasses,
        onDutyClasses,
        overallPercentage,
        attendanceThreshold,
        isShortage: overallPercentage < attendanceThreshold,
        subjectStats,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Display student-wise and subject-wise attendance history with filters
// @route   GET /api/attendance/history
// @access  Private (Faculty, Admin)
export const getAttendanceHistory = async (req, res, next) => {
  try {
    const { studentId, subject, startDate, endDate, status, semester } = req.query;
    const query = {};

    if (status) query.status = status;
    if (semester) query.semester = Number(semester);

    if (startDate || endDate) {
      query.dateStr = {};
      if (startDate) query.dateStr.$gte = formatDateStr(startDate);
      if (endDate) query.dateStr.$lte = formatDateStr(endDate);
    }

    if (subject) {
      if (subject.match(/^[0-9a-fA-F]{24}$/)) {
        query.subject = subject;
      } else {
        const subDoc = await Subject.findOne({
          $or: [{ name: subject }, { code: subject }],
        });
        if (subDoc) query.subject = subDoc._id;
      }
    }

    if (studentId) {
      if (studentId.match(/^[0-9a-fA-F]{24}$/)) {
        query.student = studentId;
      } else {
        const st = await Student.findOne({ rollNumber: studentId });
        if (st) query.student = st._id;
      }
    }

    const records = await Attendance.find(query)
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'name email rollNumber' },
      })
      .populate('subject', 'name code')
      .populate({
        path: 'faculty',
        populate: { path: 'user', select: 'name designation' },
      })
      .populate('auditTrail.correctedBy', 'name email role')
      .sort({ dateStr: -1 });

    // Grouping: Student-wise summary
    const studentAggregation = {};
    // Grouping: Subject-wise summary
    const subjectAggregation = {};

    const config = await SystemConfig.getRiskThresholds();
    const threshold = config.attendanceThreshold || 75;

    records.forEach((r) => {
      // Student-wise
      const sId = r.student ? r.student._id.toString() : 'unknown';
      const sName = r.student?.user?.name || r.student?.rollNumber || 'Student';
      const sRoll = r.student?.rollNumber || '';

      if (!studentAggregation[sId]) {
        studentAggregation[sId] = {
          studentId: sId,
          name: sName,
          rollNumber: sRoll,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          onDuty: 0,
          correctionsCount: 0,
        };
      }
      studentAggregation[sId].total += 1;
      if (r.status === 'Present' || r.status === 'Excused' || r.status === 'On Duty') {
        studentAggregation[sId].present += 1;
      }
      if (r.status === 'Absent') studentAggregation[sId].absent += 1;
      if (r.status === 'Late') studentAggregation[sId].late += 1;
      if (r.status === 'Excused') studentAggregation[sId].excused += 1;
      if (r.status === 'On Duty') studentAggregation[sId].onDuty += 1;
      if (r.auditTrail && r.auditTrail.length > 0) {
        studentAggregation[sId].correctionsCount += r.auditTrail.length;
      }

      // Subject-wise
      const subId = r.subject ? r.subject._id.toString() : 'unknown';
      const subName = r.subject ? r.subject.name : 'Unknown Subject';
      const subCode = r.subject ? r.subject.code : '';

      if (!subjectAggregation[subId]) {
        subjectAggregation[subId] = {
          subjectId: subId,
          name: subName,
          code: subCode,
          total: 0,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          onDuty: 0,
        };
      }
      subjectAggregation[subId].total += 1;
      if (r.status === 'Present' || r.status === 'Excused' || r.status === 'On Duty') {
        subjectAggregation[subId].present += 1;
      }
      if (r.status === 'Absent') subjectAggregation[subId].absent += 1;
      if (r.status === 'Late') subjectAggregation[subId].late += 1;
      if (r.status === 'Excused') subjectAggregation[subId].excused += 1;
      if (r.status === 'On Duty') subjectAggregation[subId].onDuty += 1;
    });

    const studentSummary = Object.values(studentAggregation).map((st) => ({
      ...st,
      percentage: st.total > 0 ? Math.round((st.present / st.total) * 100 * 10) / 10 : 100,
      isShortage: st.total > 0 && (st.present / st.total) * 100 < threshold,
    }));

    const subjectSummary = Object.values(subjectAggregation).map((sub) => ({
      ...sub,
      percentage: sub.total > 0 ? Math.round((sub.present / sub.total) * 100 * 10) / 10 : 100,
    }));

    res.status(200).json({
      success: true,
      totalRecords: records.length,
      records,
      studentSummary,
      subjectSummary,
      threshold,
    });
  } catch (error) {
    next(error);
  }
};
