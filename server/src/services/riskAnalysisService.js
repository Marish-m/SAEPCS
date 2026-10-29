import Student from '../models/Student.js';
import Attendance from '../models/Attendance.js';
import InternalMark from '../models/InternalMark.js';
import Assignment from '../models/Assignment.js';
import AssignmentSubmission from '../models/AssignmentSubmission.js';
import AcademicRisk from '../models/AcademicRisk.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Notification from '../models/Notification.js';
import SystemConfig from '../models/SystemConfig.js';
import notificationService from './notificationService.js';

/**
 * Sends a risk notification while strictly preventing duplicate warnings
 * for the same unresolved issue within a 24-hour window or while unread.
 */
export const notifyUnresolvedRiskIssue = async (studentId, issueType, title, message) => {
  try {
    const student = await Student.findById(studentId)
      .populate('user')
      .populate({
        path: 'parents',
        populate: { path: 'user' },
      });

    if (!student || !student.user) return null;

    const since24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. Check for existing student notification within last 24 hours or unread
    const existingStudentNotif = await Notification.findOne({
      recipient: student.user._id,
      type: issueType,
      $or: [{ createdAt: { $gte: since24Hours } }, { isRead: false }],
    });

    let studentNotif = null;
    if (!existingStudentNotif) {
      studentNotif = await Notification.create({
        recipient: student.user._id,
        title,
        message,
        type: issueType,
        channel: 'system',
      });
    }

    // 2. Check and notify linked parent if available
    let parentNotif = null;
    if (student.parents && student.parents.length > 0 && student.parents[0]?.user) {
      const parentUser = student.parents[0].user;
      const existingParentNotif = await Notification.findOne({
        recipient: parentUser._id,
        type: issueType,
        $or: [{ createdAt: { $gte: since24Hours } }, { isRead: false }],
      });

      if (!existingParentNotif) {
        parentNotif = await Notification.create({
          recipient: parentUser._id,
          title: `Academic Notice for ${student.user.name}: ${title}`,
          message: `Notice for ${student.user.name} (Roll: ${student.rollNumber}): ${message}`,
          type: issueType,
          channel: 'all',
        });
      }
    }

    if (existingStudentNotif) {
      return {
        suppressedDuplicate: true,
        reason: 'Notification suppressed to avoid duplicate warnings within 24 hours.',
        notification: existingStudentNotif,
      };
    }

    return {
      suppressedDuplicate: false,
      notification: studentNotif,
      parentNotification: parentNotif,
    };
  } catch (error) {
    console.error('Error in notifyUnresolvedRiskIssue:', error);
    return null;
  }
};

/**
 * Synchronizes an individual rule-based risk item for a student.
 * - Prevents duplicate active risk records for the same issue.
 * - Automatically resolves or closes a risk when its triggering condition is no longer present.
 * - Maintains historical audit trails for all detections, transitions, and resolutions.
 */
