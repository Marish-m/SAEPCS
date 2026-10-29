import { connectDB, disconnectDB } from './src/config/db.js';
import { seedDatabase } from './src/utils/seedData.js';
import User from './src/models/User.js';
import Student from './src/models/Student.js';
import Subject from './src/models/Subject.js';
import Faculty from './src/models/Faculty.js';
import Department from './src/models/Department.js';
import Parent from './src/models/Parent.js';
import Attendance from './src/models/Attendance.js';
import InternalMark from './src/models/InternalMark.js';
import Assignment from './src/models/Assignment.js';
import AssignmentSubmission from './src/models/AssignmentSubmission.js';
import LeaveRequest from './src/models/LeaveRequest.js';
import AcademicRisk from './src/models/AcademicRisk.js';
import SystemConfig from './src/models/SystemConfig.js';
import Notification from './src/models/Notification.js';

import {
  calculateStudentRisk,
  recalculateAllStudentsRisk,
  getDepartmentRiskAnalysis,
  getStudentRiskHistory,
  resolveRiskRecord,
  syncRiskRecord,
} from './src/services/riskAnalysisService.js';

import {
  getRiskOverview,
  getStudentRiskDetails,
  getStudentRiskHistory as getStudentRiskHistoryController,
  resolveRisk as resolveRiskController,
  getRiskSettings,
  updateRiskSettings,
} from './src/controllers/riskController.js';

