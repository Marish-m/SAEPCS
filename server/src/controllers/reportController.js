import Student from '../models/Student.js';
import Attendance from '../models/Attendance.js';
import InternalMark from '../models/InternalMark.js';
import Assessment from '../models/Assessment.js';
import Assignment from '../models/Assignment.js';
import AssignmentSubmission from '../models/AssignmentSubmission.js';
import LeaveRequest from '../models/LeaveRequest.js';
import AcademicRisk from '../models/AcademicRisk.js';
import Notification from '../models/Notification.js';
import Department from '../models/Department.js';
import Subject from '../models/Subject.js';
import Parent from '../models/Parent.js';
import { calculateStudentRisk } from '../services/riskAnalysisService.js';

/**
 * Helper to enforce student / parent privacy access control
 * Returns { allowed: boolean, studentIds: Array<ObjectId> }
 */
const resolveAuthorizedStudentScope = async (user, requestedStudentId = null) => {
  if (user.role === 'admin' || user.role === 'faculty') {
    if (requestedStudentId) {
      return { allowed: true, studentIds: [requestedStudentId] };
    }
    return { allowed: true, studentIds: null }; // All students allowed
  }

  if (user.role === 'student') {
    const studentDoc = await Student.findOne({ user: user._id });
    if (!studentDoc) return { allowed: false, studentIds: [] };

    if (requestedStudentId && requestedStudentId.toString() !== studentDoc._id.toString()) {
      return { allowed: false, studentIds: [] };
    }
    return { allowed: true, studentIds: [studentDoc._id] };
  }

  if (user.role === 'parent') {
    const parentDoc = await Parent.findOne({ user: user._id });
    if (!parentDoc || !parentDoc.students || parentDoc.students.length === 0) {
      return { allowed: false, studentIds: [] };
    }

    const linkedIds = parentDoc.students.map((s) => s.toString());
    if (requestedStudentId) {
      if (!linkedIds.includes(requestedStudentId.toString())) {
        return { allowed: false, studentIds: [] };
      }
      return { allowed: true, studentIds: [requestedStudentId] };
    }
    return { allowed: true, studentIds: parentDoc.students };
  }

  return { allowed: false, studentIds: [] };
};