export const syncRiskRecord = async ({
  studentId,
  riskType,
  isTriggered,
  severity,
  reason,
  relatedRecord = null,
  metricsSnapshot = {},
  resolutionMessage = '',
}) => {
  // Query for an existing Active risk for this student & riskType
  const existingActive = await AcademicRisk.findOne({
    student: studentId,
    riskType,
    status: 'Active',
  });

  if (isTriggered) {
    if (existingActive) {
      // PREVENT DUPLICATE ACTIVE RISK: Update existing active record
      const previousSeverity = existingActive.severity;
      const previousReason = existingActive.reason;
      let stateChanged = false;

      if (previousSeverity !== severity) {
        existingActive.auditTrail.push({
          action: 'SEVERITY_CHANGED',
          timestamp: new Date(),
          previousSeverity,
          newSeverity: severity,
          notes: `Severity changed from ${previousSeverity} to ${severity}. Trigger: ${reason}`,
        });
        existingActive.severity = severity;
        stateChanged = true;

        // Trigger notification on severity change
        await notificationService.dispatchAcademicWarning({
          studentId,
          riskType,
          severity,
          previousSeverity,
          reason,
          currentMetric: reason,
          recommendedAction:
            severity === 'High'
              ? 'Immediate parent-faculty conference required and remedial intervention.'
              : 'Faculty advisory check-in and progress notice.',
        });
      }

      if (previousReason !== reason) {
        existingActive.reason = reason;
        stateChanged = true;
      }

      existingActive.lastEvaluatedDate = new Date();
      if (relatedRecord) existingActive.relatedRecord = relatedRecord;

      // Update metrics snapshot
      Object.assign(existingActive, metricsSnapshot);
      await existingActive.save();
      return { risk: existingActive, action: stateChanged ? 'UPDATED' : 'MAINTAINED' };
    } else {
      // Create a NEW Active Risk Record
      const newRisk = await AcademicRisk.create({
        student: studentId,
        riskType,
        severity,
        reason,
        detectedDate: new Date(),
        status: 'Active',
        relatedRecord,
        lastEvaluatedDate: new Date(),
        auditTrail: [
          {
            action: 'DETECTED',
            timestamp: new Date(),
            notes: `Rule condition triggered: ${reason}`,
            newSeverity: severity,
            newStatus: 'Active',
          },
        ],
        ...metricsSnapshot,
      });

      // Trigger notification when new risk is detected
      await notificationService.dispatchAcademicWarning({
        studentId,
        riskType,
        severity,
        reason,
        currentMetric: reason,
        recommendedAction:
          severity === 'High'
            ? 'Immediate parent-faculty conference required and remedial intervention.'
            : 'Faculty advisory check-in and progress notice.',
      });

      return { risk: newRisk, action: 'CREATED' };
    }
  } else {
    // Condition is NO LONGER PRESENT: Resolve or close the active risk
    if (existingActive) {
      const resolutionNote =
        resolutionMessage || `Condition no longer present. Triggering deficit resolved successfully.`;

      existingActive.status = 'Resolved';
      existingActive.resolvedDate = new Date();
      existingActive.resolutionReason = resolutionNote;
      existingActive.lastEvaluatedDate = new Date();
      existingActive.auditTrail.push({
        action: 'CONDITION_RESOLVED',
        timestamp: new Date(),
        notes: resolutionNote,
        previousStatus: 'Active',
        newStatus: 'Resolved',
      });

      // Update metrics snapshot upon resolution
      Object.assign(existingActive, metricsSnapshot);
      await existingActive.save();
      return { risk: existingActive, action: 'RESOLVED' };
    }
    return { risk: null, action: 'NONE' };
  }
};

/**
 * Dedicated Rule-Based Academic Risk Identification Engine
 * Evaluates the 4 core institutional conditions:
 * 1. Attendance below 75% (or configurable attendanceThreshold).
 * 2. Assessment marks below minimum benchmark (marksThreshold).
 * 3. Assignments missing after their deadlines (missingAssignmentsThreshold).
 * 4. Excessive leave based on policy (excessiveLeaveThreshold).
 *
 * Classifies risks into Low, Medium, High with exact reasons.
 */