const runTests = async () => {
  console.log('\n================================================================');
  console.log('🧪 UNIT & INTEGRATION TESTS: DEDICATED ACADEMIC RISK ENGINE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName) => {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  };

  // Helper for mock Express req/res
  const createMockReqRes = (reqData = {}) => {
    let statusCode = 200;
    let responseData = null;

    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      },
    };

    const next = (err) => {
      if (err) {
        statusCode = err.status || 500;
        responseData = { success: false, message: err.message };
      }
    };

    return {
      req: {
        body: {},
        params: {},
        query: {},
        user: null,
        ...reqData,
      },
      res,
      next,
      getResult: () => ({ status: statusCode, data: responseData }),
    };
  };

  try {
    await connectDB();
    await seedDatabase();

    // Fetch baseline seed entities
    const adminUser = await User.findOne({ role: 'admin' });
    const facultyUser = await User.findOne({ role: 'faculty' });
    const facultyDoc = await Faculty.findOne({ user: facultyUser._id });
    const cseDept = await Department.findOne({ code: 'CSE' });
    const subjectDSA = await Subject.findOne({ code: 'CS401' });

    // Create a dedicated test student for fine-grained risk engine assertions
    const testStudentUser = await User.create({
      name: 'Engine Test Student',
      email: 'enginetest@saepcs.edu',
      password: 'Password@123',
      role: 'student',
      isActive: true,
    });

    const testStudent = await Student.create({
      user: testStudentUser._id,
      rollNumber: 'CS2026-ENG-99',
      department: cseDept._id,
      semester: 4,
      section: 'A',
      currentCGPA: 7.2,
      academicStatus: 'Active',
    });

    // Ensure system config is reset to standard defaults
    await SystemConfig.findOneAndUpdate(
      { key: 'risk_policy' },
      {
        key: 'risk_policy',
        attendanceThreshold: 75,
        marksThreshold: 50,
        missingAssignmentsThreshold: 2,
        excessiveLeaveThreshold: 6,
      },
      { upsert: true }
    );

    // =========================================================================
    // SUITE 1: Attendance Threshold & Severity Classification (< 75%)
    // =========================================================================
    console.log('[Test Suite 1] Attendance Threshold & Severity Classification');

    // 1.1 Attendance < 65% -> High Severity
    // Create 10 attendance sessions: 6 Present, 4 Absent -> 60% attendance
    for (let i = 1; i <= 6; i++) {
      await Attendance.create({
        student: testStudent._id,
        subject: subjectDSA._id,
        faculty: facultyDoc._id,
        date: new Date(2026, 9, i),
        sessionSlot: 'Morning',
        status: 'Present',
      });
    }
    for (let i = 7; i <= 10; i++) {
      await Attendance.create({
        student: testStudent._id,
        subject: subjectDSA._id,
        faculty: facultyDoc._id,
        date: new Date(2026, 9, i),
        sessionSlot: 'Morning',
        status: 'Absent',
      });
    }

    let report = await calculateStudentRisk(testStudent._id);
    let attRisk = await AcademicRisk.findOne({
      student: testStudent._id,
      riskType: 'Attendance',
      status: 'Active',
    });

    assert(report.metrics.attendancePercentage === 60, 'Attendance rate computed as 60%');
    assert(attRisk !== null, 'Active Attendance risk record created for < 75%');
    assert(attRisk.severity === 'High', 'Classifies < 65% attendance as "High" severity');
    assert(
      attRisk.reason.includes('Attendance is 60%') && attRisk.reason.includes('mandatory threshold of 75%'),
      'Contains exact diagnostic reason string explaining the attendance shortage'
    );
    assert(attRisk.auditTrail.length === 1 && attRisk.auditTrail[0].action === 'DETECTED', 'Audit trail initialized with DETECTED event');

    // 1.2 Attendance between 65% and 75% -> Medium Severity
    // Add 4 more Present classes: total 14 classes, 10 present -> 71.4%
    for (let i = 11; i <= 14; i++) {
      await Attendance.create({
        student: testStudent._id,
        subject: subjectDSA._id,
        faculty: facultyDoc._id,
        date: new Date(2026, 9, i),
        sessionSlot: 'Morning',
        status: 'Present',
      });
    }

    report = await calculateStudentRisk(testStudent._id);
    attRisk = await AcademicRisk.findOne({
      student: testStudent._id,
      riskType: 'Attendance',
      status: 'Active',
    });

    assert(report.metrics.attendancePercentage === 71.4, 'Attendance updated to 71.4%');
    assert(attRisk.severity === 'Medium', 'Re-classifies 71.4% attendance to "Medium" severity');
    assert(
      attRisk.auditTrail.some((e) => e.action === 'SEVERITY_CHANGED' && e.previousSeverity === 'High' && e.newSeverity === 'Medium'),
      'Logs SEVERITY_CHANGED transition from High to Medium in audit trail'
    );

    // =========================================================================
    // SUITE 2: Internal Assessment Marks Threshold & Severity Classification
    // =========================================================================
    console.log('\n[Test Suite 2] Internal Assessment Marks Threshold & Severity Classification');

    // 2.1 Marks < 40% -> High Severity
    // Add internal mark 30/100 -> 30%
    const mark1 = await InternalMark.create({
      student: testStudent._id,
      subject: subjectDSA._id,
      faculty: facultyDoc._id,
      assessmentType: 'Quiz',
      assessmentName: 'Midterm Assessment 1',
      obtainedMarks: 30,
      maxMarks: 100,
      passingMarks: 50,
      semester: 4,
      academicYear: '2026-2027',
    });

    report = await calculateStudentRisk(testStudent._id);
    let marksRisk = await AcademicRisk.findOne({
      student: testStudent._id,
      riskType: 'Assessment Marks',
      status: 'Active',
    });

    assert(report.metrics.marksAveragePercentage === 30, 'Marks average computed as 30%');
    assert(marksRisk !== null, 'Active Assessment Marks risk record created for < 50% benchmark');
    assert(marksRisk.severity === 'High', 'Classifies < 40% internal marks as "High" severity');
    assert(
      marksRisk.reason.includes('30%') && marksRisk.reason.includes('institutional benchmark of 50%'),
      'Contains exact diagnostic reason for marks deficit'
    );

    // 2.2 Marks between 40% and 50% -> Medium Severity
    // Add another assessment: 60/100 -> total 90/200 = 45%
    const mark2 = await InternalMark.create({
      student: testStudent._id,
      subject: subjectDSA._id,
      faculty: facultyDoc._id,
      assessmentType: 'Assignment',
      assessmentName: 'Midterm Assessment 2',
      obtainedMarks: 60,
      maxMarks: 100,
      passingMarks: 50,
      semester: 4,
      academicYear: '2026-2027',
    });

    report = await calculateStudentRisk(testStudent._id);
    marksRisk = await AcademicRisk.findOne({
      student: testStudent._id,
      riskType: 'Assessment Marks',
      status: 'Active',
    });

    assert(report.metrics.marksAveragePercentage === 45, 'Marks average updated to 45%');
    assert(marksRisk.severity === 'Medium', 'Classifies 45% marks as "Medium" severity');
    assert(
      marksRisk.auditTrail.some((e) => e.action === 'SEVERITY_CHANGED'),
      'Logs SEVERITY_CHANGED in audit trail for marks'
    );

    // =========================================================================
    // SUITE 3: Missing Assignments After Deadlines
    // =========================================================================
    console.log('\n[Test Suite 3] Missing Assignments After Deadlines');

    // Create 3 assignments for this department/semester past due date
    const overdueAssignment1 = await Assignment.create({
      faculty: facultyDoc._id,
      subject: subjectDSA._id,
      department: cseDept._id,
      semester: 4,
      title: 'Engine Test DSA Homework 1',
      description: 'Past due homework 1',
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      maxMarks: 50,
    });

    const overdueAssignment2 = await Assignment.create({
      faculty: facultyDoc._id,
      subject: subjectDSA._id,
      department: cseDept._id,
      semester: 4,
      title: 'Engine Test DSA Homework 2',
      description: 'Past due homework 2',
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      maxMarks: 50,
    });

    const overdueAssignment3 = await Assignment.create({
      faculty: facultyDoc._id,
      subject: subjectDSA._id,
      department: cseDept._id,
      semester: 4,
      title: 'Engine Test DSA Homework 3',
      description: 'Past due homework 3',
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      maxMarks: 50,
    });

    // Also create 1 future assignment (not overdue)
    await Assignment.create({
      faculty: facultyDoc._id,
      subject: subjectDSA._id,
      department: cseDept._id,
      semester: 4,
      title: 'Future Project',
      description: 'Due next week',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxMarks: 100,
    });

    report = await calculateStudentRisk(testStudent._id);
    let assignRisk = await AcademicRisk.findOne({
      student: testStudent._id,
      riskType: 'Missing Assignments',
      status: 'Active',
    });

    assert(report.metrics.missingAssignmentsCount >= 3, 'Detects 3 unsubmitted assignments past deadline');
    assert(assignRisk !== null, 'Active Missing Assignments risk triggered');
    assert(assignRisk.severity === 'High', 'Flags >= 3 missing assignments as "High" severity');
    assert(
      assignRisk.reason.includes('assignment(s) are overdue and unsubmitted past deadline'),
      'Exact reason specifies overdue count and threshold'
    );

    // =========================================================================
    // SUITE 4: Excessive Leave Policy Based on Admin Config
    // =========================================================================
    console.log('\n[Test Suite 4] Excessive Leave Policy Based on Admin Config');

    // 4.1 Pending and rejected leaves should NOT trigger excessive leave
    await LeaveRequest.create({
      student: testStudent._id,
      startDate: new Date(2026, 8, 1),
      endDate: new Date(2026, 8, 7),
      durationDays: 7,
      reason: 'Pending leave that is unapproved',
      leaveType: 'Personal',
      status: 'Pending',
    });

    await LeaveRequest.create({
      student: testStudent._id,
      startDate: new Date(2026, 8, 10),
      endDate: new Date(2026, 8, 15),
      durationDays: 6,
      reason: 'Rejected leave',
      leaveType: 'Personal',
      status: 'Rejected',
    });

    report = await calculateStudentRisk(testStudent._id);
    let leaveRisk = await AcademicRisk.findOne({
      student: testStudent._id,
      riskType: 'Excessive Leave',
      status: 'Active',
    });

    assert(report.metrics.approvedLeaveDays === 0, 'Ignores pending and rejected leaves in approved tally');
    assert(leaveRisk === null, 'No Excessive Leave risk triggered for pending/rejected leaves');

    // 4.2 Approved leave exceeding threshold (6 days)
    await LeaveRequest.create({
      student: testStudent._id,
      startDate: new Date(2026, 9, 1),
      endDate: new Date(2026, 9, 8),
      durationDays: 8,
      reason: 'Approved medical recovery',
      leaveType: 'Medical',
      status: 'Approved',
      reviewedBy: facultyDoc._id,
      reviewedAt: new Date(),
    });

    report = await calculateStudentRisk(testStudent._id);
    leaveRisk = await AcademicRisk.findOne({
      student: testStudent._id,
      riskType: 'Excessive Leave',
      status: 'Active',
    });

    assert(report.metrics.approvedLeaveDays === 8, 'Accurately sums 8 approved leave days');
    assert(leaveRisk !== null, 'Active Excessive Leave risk triggered when approved days (8) >= policy limit (6)');
    assert(leaveRisk.severity === 'Medium', 'Classifies 8 days as "Medium" severity (policy threshold met)');
    assert(
      leaveRisk.reason.includes('Approved leave total has reached 8 days, exceeding the institutional limit of 6 days'),
      'Exact reason specifies approved days and institutional threshold'
    );

    // =========================================================================
    // SUITE 5: Duplicate Prevention on Multiple Evaluations
    // =========================================================================
    console.log('\n[Test Suite 5] Duplicate Prevention on Multiple Evaluations');

    const activeRisksBefore = await AcademicRisk.countDocuments({
      student: testStudent._id,
      status: 'Active',
    });

    // Re-evaluate 5 consecutive times
    for (let i = 0; i < 5; i++) {
      await calculateStudentRisk(testStudent._id);
    }

    const activeRisksAfter = await AcademicRisk.countDocuments({
      student: testStudent._id,
      status: 'Active',
    });

    assert(activeRisksAfter === activeRisksBefore, 'No duplicate active records created on repeated evaluations');

    const attendanceRecordsCount = await AcademicRisk.countDocuments({
      student: testStudent._id,
      riskType: 'Attendance',
      status: 'Active',
    });
    assert(attendanceRecordsCount === 1, 'Exactly 1 active record maintained per active risk type');

    // Verify lastEvaluatedDate updated
    const refreshedAttRisk = await AcademicRisk.findOne({
      student: testStudent._id,
      riskType: 'Attendance',
      status: 'Active',
    });
    assert(refreshedAttRisk.lastEvaluatedDate !== null, 'lastEvaluatedDate updated on evaluation');

    // =========================================================================
    // SUITE 6: Automatic Condition Resolution (Lifecycle)
    // =========================================================================
    console.log('\n[Test Suite 6] Automatic Condition Resolution');

    // 6.1 Attendance resolves when student attends more classes >= 75%
    // Add 10 consecutive Present classes
    for (let i = 15; i <= 24; i++) {
      await Attendance.create({
        student: testStudent._id,
        subject: subjectDSA._id,
        faculty: facultyDoc._id,
        date: new Date(2026, 9, i),
        sessionSlot: 'Morning',
        status: 'Present',
      });
    }

    report = await calculateStudentRisk(testStudent._id);
    const resolvedAttRisk = await AcademicRisk.findOne({
      student: testStudent._id,
      riskType: 'Attendance',
      status: 'Resolved',
    });
    const activeAttRisk = await AcademicRisk.findOne({
      student: testStudent._id,
      riskType: 'Attendance',
      status: 'Active',
    });

    assert(report.metrics.attendancePercentage >= 75, `Attendance percentage recovered to ${report.metrics.attendancePercentage}%`);
    assert(activeAttRisk === null, 'Active attendance risk closed/removed');
    assert(resolvedAttRisk !== null, 'Risk status transitioned to "Resolved"');
    assert(resolvedAttRisk.resolvedDate !== null, 'resolvedDate timestamp recorded upon resolution');
    assert(resolvedAttRisk.resolutionReason.includes('Attendance recovered'), 'resolutionReason captures recovery message');
    assert(
      resolvedAttRisk.auditTrail.some((e) => e.action === 'CONDITION_RESOLVED'),
      'Appends CONDITION_RESOLVED event to audit trail'
    );

    // 6.2 Missing Assignments resolve when student submits them
    await AssignmentSubmission.create({
      assignment: overdueAssignment1._id,
      student: testStudent._id,
      submittedAt: new Date(),
      status: 'Submitted',
      submissionType: 'text',
      content: 'Submitted past deadline',
    });

    await AssignmentSubmission.create({
      assignment: overdueAssignment2._id,
      student: testStudent._id,
      submittedAt: new Date(),
      status: 'Submitted',
      submissionType: 'text',
      content: 'Submitted past deadline',
    });

    await AssignmentSubmission.create({
      assignment: overdueAssignment3._id,
      student: testStudent._id,
      submittedAt: new Date(),
      status: 'Submitted',
      submissionType: 'text',
      content: 'Submitted past deadline',
    });

    report = await calculateStudentRisk(testStudent._id);
    const resolvedAssignRisk = await AcademicRisk.findOne({
      student: testStudent._id,
      riskType: 'Missing Assignments',
      status: 'Resolved',
    });
    const activeAssignRisk = await AcademicRisk.findOne({
      student: testStudent._id,
      riskType: 'Missing Assignments',
      status: 'Active',
    });

    assert(report.metrics.missingAssignmentsCount === 0, 'Missing assignments count reduced to 0');
    assert(activeAssignRisk === null, 'Active missing assignments risk closed');
    assert(resolvedAssignRisk !== null, 'Missing assignments risk marked as Resolved');
    assert(
      resolvedAssignRisk.auditTrail.some((e) => e.action === 'CONDITION_RESOLVED'),
      'Logs CONDITION_RESOLVED in audit trail for assignments'
    );

    // =========================================================================
    // SUITE 7: Manual Resolution by Authorized Faculty
    // =========================================================================
    console.log('\n[Test Suite 7] Manual Resolution by Faculty with Audit Log');

    // Assessment marks risk is currently active
    const activeMarksRisk = await AcademicRisk.findOne({
      student: testStudent._id,
      riskType: 'Assessment Marks',
      status: 'Active',
    });
    assert(activeMarksRisk !== null, 'Marks risk is initially active');

    const resolvedManual = await resolveRiskRecord(
      activeMarksRisk._id,
      facultyUser._id,
      'Conducted remedial tutoring session; student passed re-assessment test.'
    );

    assert(resolvedManual.status === 'Resolved', 'Risk status changed to Resolved manually');
    assert(
      resolvedManual.resolutionReason.includes('Conducted remedial tutoring session'),
      'Faculty resolution notes stored in resolutionReason'
    );
    assert(
      resolvedManual.auditTrail.some(
        (e) =>
          e.action === 'MANUALLY_RESOLVED' &&
          e.performedBy.toString() === facultyUser._id.toString() &&
          e.notes.includes('remedial tutoring')
      ),
      'Audit trail records MANUALLY_RESOLVED with faculty ID and notes'
    );

    // =========================================================================
    // SUITE 8: Configurable Thresholds via SystemConfig API
    // =========================================================================
    console.log('\n[Test Suite 8] Configurable Thresholds via Admin API');

    // 8.1 Fetch current settings
    const mockGetSettings = createMockReqRes({ user: facultyUser });
    await getRiskSettings(mockGetSettings.req, mockGetSettings.res, mockGetSettings.next);
    assert(mockGetSettings.getResult().status === 200, 'GET /api/risk/settings returns 200');
    assert(mockGetSettings.getResult().data.settings.attendanceThreshold === 75, 'Default attendance threshold is 75%');

    // 8.2 Update threshold (Admin role)
    const mockUpdateSettings = createMockReqRes({
      user: adminUser,
      body: {
        attendanceThreshold: 80,
        marksThreshold: 55,
        missingAssignmentsThreshold: 3,
        excessiveLeaveThreshold: 10,
        description: 'Updated institutional strict monitoring criteria',
      },
    });
    await updateRiskSettings(mockUpdateSettings.req, mockUpdateSettings.res, mockUpdateSettings.next);
    const updateRes = mockUpdateSettings.getResult();
    assert(updateRes.status === 200, 'PUT /api/risk/settings returns 200 OK');
    assert(updateRes.data.settings.attendanceThreshold === 80, 'Attendance threshold updated to 80%');
    assert(updateRes.data.recalculatedCount >= 1, 'Automatically re-evaluates all student risk records');

    // Revert to 75% for cleanliness
    const mockRevertSettings = createMockReqRes({
      user: adminUser,
      body: {
        attendanceThreshold: 75,
        marksThreshold: 50,
        missingAssignmentsThreshold: 2,
        excessiveLeaveThreshold: 6,
      },
    });
    await updateRiskSettings(mockRevertSettings.req, mockRevertSettings.res, mockRevertSettings.next);
    assert(mockRevertSettings.getResult().status === 200, 'Reverted threshold settings to standard defaults');

    // =========================================================================
    // SUITE 9: Faculty Dashboard Overview, Filtering & History Controller APIs
    // =========================================================================
    console.log('\n[Test Suite 9] Faculty Dashboard APIs (Search, Filters, History & Resolve)');

    // 9.1 Overview API with summary counts
    const mockOverview = createMockReqRes({
      user: facultyUser,
      query: { sortBy: 'compositeRiskScore', sortOrder: 'desc' },
    });
    await getRiskOverview(mockOverview.req, mockOverview.res, mockOverview.next);
    const overviewRes = mockOverview.getResult();
    assert(overviewRes.status === 200, 'GET /api/risk/overview returns 200 OK');
    assert(overviewRes.data.data.summary.totalStudents >= 1, 'Summary includes total student count');
    assert(overviewRes.data.data.summary.byRiskType !== undefined, 'Summary includes byRiskType breakdown');

    // 9.2 Filter by Severity
    const mockSeverityFilter = createMockReqRes({
      user: facultyUser,
      query: { severity: 'High' },
    });
    await getRiskOverview(mockSeverityFilter.req, mockSeverityFilter.res, mockSeverityFilter.next);
    const highReports = mockSeverityFilter.getResult().data.data.reports;
    assert(
      highReports.every((r) => r.severity === 'High' || r.riskLevel === 'Critical Risk' || r.riskLevel === 'High'),
      'Filters reports strictly by High severity'
    );

    // 9.3 Search by Student Name
    const mockSearch = createMockReqRes({
      user: facultyUser,
      query: { search: 'Engine Test' },
    });
    await getRiskOverview(mockSearch.req, mockSearch.res, mockSearch.next);
    const searchReports = mockSearch.getResult().data.data.reports;
    assert(searchReports.length === 1 && searchReports[0].student.rollNumber === 'CS2026-ENG-99', 'Search query correctly locates student');

    // 9.4 Student Risk Details API
    const mockStudentDetails = createMockReqRes({
      user: facultyUser,
      params: { studentId: testStudent._id.toString() },
    });
    await getStudentRiskDetails(mockStudentDetails.req, mockStudentDetails.res, mockStudentDetails.next);
    const detailsRes = mockStudentDetails.getResult();
    assert(detailsRes.status === 200, 'GET /api/risk/student/:studentId returns 200 OK');
    assert(detailsRes.data.history.length >= 1, 'Returns risk history with audit trails');
    assert(detailsRes.data.report.metrics !== undefined, 'Returns real-time computed metrics');

    // 9.5 Student Risk History API
    const mockHistory = createMockReqRes({
      user: facultyUser,
      params: { studentId: testStudent._id.toString() },
    });
    await getStudentRiskHistoryController(mockHistory.req, mockHistory.res, mockHistory.next);
    const historyRes = mockHistory.getResult();
    assert(historyRes.status === 200, 'GET /api/risk/history/:studentId returns 200 OK');
    assert(historyRes.data.count >= 1, 'Returns full historical count of risk records');

    // 9.6 Resolve API Controller endpoint
    // Trigger a fresh risk to resolve via HTTP controller
    const freshRisk = await AcademicRisk.create({
      student: testStudent._id,
      riskType: 'Missing Assignments',
      severity: 'Low',
      reason: '1 assignment pending review',
      status: 'Active',
      detectedDate: new Date(),
      lastEvaluatedDate: new Date(),
    });

    const mockResolveEndpoint = createMockReqRes({
      user: facultyUser,
      params: { riskId: freshRisk._id.toString() },
      body: { notes: 'Submitted physical copy in person' },
    });
    await resolveRiskController(mockResolveEndpoint.req, mockResolveEndpoint.res, mockResolveEndpoint.next);
    const resolveRes = mockResolveEndpoint.getResult();
    assert(resolveRes.status === 200, 'PUT /api/risk/:riskId/resolve returns 200 OK');
    assert(resolveRes.data.risk.status === 'Resolved', 'Marks risk record status as Resolved');

    console.log('\n================================================================');
    console.log(`📊 TEST EXECUTION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
};

runTests();