// ============================================================================
// 1. CONSOLIDATED STUDENT REPORT (PDF READY)
// ============================================================================
export const getStudentReport = async (req, res, next) => {
  try {
    const studentId = req.params.studentId;

    const authScope = await resolveAuthorizedStudentScope(req.user, studentId);
    if (!authScope.allowed) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view this student report.',
      });
    }

    const student = await Student.findById(studentId)
      .populate('user', 'name email phone')
      .populate('department', 'name code')
      .populate({
        path: 'parents',
        populate: { path: 'user', select: 'name email phone' },
      });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const [riskReport, attendanceRecords, marksRecords, leavesRecords, notifRecords, activeRisks] =
      await Promise.all([
        calculateStudentRisk(student._id),
        Attendance.find({ student: student._id }).populate('subject', 'name code').sort({ date: -1 }),
        InternalMark.find({ student: student._id }).populate('subject', 'name code').sort({ createdAt: -1 }),
        LeaveRequest.find({ student: student._id }).sort({ createdAt: -1 }),
        Notification.find({
          $or: [{ student: student._id }, { recipient: student.user._id }],
        }).sort({ createdAt: -1 }).limit(20),
        AcademicRisk.find({ student: student._id }).sort({ detectedDate: -1 }),
      ]);

    const assignments = await Assignment.find({
      department: student.department._id,
      semester: student.semester,
    }).populate('subject', 'name code');

    const assignmentReports = await Promise.all(
      assignments.map(async (a) => {
        const sub = await AssignmentSubmission.findOne({
          assignment: a._id,
          student: student._id,
        });

        const isPastDeadline = new Date(a.dueDate) < new Date();
        const status = sub
          ? sub.status
          : isPastDeadline
          ? 'Missing'
          : 'Pending';

        return {
          _id: a._id,
          title: a.title,
          subject: a.subject?.name || 'General',
          dueDate: a.dueDate,
          maxMarks: a.maxMarks,
          status,
          obtainedMarks: sub ? sub.obtainedMarks : null,
          feedback: sub ? sub.feedback : '',
          submittedAt: sub ? sub.submittedAt : null,
        };
      })
    );

    // Subject-wise Attendance Aggregation
    const subjectMap = {};
    attendanceRecords.forEach((att) => {
      const sName = att.subject?.name || 'General';
      if (!subjectMap[sName]) {
        subjectMap[sName] = { total: 0, present: 0 };
      }
      subjectMap[sName].total++;
      if (att.status === 'Present' || att.status === 'Excused') {
        subjectMap[sName].present++;
      }
    });

    const subjectStats = Object.keys(subjectMap).map((sName) => ({
      subject: sName,
      total: subjectMap[sName].total,
      present: subjectMap[sName].present,
      percentage:
        subjectMap[sName].total > 0
          ? Math.round((subjectMap[sName].present / subjectMap[sName].total) * 1000) / 10
          : 100,
    }));

    res.status(200).json({
      success: true,
      report: {
        student: {
          _id: student._id,
          name: student.user.name,
          rollNumber: student.rollNumber,
          department: student.department?.name || 'Department',
          semester: student.semester,
          section: student.section,
          email: student.user.email,
          phone: student.user.phone,
          parentName: student.parents?.[0]?.user?.name || 'Guardian',
          parentPhone: student.parents?.[0]?.user?.phone || '',
        },
        generatedAt: new Date().toISOString(),
        academicStanding: riskReport.riskLevel,
        compositeRiskScore: riskReport.metrics.compositeRiskScore,
        riskFactors: riskReport.riskFactors,
        recommendedAction: riskReport.recommendedAction,
        attendance: {
          totalClasses: riskReport.metrics.totalClasses,
          presentClasses: riskReport.metrics.presentClasses,
          overallPercentage: riskReport.metrics.attendancePercentage,
          attendanceThreshold: riskReport.metrics.attendanceThreshold,
          subjectStats,
          records: attendanceRecords.slice(0, 50),
        },
        marks: {
          averagePercentage: riskReport.metrics.marksAveragePercentage,
          records: marksRecords.map((m) => ({
            subject: m.subject?.name || 'Course',
            examType: m.examType,
            obtainedMarks: m.obtainedMarks,
            maxMarks: m.maxMarks,
            percentage: m.percentage,
          })),
        },
        assignments: assignmentReports,
        leaves: {
          totalDays: riskReport.metrics.approvedLeaveDays,
          records: leavesRecords,
        },
        academicRisks: activeRisks,
        notifications: notifRecords,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 2. ATTENDANCE REPORT BY DATE RANGE & SUBJECT
// ============================================================================
export const getAttendanceReport = async (req, res, next) => {
  try {
    const { studentId, subjectId, departmentId, startDate, endDate } = req.query;

    const authScope = await resolveAuthorizedStudentScope(req.user, studentId);
    if (!authScope.allowed) {
      return res.status(403).json({ success: false, message: 'Unauthorized student access.' });
    }

    const filter = {};

    if (authScope.studentIds) {
      filter.student = { $in: authScope.studentIds };
    } else if (departmentId) {
      const deptStudents = await Student.find({ department: departmentId }).select('_id');
      filter.student = { $in: deptStudents.map((s) => s._id) };
    }

    if (subjectId) {
      filter.subject = subjectId;
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }

    const records = await Attendance.find(filter)
      .populate('student')
      .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
      .populate('subject', 'name code')
      .sort({ date: 1 });

    const totalSessions = records.length;
    const presentCount = records.filter((r) => r.status === 'Present' || r.status === 'Excused').length;
    const absentCount = records.filter((r) => r.status === 'Absent').length;
    const excusedCount = records.filter((r) => r.status === 'Excused').length;
    const overallPercentage =
      totalSessions > 0 ? Math.round((presentCount / totalSessions) * 1000) / 10 : 100;

    // Monthly Trend Series for Chart.js
    const monthlyMap = {};
    records.forEach((r) => {
      const monthYear = new Date(r.date).toLocaleString('en-US', { month: 'short' });
      if (!monthlyMap[monthYear]) {
        monthlyMap[monthYear] = { total: 0, present: 0 };
      }
      monthlyMap[monthYear].total++;
      if (r.status === 'Present' || r.status === 'Excused') {
        monthlyMap[monthYear].present++;
      }
    });

    const chartTrend = {
      labels: Object.keys(monthlyMap),
      values: Object.keys(monthlyMap).map((m) =>
        Math.round((monthlyMap[m].present / monthlyMap[m].total) * 100)
      ),
    };

    // Subject Breakdown
    const subjectBreakdown = {};
    records.forEach((r) => {
      const sName = r.subject?.name || 'General';
      if (!subjectBreakdown[sName]) {
        subjectBreakdown[sName] = { total: 0, present: 0, absent: 0 };
      }
      subjectBreakdown[sName].total++;
      if (r.status === 'Present' || r.status === 'Excused') {
        subjectBreakdown[sName].present++;
      } else {
        subjectBreakdown[sName].absent++;
      }
    });

    const subjectStats = Object.keys(subjectBreakdown).map((s) => ({
      subject: s,
      total: subjectBreakdown[s].total,
      present: subjectBreakdown[s].present,
      absent: subjectBreakdown[s].absent,
      percentage: Math.round((subjectBreakdown[s].present / subjectBreakdown[s].total) * 100),
    }));

    res.status(200).json({
      success: true,
      summary: {
        totalSessions,
        presentCount,
        absentCount,
        excusedCount,
        overallPercentage,
        threshold: 75,
      },
      chartTrend,
      subjectStats,
      count: records.length,
      records: records.slice(0, 100),
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 3. INTERNAL MARKS & PERFORMANCE REPORT
// ============================================================================
export const getMarksReport = async (req, res, next) => {
  try {
    const { studentId, subjectId, departmentId, examType } = req.query;

    const authScope = await resolveAuthorizedStudentScope(req.user, studentId);
    if (!authScope.allowed) {
      return res.status(403).json({ success: false, message: 'Unauthorized student access.' });
    }

    const filter = {};
    if (authScope.studentIds) {
      filter.student = { $in: authScope.studentIds };
    } else if (departmentId) {
      const deptStudents = await Student.find({ department: departmentId }).select('_id');
      filter.student = { $in: deptStudents.map((s) => s._id) };
    }

    if (subjectId) filter.subject = subjectId;
    if (examType && examType !== 'All') filter.examType = examType;

    const marks = await InternalMark.find(filter)
      .populate({ path: 'student', populate: { path: 'user', select: 'name' } })
      .populate('subject', 'name code')
      .sort({ createdAt: -1 });

    const totalAssessments = marks.length;
    const avgPercentage =
      totalAssessments > 0
        ? Math.round(
            (marks.reduce((acc, m) => acc + (m.percentage || 0), 0) / totalAssessments) * 10
          ) / 10
        : 0;

    // Subject performance distribution for Chart.js
    const subjectMap = {};
    marks.forEach((m) => {
      const sName = m.subject?.name || 'Subject';
      if (!subjectMap[sName]) {
        subjectMap[sName] = { totalPct: 0, count: 0, maxScore: m.maxMarks || 50 };
      }
      subjectMap[sName].totalPct += m.percentage || 0;
      subjectMap[sName].count++;
    });

    const chartData = {
      labels: Object.keys(subjectMap),
      obtained: Object.keys(subjectMap).map((s) =>
        Math.round((subjectMap[s].totalPct / subjectMap[s].count) * 10) / 10
      ),
      max: Object.keys(subjectMap).map(() => 100),
    };

    res.status(200).json({
      success: true,
      summary: {
        totalAssessments,
        averagePercentage: avgPercentage,
        passingBenchmark: 50,
      },
      chartData,
      count: marks.length,
      records: marks,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 4. ASSIGNMENT SUBMISSION & MISSING STATUS REPORT
// ============================================================================
export const getAssignmentsReport = async (req, res, next) => {
  try {
    const { studentId, subjectId, departmentId, status } = req.query;

    const authScope = await resolveAuthorizedStudentScope(req.user, studentId);
    if (!authScope.allowed) {
      return res.status(403).json({ success: false, message: 'Unauthorized student access.' });
    }

    const assignFilter = {};
    if (subjectId) assignFilter.subject = subjectId;
    if (departmentId) assignFilter.department = departmentId;

    const assignments = await Assignment.find(assignFilter)
      .populate('subject', 'name code')
      .populate('faculty', 'name');

    // Build consolidated submission records for target students
    let targetStudents = [];
    if (authScope.studentIds) {
      targetStudents = await Student.find({ _id: { $in: authScope.studentIds } }).populate('user', 'name');
    } else {
      targetStudents = await Student.find().populate('user', 'name').limit(50);
    }

    const reportRows = [];
    let submittedCount = 0;
    let lateCount = 0;
    let missingCount = 0;
    let pendingCount = 0;

    for (const a of assignments) {
      for (const st of targetStudents) {
        const sub = await AssignmentSubmission.findOne({
          assignment: a._id,
          student: st._id,
        });

        const isOverdue = new Date(a.dueDate) < new Date();
        let itemStatus = 'Pending';

        if (sub) {
          itemStatus = sub.status;
          if (sub.isLate) lateCount++;
          submittedCount++;
        } else if (isOverdue) {
          itemStatus = 'Missing';
          missingCount++;
        } else {
          itemStatus = 'Pending';
          pendingCount++;
        }

        if (!status || status === 'All' || itemStatus === status) {
          reportRows.push({
            assignmentId: a._id,
            title: a.title,
            subject: a.subject?.name || 'General',
            studentName: st.user?.name || 'Student',
            studentId: st._id,
            dueDate: a.dueDate,
            maxMarks: a.maxMarks,
            status: itemStatus,
            obtainedMarks: sub ? sub.obtainedMarks : null,
            submittedAt: sub ? sub.submittedAt : null,
            isLate: sub ? sub.isLate : false,
          });
        }
      }
    }

    res.status(200).json({
      success: true,
      summary: {
        totalAssignments: assignments.length,
        submittedCount,
        missingCount,
        lateCount,
        pendingCount,
      },
      count: reportRows.length,
      records: reportRows,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 5. LEAVE HISTORY & APPROVAL STATUS REPORT
// ============================================================================
export const getLeavesReport = async (req, res, next) => {
  try {
    const { studentId, departmentId, status, startDate, endDate } = req.query;

    const authScope = await resolveAuthorizedStudentScope(req.user, studentId);
    if (!authScope.allowed) {
      return res.status(403).json({ success: false, message: 'Unauthorized student access.' });
    }

    const filter = {};
    if (authScope.studentIds) {
      filter.student = { $in: authScope.studentIds };
    } else if (departmentId) {
      const deptStudents = await Student.find({ department: departmentId }).select('_id');
      filter.student = { $in: deptStudents.map((s) => s._id) };
    }

    if (status && status !== 'All') filter.status = status;
    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate) filter.startDate.$gte = new Date(startDate);
      if (endDate) filter.startDate.$lte = new Date(endDate);
    }

    const leaves = await LeaveRequest.find(filter)
      .populate({ path: 'student', populate: { path: 'user', select: 'name rollNumber' } })
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 });

    const totalRequests = leaves.length;
    const approvedRequests = leaves.filter((l) => l.status === 'Approved');
    const totalApprovedDays = approvedRequests.reduce((acc, l) => acc + (l.durationDays || 0), 0);

    const byType = {
      Medical: approvedRequests.filter((l) => l.leaveType === 'Medical').length,
      Personal: approvedRequests.filter((l) => l.leaveType === 'Personal').length,
      'Academic/Duty': approvedRequests.filter((l) => l.leaveType === 'Academic/Duty').length,
    };

    res.status(200).json({
      success: true,
      summary: {
        totalRequests,
        approvedCount: approvedRequests.length,
        pendingCount: leaves.filter((l) => l.status === 'Pending').length,
        rejectedCount: leaves.filter((l) => l.status === 'Rejected').length,
        totalApprovedDays,
        byType,
      },
      count: leaves.length,
      records: leaves,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 6. ACADEMIC RISK SUMMARIES & AUDIT TRAIL REPORT
// ============================================================================
export const getRisksReport = async (req, res, next) => {
  try {
    const { studentId, severity, riskType, status } = req.query;

    const authScope = await resolveAuthorizedStudentScope(req.user, studentId);
    if (!authScope.allowed) {
      return res.status(403).json({ success: false, message: 'Unauthorized student access.' });
    }

    const filter = {};
    if (authScope.studentIds) {
      filter.student = { $in: authScope.studentIds };
    }

    if (severity && severity !== 'All') filter.severity = severity;
    if (riskType && riskType !== 'All') filter.riskType = riskType;
    if (status && status !== 'All') filter.status = status;

    const risks = await AcademicRisk.find(filter)
      .populate({ path: 'student', populate: { path: 'user', select: 'name rollNumber' } })
      .populate({ path: 'auditTrail.performedBy', select: 'name role' })
      .sort({ detectedDate: -1 });

    // Compute distribution counts for RiskDoughnutChart
    const activeRisks = risks.filter((r) => r.status === 'Active');
    const highCount = activeRisks.filter((r) => r.severity === 'High').length;
    const mediumCount = activeRisks.filter((r) => r.severity === 'Medium').length;
    const lowCount = activeRisks.filter((r) => r.severity === 'Low').length;

    const counts = {
      high: highCount,
      moderate: mediumCount,
      low: Math.max(0, 10 - highCount - mediumCount), // safe buffer for visualization
    };

    const byRiskType = {
      Attendance: activeRisks.filter((r) => r.riskType === 'Attendance').length,
      'Assessment Marks': activeRisks.filter((r) => r.riskType === 'Assessment Marks').length,
      'Missing Assignments': activeRisks.filter((r) => r.riskType === 'Missing Assignments').length,
      'Excessive Leave': activeRisks.filter((r) => r.riskType === 'Excessive Leave').length,
    };

    res.status(200).json({
      success: true,
      summary: {
        total: risks.length,
        active: activeRisks.length,
        resolved: risks.filter((r) => r.status === 'Resolved').length,
        counts,
        byRiskType,
      },
      count: risks.length,
      records: risks,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 7. PARENT NOTIFICATION HISTORY REPORT
// ============================================================================
export const getNotificationsReport = async (req, res, next) => {
  try {
    const { studentId, channel, status, startDate, endDate } = req.query;

    const authScope = await resolveAuthorizedStudentScope(req.user, studentId);
    if (!authScope.allowed) {
      return res.status(403).json({ success: false, message: 'Unauthorized student access.' });
    }

    const filter = {};
    if (authScope.studentIds) {
      filter.student = { $in: authScope.studentIds };
    }

    if (channel && channel !== 'All') filter.channel = channel;
    if (status && status !== 'All') filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const notifs = await Notification.find(filter)
      .populate('recipient', 'name email phone role')
      .populate('sender', 'name')
      .populate({ path: 'student', populate: { path: 'user', select: 'name' } })
      .sort({ createdAt: -1 });

    const total = notifs.length;
    const delivered = notifs.filter((n) => n.status === 'delivered').length;
    const failed = notifs.filter((n) => n.status === 'failed').length;

    res.status(200).json({
      success: true,
      summary: {
        total,
        delivered,
        failed,
        byChannel: {
          email: notifs.filter((n) => n.deliveryStatus?.emailSent).length,
          sms: notifs.filter((n) => n.deliveryStatus?.smsSent).length,
          voice: notifs.filter((n) => n.voiceDetails?.status === 'ready').length,
          system: notifs.filter((n) => n.channel === 'system').length,
        },
      },
      count: notifs.length,
      records: notifs,
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================================
// 8. COHORT PERFORMANCE DISTRIBUTION (AGGREGATE)
// ============================================================================
export const getClassPerformance = async (req, res, next) => {
  try {
    const { department: deptCode = 'CSE', semester = 4 } = req.query;

    const deptDoc = await Department.findOne({
      $or: [{ code: deptCode.toUpperCase() }, { name: deptCode }],
    });

    if (!deptDoc) {
      return res.status(404).json({ success: false, message: 'Department not found.' });
    }

    const students = await Student.find({
      department: deptDoc._id,
      semester: Number(semester),
    }).populate('user');

    const activeStudents = students.filter((s) => s.user && s.user.isActive);
    const studentIds = activeStudents.map((s) => s._id);

    const attendanceRecords = await Attendance.find({ student: { $in: studentIds } });
    const marksRecords = await InternalMark.find({ student: { $in: studentIds } }).populate(
      'subject',
      'name code'
    );

    const subjectMarks = {};
    marksRecords.forEach((m) => {
      const sName = m.subject?.name || 'Course';
      if (!subjectMarks[sName]) {
        subjectMarks[sName] = { total: 0, count: 0 };
      }
      subjectMarks[sName].total += m.percentage || 0;
      subjectMarks[sName].count += 1;
    });

    const subjectAnalytics = Object.keys(subjectMarks).map((sName) => ({
      subject: sName,
      average: Math.round((subjectMarks[sName].total / subjectMarks[sName].count) * 10) / 10,
    }));

    const attendancePcts = await Promise.all(
      studentIds.map(async (sid) => {
        const records = attendanceRecords.filter((r) => r.student.toString() === sid.toString());
        const total = records.length;
        const present = records.filter((r) => r.status === 'Present' || r.status === 'Excused').length;
        return total > 0 ? (present / total) * 100 : 100;
      })
    );

    const attendanceDistribution = {
      criticalBelow75: attendancePcts.filter((p) => p < 75).length,
      warning75To85: attendancePcts.filter((p) => p >= 75 && p < 85).length,
      goodAbove85: attendancePcts.filter((p) => p >= 85).length,
    };

    res.status(200).json({
      success: true,
      cohort: {
        department: deptDoc.name,
        semester: Number(semester),
        totalStudents: activeStudents.length,
      },
      subjectAnalytics,
      attendanceDistribution,
    });
  } catch (error) {
    next(error);
  }
};