export const calculateStudentRisk = async (studentId) => {
  const student = await Student.findById(studentId)
    .populate('user', 'name email phone')
    .populate('department', 'name code');

  if (!student) throw new Error('Student record not found');

  // Load configurable institutional rules
  const config = await SystemConfig.getRiskThresholds();
  const attendanceThreshold = config.attendanceThreshold || 75;
  const marksThreshold = config.marksThreshold || 50;
  const missingAssignmentsThreshold = config.missingAssignmentsThreshold || 2;
  const excessiveLeaveThreshold = config.excessiveLeaveThreshold || 6;

  // 1. Attendance Metrics (Present, Excused, On Duty count as attended)
  const attendanceRecords = await Attendance.find({ student: student._id });
  const totalClasses = attendanceRecords.length;
  const presentClasses = attendanceRecords.filter(
    (a) => a.status === 'Present' || a.status === 'Excused' || a.status === 'On Duty'
  ).length;

  const attendancePercentage =
    totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100 * 10) / 10 : 100;

  // 2. Internal Assessment Marks Metrics
  const marks = await InternalMark.find({ student: student._id });
  let totalMax = 0;
  let totalObtained = 0;

  marks.forEach((m) => {
    totalMax += m.maxMarks;
    totalObtained += m.obtainedMarks;
  });

  const marksAveragePercentage =
    totalMax > 0 ? Math.round((totalObtained / totalMax) * 100 * 10) / 10 : 100;

  // 3. Assignment Metrics (Detecting Submitted, Pending, and Overdue Missing assignments)
  let totalAssignments = 0;
  let submittedAssignments = 0;
  let missingAssignmentsCount = 0;
  let pendingAssignmentsCount = 0;
  const now = new Date();

  if (student.department) {
    const departmentAssignments = await Assignment.find({
      department: student.department._id,
      semester: student.semester,
    });
    totalAssignments = departmentAssignments.length;

    for (const assign of departmentAssignments) {
      const sub = await AssignmentSubmission.findOne({
        assignment: assign._id,
        student: student._id,
      });

      if (sub) {
        submittedAssignments++;
      } else {
        // Detect overdue assignments past deadline that have not been submitted
        if (now > new Date(assign.dueDate)) {
          missingAssignmentsCount++;
        } else {
          pendingAssignmentsCount++;
        }
      }
    }
  }

  const assignmentCompletionRate =
    totalAssignments > 0
      ? Math.round((submittedAssignments / totalAssignments) * 100 * 10) / 10
      : 100;

  // 4. Leave Usage Metrics (Tracking approved leaves vs institutional policy)
  const approvedLeaves = await LeaveRequest.find({
    student: student._id,
    status: 'Approved',
  });

  let approvedLeaveDays = 0;
  approvedLeaves.forEach((leave) => {
    if (leave.durationDays) {
      approvedLeaveDays += leave.durationDays;
    } else if (leave.startDate && leave.endDate) {
      const diff = Math.abs(new Date(leave.endDate) - new Date(leave.startDate));
      approvedLeaveDays += Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
    }
  });

  // Common metrics snapshot for AcademicRisk records
  const metricsSnapshot = {
    attendancePercentage,
    marksAveragePercentage,
    pendingAssignmentsCount,
    missingAssignmentsCount,
    approvedLeaveDays,
  };

  // =========================================================================
  // CONDITION 1: Attendance below 75% (or configured threshold)
  // Severity:
  // - High: < 65% (Critical examination ineligibility)
  // - Medium: < attendanceThreshold (Below mandatory benchmark)
  // - Low: Within 5% buffer of threshold (Warning range)
  // =========================================================================
  const isAttendanceTriggered = attendancePercentage < attendanceThreshold;
  let attendanceSeverity = 'Low';
  if (attendancePercentage < 65) {
    attendanceSeverity = 'High';
  } else if (attendancePercentage < attendanceThreshold) {
    attendanceSeverity = 'Medium';
  } else {
    attendanceSeverity = 'Low';
  }

  const attendanceReason = `Attendance is ${attendancePercentage}% (${presentClasses}/${totalClasses} classes), which is below the mandatory threshold of ${attendanceThreshold}%.`;
  const attendanceResolutionMsg = `Attendance recovered to ${attendancePercentage}% (meeting mandatory ${attendanceThreshold}% threshold).`;

  await syncRiskRecord({
    studentId: student._id,
    riskType: 'Attendance',
    isTriggered: isAttendanceTriggered,
    severity: attendanceSeverity,
    reason: attendanceReason,
    relatedRecord: { model: 'Attendance', name: 'Course Attendance Log' },
    metricsSnapshot,
    resolutionMessage: attendanceResolutionMsg,
  });

  // =========================================================================
  // CONDITION 2: Internal assessment marks below configured minimum
  // Severity:
  // - High: < 40% (Critical failure risk, remedial coaching required)
  // - Medium: < marksThreshold (Below benchmark benchmark)
  // - Low: Within 10% buffer of threshold (Needs improvement)
  // =========================================================================
  const isMarksTriggered = marksAveragePercentage < marksThreshold;
  let marksSeverity = 'Low';
  if (marksAveragePercentage < 40) {
    marksSeverity = 'High';
  } else if (marksAveragePercentage < marksThreshold) {
    marksSeverity = 'Medium';
  } else {
    marksSeverity = 'Low';
  }

  const marksReason = `Internal assessment marks average is ${marksAveragePercentage}%, which is below the institutional benchmark of ${marksThreshold}%.`;
  const marksResolutionMsg = `Internal assessment marks average improved to ${marksAveragePercentage}% (>= ${marksThreshold}% benchmark).`;

  await syncRiskRecord({
    studentId: student._id,
    riskType: 'Assessment Marks',
    isTriggered: isMarksTriggered,
    severity: marksSeverity,
    reason: marksReason,
    relatedRecord: { model: 'InternalMark', name: 'Internal Assessment Transcripts' },
    metricsSnapshot,
    resolutionMessage: marksResolutionMsg,
  });

  // =========================================================================
  // CONDITION 3: Assignments missing after their deadlines
  // Severity:
  // - High: >= 3 missing assignments (Severe unsubmitted deficit)
  // - Medium: >= missingAssignmentsThreshold (Threshold reached)
  // - Low: 1 missing assignment (Past deadline warning)
  // =========================================================================
  const isMissingAssignmentsTriggered = missingAssignmentsCount >= missingAssignmentsThreshold;
  let missingSeverity = 'Low';
  if (missingAssignmentsCount >= Math.max(3, missingAssignmentsThreshold * 1.5)) {
    missingSeverity = 'High';
  } else if (missingAssignmentsCount >= missingAssignmentsThreshold) {
    missingSeverity = 'Medium';
  } else if (missingAssignmentsCount > 0) {
    missingSeverity = 'Low';
  }

  const missingReason = `Missing Assignments: ${missingAssignmentsCount} assignment(s) are overdue and unsubmitted past deadline (Institutional threshold: ${missingAssignmentsThreshold}).`;
  const missingResolutionMsg = `All overdue assignments have been submitted or cleared (0 missing).`;

  await syncRiskRecord({
    studentId: student._id,
    riskType: 'Missing Assignments',
    isTriggered: isMissingAssignmentsTriggered,
    severity: missingSeverity,
    reason: missingReason,
    relatedRecord: { model: 'Assignment', name: 'Coursework Submissions' },
    metricsSnapshot,
    resolutionMessage: missingResolutionMsg,
  });

  // =========================================================================
  // CONDITION 4: Excessive leave based on administrator-configured policy
  // Severity:
  // - High: >= 10 approved days (Severe attendance impact)
  // - Medium: >= excessiveLeaveThreshold (Policy limit reached)
  // - Low: Nearing threshold (within 2 days)
  // =========================================================================
  const isExcessiveLeaveTriggered = approvedLeaveDays >= excessiveLeaveThreshold;
  let leaveSeverity = 'Low';
  if (approvedLeaveDays >= Math.max(10, excessiveLeaveThreshold * 1.5)) {
    leaveSeverity = 'High';
  } else if (approvedLeaveDays >= excessiveLeaveThreshold) {
    leaveSeverity = 'Medium';
  } else if (approvedLeaveDays >= excessiveLeaveThreshold - 2) {
    leaveSeverity = 'Low';
  }

  const leaveReason = `Excessive Approved Leave: Approved leave total has reached ${approvedLeaveDays} days, exceeding the institutional limit of ${excessiveLeaveThreshold} days.`;
  const leaveResolutionMsg = `Leave usage is within institutional policy limits (${approvedLeaveDays} days < ${excessiveLeaveThreshold} days threshold).`;

  await syncRiskRecord({
    studentId: student._id,
    riskType: 'Excessive Leave',
    isTriggered: isExcessiveLeaveTriggered,
    severity: leaveSeverity,
    reason: leaveReason,
    relatedRecord: { model: 'LeaveRequest', name: 'Approved Leave Applications' },
    metricsSnapshot,
    resolutionMessage: leaveResolutionMsg,
  });

  // Query all active discrete risks for this student
  const activeRisks = await AcademicRisk.find({
    student: student._id,
    status: 'Active',
    riskType: { $ne: 'Composite' },
  }).sort({ detectedDate: -1 });

  // Determine overall severity based on the highest active risk
  let overallSeverity = 'Low';
  if (activeRisks.some((r) => r.severity === 'High')) {
    overallSeverity = 'High';
  } else if (activeRisks.some((r) => r.severity === 'Medium')) {
    overallSeverity = 'Medium';
  } else if (activeRisks.length > 0) {
    overallSeverity = 'Low';
  } else {
    overallSeverity = 'Low';
  }

  // Calculate transparent Composite Risk Score (0 - 100)
  const safeAttendanceBenchmark = Math.max(85, attendanceThreshold + 10);
  const attendanceDeficit = Math.max(0, safeAttendanceBenchmark - attendancePercentage) * (100 / safeAttendanceBenchmark);
  const marksDeficit = Math.max(0, 60 - marksAveragePercentage) * (100 / 60);
  const missingAssignmentDeficit = Math.min(100, (missingAssignmentsCount / missingAssignmentsThreshold) * 75);
  const excessiveLeaveDeficit = Math.min(100, (approvedLeaveDays / excessiveLeaveThreshold) * 75);

  let rawRiskScore =
    0.40 * attendanceDeficit +
    0.30 * marksDeficit +
    0.15 * missingAssignmentDeficit +
    0.15 * excessiveLeaveDeficit;
  rawRiskScore = Math.min(100, Math.max(0, Math.round(rawRiskScore)));

  // If High severity, ensure score reflects high risk
  if (overallSeverity === 'High' && rawRiskScore < 60) {
    rawRiskScore = 65;
  } else if (overallSeverity === 'Medium' && rawRiskScore < 30) {
    rawRiskScore = 35;
  }

  const riskFactors = activeRisks.map((r) => r.reason);
  if (riskFactors.length === 0) {
    riskFactors.push('Consistent attendance and good academic standing.');
  }

  const recommendedAction =
    overallSeverity === 'High'
      ? 'Immediate parent-faculty conference required and remedial intervention.'
      : overallSeverity === 'Medium'
      ? 'Faculty advisory check-in and progress notice to parent.'
      : 'Continue routine academic tracking.';

  // Maintain overall Composite record for backward compatibility & queries
  const compositeReason =
    activeRisks.length > 0
      ? activeRisks.map((r) => r.reason).join(' | ')
      : 'Consistent attendance and good academic standing.';

  const compositeRecord = await AcademicRisk.findOneAndUpdate(
    { student: student._id, riskType: 'Composite' },
    {
      student: student._id,
      riskType: 'Composite',
      severity: overallSeverity,
      reason: compositeReason,
      status: activeRisks.length > 0 ? 'Active' : 'Resolved',
      lastEvaluatedDate: new Date(),
      attendancePercentage,
      marksAveragePercentage,
      pendingAssignmentsCount,
      missingAssignmentsCount,
      approvedLeaveDays,
      compositeRiskScore: rawRiskScore,
      riskLevel: overallSeverity,
      riskFactors,
      recommendedAction,
    },
    { upsert: true, new: true }
  );

  // Automated notification checks with duplicate warning suppression
  if (isMissingAssignmentsTriggered) {
    await notifyUnresolvedRiskIssue(
      student._id,
      'assignment_overdue',
      `Overdue Assignments Alert: ${missingAssignmentsCount} Missing`,
      `You have ${missingAssignmentsCount} assignments past deadline with no submission recorded. Institutional threshold is ${missingAssignmentsThreshold}. Please submit immediately.`
    );
  }

  if (isExcessiveLeaveTriggered) {
    await notifyUnresolvedRiskIssue(
      student._id,
      'excessive_leave',
      `Excessive Leave Advisory: ${approvedLeaveDays} Days`,
      `Your approved leave usage (${approvedLeaveDays} days) has reached the institutional limit of ${excessiveLeaveThreshold} days. Further unexcused absence may impact exam eligibility.`
    );
  }

  return {
    student: {
      _id: student._id,
      name: student.user?.name || 'Student',
      rollNumber: student.rollNumber,
      email: student.user?.email || '',
      phone: student.user?.phone || '',
      department: student.department?.name || 'Department',
      semester: student.semester,
      section: student.section,
    },
    metrics: {
      attendancePercentage,
      totalClasses,
      presentClasses,
      attendanceThreshold,
      isAttendanceBelowThreshold: isAttendanceTriggered,
      marksAveragePercentage,
      marksThreshold,
      totalAssessments: marks.length,
      isMarksBelowThreshold: isMarksTriggered,
      assignmentCompletionRate,
      totalAssignments,
      submittedAssignments,
      pendingAssignmentsCount,
      missingAssignmentsCount,
      missingAssignmentsThreshold,
      isMissingAssignmentsFlagged: isMissingAssignmentsTriggered,
      approvedLeaveDays,
      excessiveLeaveThreshold,
      isExcessiveLeaveFlagged: isExcessiveLeaveTriggered,
      compositeRiskScore: rawRiskScore,
    },
    severity: overallSeverity,
    riskLevel: overallSeverity,
    badgeColor: overallSeverity === 'High' ? 'rose' : overallSeverity === 'Medium' ? 'amber' : 'emerald',
    activeRisks,
    activeRisksCount: activeRisks.length,
    riskFactors,
    recommendedAction,
    composite: compositeRecord,
  };
};

/**
 * Re-evaluates risk for all active students across the institution.
 */
export const recalculateAllStudentsRisk = async () => {
  const students = await Student.find().populate('user');
  const activeStudents = students.filter((s) => s.user && s.user.isActive);
  const reports = await Promise.all(activeStudents.map((st) => calculateStudentRisk(st._id)));
  return reports;
};

/**
 * Returns department or institution-wide risk analysis with full risk counts.
 */
export const getDepartmentRiskAnalysis = async (departmentId = null) => {
  const query = {};
  if (departmentId) query.department = departmentId;

  const students = await Student.find(query).populate('user');
  const activeStudents = students.filter((s) => s.user && s.user.isActive);

  const reports = await Promise.all(
    activeStudents.map((st) => calculateStudentRisk(st._id))
  );

  const activeRisksTotal = await AcademicRisk.countDocuments({
    status: 'Active',
    riskType: { $ne: 'Composite' },
  });
  const resolvedRisksTotal = await AcademicRisk.countDocuments({
    status: 'Resolved',
    riskType: { $ne: 'Composite' },
  });

  const byRiskType = {
    Attendance: await AcademicRisk.countDocuments({ status: 'Active', riskType: 'Attendance' }),
    'Assessment Marks': await AcademicRisk.countDocuments({ status: 'Active', riskType: 'Assessment Marks' }),
    'Missing Assignments': await AcademicRisk.countDocuments({ status: 'Active', riskType: 'Missing Assignments' }),
    'Excessive Leave': await AcademicRisk.countDocuments({ status: 'Active', riskType: 'Excessive Leave' }),
  };

  const summary = {
    totalStudents: reports.length,
    highRiskCount: reports.filter((r) => r.severity === 'High' || r.riskLevel === 'Critical Risk' || r.riskLevel === 'High').length,
    mediumRiskCount: reports.filter((r) => r.severity === 'Medium' || r.riskLevel === 'Moderate Risk' || r.riskLevel === 'Medium').length,
    lowRiskCount: reports.filter((r) => r.severity === 'Low' || r.riskLevel === 'Low Risk' || r.riskLevel === 'Low').length,
    // Aliases for backward compatibility
    criticalRiskCount: reports.filter((r) => r.severity === 'High' || r.riskLevel === 'Critical Risk' || r.riskLevel === 'High').length,
    moderateRiskCount: reports.filter((r) => r.severity === 'Medium' || r.riskLevel === 'Moderate Risk' || r.riskLevel === 'Medium').length,
    activeRisksCount: activeRisksTotal,
    resolvedRisksCount: resolvedRisksTotal,
    byRiskType,
  };

  return { summary, reports };
};

/**
 * Retrieves complete chronological risk history and audit trail for a student.
 */
export const getStudentRiskHistory = async (studentId) => {
  const history = await AcademicRisk.find({ student: studentId })
    .populate('auditTrail.performedBy', 'name email designation')
    .sort({ detectedDate: -1, createdAt: -1 });
  return history;
};

/**
 * Manually resolves or closes an individual risk record with audit trail entry.
 */
export const resolveRiskRecord = async (riskId, userId = null, notes = '') => {
  const risk = await AcademicRisk.findById(riskId);
  if (!risk) throw new Error('Risk record not found');

  risk.status = 'Resolved';
  risk.resolvedDate = new Date();
  risk.resolutionReason = notes || 'Manually resolved by authorized faculty or advisor.';
  risk.lastEvaluatedDate = new Date();
  risk.auditTrail.push({
    action: 'MANUALLY_RESOLVED',
    performedBy: userId,
    timestamp: new Date(),
    notes: notes || 'Manually resolved by faculty/admin',
    previousStatus: 'Active',
    newStatus: 'Resolved',
  });
  await risk.save();

  // Re-evaluate student overall status
  await calculateStudentRisk(risk.student);
  return risk;
};

export default {
  calculateStudentRisk,
  recalculateAllStudentsRisk,
  getDepartmentRiskAnalysis,
  getStudentRiskHistory,
  resolveRiskRecord,
  notifyUnresolvedRiskIssue,
  syncRiskRecord,
};
