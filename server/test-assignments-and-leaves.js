import { connectDB, disconnectDB } from './src/config/db.js';
import { seedDatabase } from './src/utils/seedData.js';
import User from './src/models/User.js';
import Student from './src/models/Student.js';
import Subject from './src/models/Subject.js';
import Faculty from './src/models/Faculty.js';
import Department from './src/models/Department.js';
import Parent from './src/models/Parent.js';
import Assignment from './src/models/Assignment.js';
import AssignmentSubmission from './src/models/AssignmentSubmission.js';
import LeaveRequest from './src/models/LeaveRequest.js';
import AcademicRisk from './src/models/AcademicRisk.js';
import SystemConfig from './src/models/SystemConfig.js';
import Notification from './src/models/Notification.js';

import {
  createAssignment,
  getAssignments,
  submitAssignment,
  getAssignmentSubmissions,
  gradeSubmission,
  deleteAssignment,
} from './src/controllers/assignmentController.js';

import {
  applyLeave,
  getLeaves,
  updateLeaveStatus,
  getLeaveUsage,
} from './src/controllers/leaveController.js';

import {
  calculateStudentRisk,
  recalculateAllStudentsRisk,
  notifyUnresolvedRiskIssue,
} from './src/services/riskAnalysisService.js';

const runTests = async () => {
  console.log('\n================================================================');
  console.log('🧪 TESTING ASSIGNMENT MANAGEMENT, LEAVE MANAGEMENT & RISK ENGINE');
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

  await connectDB();
  await seedDatabase();

  // Helper for mock Express req/res
  const createMockReqRes = (reqData = {}) => {
    let statusCode = 200;
    let responseData = null;

    const req = {
      user: reqData.user || { _id: 'mock_user_id', role: 'admin', name: 'Admin User' },
      body: reqData.body || {},
      query: reqData.query || {},
      params: reqData.params || {},
      file: reqData.file || null,
      ...reqData,
    };

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
        statusCode = 500;
        responseData = { success: false, message: err.message, error: err };
      }
    };

    return { req, res, next, getResult: () => ({ status: statusCode, data: responseData }) };
  };

  try {
    const facultyUser = await User.findOne({ email: 'faculty@saepcs.edu' });
    const facultyDoc = await Faculty.findOne({ user: facultyUser._id });
    const studentUser1 = await User.findOne({ email: 'student@saepcs.edu' });
    const student1 = await Student.findOne({ user: studentUser1._id }).populate('user');
    const student2 = await Student.findOne({ rollNumber: 'CS2026-002' }).populate('user');
    const student3 = await Student.findOne({ rollNumber: 'CS2026-003' }).populate('user');
    const parentUser = await User.findOne({ email: 'parent@saepcs.edu' });
    const subjectDSA = await Subject.findOne({ code: 'CS401' });
    const subjectML = await Subject.findOne({ code: 'CS402' });
    const cseDept = await Department.findOne({ code: 'CSE' });

    // =========================================================================
    // SUITE 1: Assignment Creation by Faculty
    // =========================================================================
    console.log('[Test Suite 1] Assignment Creation by Faculty');

    // 1.1 Rejection of missing title
    const mockMissingTitle = createMockReqRes({
      user: facultyUser,
      body: {
        description: 'Details without title',
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    await createAssignment(mockMissingTitle.req, mockMissingTitle.res, mockMissingTitle.next);
    assert(mockMissingTitle.getResult().status === 400, 'Rejects assignment creation with missing title');

    // 1.2 Rejection of invalid deadline
    const mockInvalidDate = createMockReqRes({
      user: facultyUser,
      body: {
        title: 'Binary Trees',
        description: 'Implement binary search tree',
        dueDate: 'invalid-date-string',
      },
    });
    await createAssignment(mockInvalidDate.req, mockInvalidDate.res, mockInvalidDate.next);
    assert(mockInvalidDate.getResult().status === 400, 'Rejects assignment with invalid deadline date');

    // 1.3 Successful creation
    const futureDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const mockCreateSuccess = createMockReqRes({
      user: facultyUser,
      body: {
        title: 'Dynamic Programming & Knapsack Problem',
        description: 'Implement bottom-up knapsack with weight constraints.',
        subject: subjectDSA._id.toString(),
        department: cseDept._id.toString(),
        semester: 4,
        dueDate: futureDueDate.toISOString(),
        maxMarks: 50,
      },
    });
    await createAssignment(mockCreateSuccess.req, mockCreateSuccess.res, mockCreateSuccess.next);
    const createRes = mockCreateSuccess.getResult();
    assert(createRes.status === 201, 'Status 201 Created on valid assignment');
    assert(createRes.data.assignment.title === 'Dynamic Programming & Knapsack Problem', 'Assignment title persisted');
    assert(createRes.data.assignment.maxMarks === 50, 'Max marks saved as 50');

    const createdAssignmentId = createRes.data.assignment._id;

    // Check student notification created
    const notif = await Notification.findOne({
      recipient: student1.user._id,
      title: { $regex: /Dynamic Programming/ },
    });
    assert(notif !== null, 'Enrolled students automatically notified of published assignment');

    // =========================================================================
    // SUITE 2: Dynamic Status Detection (Pending vs Missing)
    // =========================================================================
    console.log('\n[Test Suite 2] Dynamic Status Detection (Pending vs Overdue Missing)');

    // Create an overdue assignment (deadline in past)
    const overdueAssignment = await Assignment.create({
      faculty: facultyDoc._id,
      subject: subjectML._id,
      department: cseDept._id,
      semester: 4,
      title: 'Neural Network Backpropagation',
      description: 'Implement backprop algorithm from scratch.',
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      maxMarks: 50,
    });

    // Student fetches assignments
    const mockStudentGet = createMockReqRes({
      user: studentUser1,
    });
    await getAssignments(mockStudentGet.req, mockStudentGet.res, mockStudentGet.next);
    const studentAssignList = mockStudentGet.getResult().data.assignments;

    const futureAssignItem = studentAssignList.find((a) => a._id.toString() === createdAssignmentId.toString());
    const overdueAssignItem = studentAssignList.find((a) => a._id.toString() === overdueAssignment._id.toString());

    assert(futureAssignItem.status === 'Pending', 'Future unsubmitted assignment marked as "Pending"');
    assert(overdueAssignItem.status === 'Missing', 'Past deadline unsubmitted assignment marked as "Missing"');
    assert(overdueAssignItem.isOverdue === true, 'Overdue flag set to true');

    // =========================================================================
    // SUITE 3: Student Submission (On-Time, Late, and File Validation)
    // =========================================================================
    console.log('\n[Test Suite 3] Student Submission Workflows (On-Time & Late)');

    // 3.1 Student submits on-time assignment (future deadline)
    const mockSubmitOnTime = createMockReqRes({
      user: studentUser1,
      params: { id: createdAssignmentId.toString() },
      body: {
        submissionText: 'GitHub: https://github.com/aarav/knapsack-dp. Tests pass with 100% coverage.',
        fileUrl: 'https://cloud-storage.edu/assignments/knapsack-solution.zip',
      },
    });
    await submitAssignment(mockSubmitOnTime.req, mockSubmitOnTime.res, mockSubmitOnTime.next);
    const submitOnTimeRes = mockSubmitOnTime.getResult();
    assert(submitOnTimeRes.status === 200, 'Status 200 on student submission');
    assert(submitOnTimeRes.data.isLate === false, 'On-time submission marked isLate = false');
    assert(submitOnTimeRes.data.submission.status === 'Submitted', 'Submission status recorded as "Submitted"');

    // 3.2 Student submits overdue assignment (past deadline)
    const mockSubmitLate = createMockReqRes({
      user: studentUser1,
      params: { id: overdueAssignment._id.toString() },
      body: {
        submissionText: 'Completed neural network notebook with loss plots.',
      },
    });
    await submitAssignment(mockSubmitLate.req, mockSubmitLate.res, mockSubmitLate.next);
    const submitLateRes = mockSubmitLate.getResult();
    assert(submitLateRes.status === 200, 'Status 200 on late submission');
    assert(submitLateRes.data.isLate === true, 'Past deadline submission marked isLate = true');
    assert(submitLateRes.data.submission.status === 'Late', 'Submission status recorded as "Late"');

    // 3.3 Verify student assignment status updated to Submitted and Late
    const mockStudentGet2 = createMockReqRes({ user: studentUser1 });
    await getAssignments(mockStudentGet2.req, mockStudentGet2.res, mockStudentGet2.next);
    const updatedList = mockStudentGet2.getResult().data.assignments;

    const updatedFuture = updatedList.find((a) => a._id.toString() === createdAssignmentId.toString());
    const updatedOverdue = updatedList.find((a) => a._id.toString() === overdueAssignment._id.toString());
    assert(updatedFuture.status === 'Submitted', 'Updated status is "Submitted" for on-time submission');
    assert(updatedOverdue.status === 'Late', 'Updated status is "Late" for late submission');

    // =========================================================================
    // SUITE 4: Faculty Review Console & Grading
    // =========================================================================
    console.log('\n[Test Suite 4] Faculty Review Console & Grading');

    // 4.1 Faculty gets assignment submissions
    const mockGetSubs = createMockReqRes({
      user: facultyUser,
      params: { id: createdAssignmentId.toString() },
    });
    await getAssignmentSubmissions(mockGetSubs.req, mockGetSubs.res, mockGetSubs.next);
    const subsRes = mockGetSubs.getResult().data;
    assert(subsRes.submissions.length >= 1, 'Faculty retrieves student submissions');
    assert(subsRes.stats.submittedCount >= 1, 'Submitted count matches actual submissions');
    assert(Array.isArray(subsRes.missingStudents), 'Returns list of students who have not submitted');

    // 4.2 Grading boundary validations
    const mockNegativeGrade = createMockReqRes({
      user: facultyUser,
      params: { id: createdAssignmentId.toString() },
      body: {
        studentId: student1._id.toString(),
        obtainedMarks: -5,
        feedback: 'Invalid',
      },
    });
    await gradeSubmission(mockNegativeGrade.req, mockNegativeGrade.res, mockNegativeGrade.next);
    assert(mockNegativeGrade.getResult().status === 400, 'Rejects negative obtained marks (< 0)');

    const mockExceedGrade = createMockReqRes({
      user: facultyUser,
      params: { id: createdAssignmentId.toString() },
      body: {
        studentId: student1._id.toString(),
        obtainedMarks: 65, // maxMarks is 50
        feedback: 'Invalid',
      },
    });
    await gradeSubmission(mockExceedGrade.req, mockExceedGrade.res, mockExceedGrade.next);
    assert(mockExceedGrade.getResult().status === 400, 'Rejects obtained marks exceeding max marks (> 50)');

    // 4.3 Valid grading
    const mockValidGrade = createMockReqRes({
      user: facultyUser,
      params: { id: createdAssignmentId.toString() },
      body: {
        studentId: student1._id.toString(),
        obtainedMarks: 48,
        feedback: 'Outstanding modular implementation with thorough unit tests.',
      },
    });
    await gradeSubmission(mockValidGrade.req, mockValidGrade.res, mockValidGrade.next);
    const validGradeRes = mockValidGrade.getResult();
    assert(validGradeRes.status === 200, 'Status 200 OK on valid submission evaluation');
    assert(validGradeRes.data.submission.status === 'Graded', 'Submission marked as "Graded"');
    assert(validGradeRes.data.submission.obtainedMarks === 48, 'Marks awarded recorded as 48');
    assert(validGradeRes.data.submission.feedback.includes('Outstanding'), 'Faculty feedback saved');

    // Verify student receives grading notification
    const gradeNotif = await Notification.findOne({
      recipient: student1.user._id,
      title: { $regex: /Evaluated/ },
    });
    assert(gradeNotif !== null, 'Student receives evaluation notification with score and feedback');

    // =========================================================================
    // SUITE 5: Leave Management & Strict Date Range Validation
    // =========================================================================
    console.log('\n[Test Suite 5] Leave Application & Date Range Validation');

    // 5.1 Invalid date range (end date earlier than start date)
    const mockInvalidDates = createMockReqRes({
      user: studentUser1,
      body: {
        startDate: '2026-11-20',
        endDate: '2026-11-15', // Earlier!
        reason: 'Family trip',
        leaveType: 'Personal',
      },
    });
    await applyLeave(mockInvalidDates.req, mockInvalidDates.res, mockInvalidDates.next);
    assert(mockInvalidDates.getResult().status === 400, 'Rejects leave request where end date < start date');
    assert(mockInvalidDates.getResult().data.message.includes('End date cannot be earlier'), 'Accurate date validation error message');

    // 5.2 Valid leave submission
    const mockValidLeave = createMockReqRes({
      user: studentUser1,
      body: {
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        reason: 'Attending National Hackathon on behalf of department',
        leaveType: 'Academic/Duty',
        documentUrl: '/uploads/leaves/hackathon-invitation.pdf',
      },
    });
    await applyLeave(mockValidLeave.req, mockValidLeave.res, mockValidLeave.next);
    const validLeaveRes = mockValidLeave.getResult();
    assert(validLeaveRes.status === 201, 'Status 201 Created on valid leave application');
    assert(validLeaveRes.data.leave.durationDays === 3, 'Calculates correct duration in days (3 days inclusive)');
    assert(validLeaveRes.data.leave.status === 'Pending', 'Initial leave status is "Pending"');

    const pendingLeaveId = validLeaveRes.data.leave._id;

    // 5.3 Duplicate pending request prevention
    const mockDuplicateLeave = createMockReqRes({
      user: studentUser1,
      body: {
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        reason: 'Duplicate attempt for same dates',
        leaveType: 'Academic/Duty',
      },
    });
    await applyLeave(mockDuplicateLeave.req, mockDuplicateLeave.res, mockDuplicateLeave.next);
    assert(mockDuplicateLeave.getResult().status === 409, 'Rejects duplicate pending leave application for same date range (409 Conflict)');

    // =========================================================================
    // SUITE 6: Faculty Leave Approval & Unauthorized Modification Guard
    // =========================================================================
    console.log('\n[Test Suite 6] Faculty Leave Approval & Reviewer Tracking');

    // 6.1 Faculty approves leave
    const mockApprove = createMockReqRes({
      user: facultyUser,
      params: { id: pendingLeaveId.toString() },
      body: {
        status: 'Approved',
        facultyRemarks: 'Verified official invitation; granted academic on-duty attendance concession.',
      },
    });
    await updateLeaveStatus(mockApprove.req, mockApprove.res, mockApprove.next);
    const approveRes = mockApprove.getResult();
    assert(approveRes.status === 200, 'Status 200 OK on leave approval');
    assert(approveRes.data.leave.status === 'Approved', 'Leave status updated to "Approved"');
    assert(approveRes.data.leave.reviewedBy.toString() === facultyDoc._id.toString(), 'Reviewer recorded as active faculty');
    assert(approveRes.data.leave.reviewedAt !== null, 'Review timestamp recorded');

    // 6.2 Unauthorized modification guard test
    // Another faculty member attempting to change already reviewed leave
    const anotherFacultyUser = await User.create({
      name: 'Dr. Grace Hopper',
      email: 'grace.hopper@saepcs.edu',
      password: 'Password@123',
      role: 'faculty',
    });
    const anotherFacultyDoc = await Faculty.create({
      user: anotherFacultyUser._id,
      employeeId: 'FAC-CSE-999',
      department: cseDept._id,
      designation: 'Associate Professor',
    });

    const mockUnauthorizedEdit = createMockReqRes({
      user: anotherFacultyUser,
      params: { id: pendingLeaveId.toString() },
      body: {
        status: 'Rejected',
        facultyRemarks: 'Tampered rejection attempt',
      },
    });
    await updateLeaveStatus(mockUnauthorizedEdit.req, mockUnauthorizedEdit.res, mockUnauthorizedEdit.next);
    assert(mockUnauthorizedEdit.getResult().status === 403, 'Rejects unauthorized modification of finalized leave by another reviewer (403 Forbidden)');

    // =========================================================================
    // SUITE 7: Institutional Leave Quota Usage Tracking
    // =========================================================================
    console.log('\n[Test Suite 7] Institutional Leave Quota & Policy Compliance');

    const mockUsage = createMockReqRes({
      user: studentUser1,
      params: { studentId: student1._id.toString() },
    });
    await getLeaveUsage(mockUsage.req, mockUsage.res, mockUsage.next);
    const usageRes = mockUsage.getResult().data.usage;
    assert(usageRes.totalApprovedDays > 0, 'Accurately sums total approved leave days');
    assert(usageRes.threshold === 6, 'Loads institutional threshold from system configuration (6 days)');
    assert(usageRes.remainingDays >= 0, 'Computes remaining allowed days before excessive leave alert');
    assert(usageRes.breakdownByType['Academic/Duty'] >= 3, 'Categorizes leave days by type');

    // =========================================================================
    // SUITE 8: Academic Risk Recalculation on Assignments & Leaves
    // =========================================================================
    console.log('\n[Test Suite 8] Academic Risk Recalculation on Overdue Work & Excessive Leave');

    // Create 3 overdue assignments for Student 2 who hasn't submitted any
    await Assignment.create({
      faculty: facultyDoc._id,
      subject: subjectDSA._id,
      department: cseDept._id,
      semester: 4,
      title: 'Overdue Project 1',
      description: 'Project 1 past deadline',
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      maxMarks: 50,
    });

    await Assignment.create({
      faculty: facultyDoc._id,
      subject: subjectML._id,
      department: cseDept._id,
      semester: 4,
      title: 'Overdue Project 2',
      description: 'Project 2 past deadline',
      dueDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      maxMarks: 50,
    });

    // Recalculate Student 2 risk
    const riskReportStudent2 = await calculateStudentRisk(student2._id);
    assert(riskReportStudent2.metrics.missingAssignmentsCount >= 2, 'Detects multiple overdue unsubmitted assignments');
    assert(riskReportStudent2.metrics.isMissingAssignmentsFlagged === true, 'Flags student when missing assignments >= institutional threshold (2)');
    assert(
      riskReportStudent2.riskFactors.some((f) => f.includes('Missing Assignments')),
      'Risk factors include explicit missing assignments diagnostic warning'
    );

    // Test Excessive Leave Flagging
    // Add approved leave of 7 days (exceeding threshold 6)
    await LeaveRequest.create({
      student: student2._id,
      startDate: new Date('2026-10-01'),
      endDate: new Date('2026-10-07'),
      durationDays: 7,
      reason: 'Medical recovery for major surgery',
      leaveType: 'Medical',
      status: 'Approved',
      reviewedBy: facultyDoc._id,
      reviewedAt: new Date(),
    });

    const riskReportWithLeave = await calculateStudentRisk(student2._id);
    assert(riskReportWithLeave.metrics.approvedLeaveDays >= 6, 'Calculates excessive approved leave days');
    assert(riskReportWithLeave.metrics.isExcessiveLeaveFlagged === true, 'Flags excessive leave when >= institutional limit of 6 days');
    assert(
      riskReportWithLeave.riskFactors.some((f) => f.includes('Excessive Approved Leave')),
      'Risk factors include excessive approved leave diagnostic flag'
    );

    // =========================================================================
    // SUITE 9: Duplicate Warning Suppression for Unresolved Issues
    // =========================================================================
    console.log('\n[Test Suite 9] Duplicate Warning Suppression for Unresolved Issues');

    // First attempt sends notification
    const firstNotif = await notifyUnresolvedRiskIssue(
      student2._id,
      'assignment_overdue',
      'Overdue Notice',
      'You have unresolved missing assignments.'
    );
    assert(firstNotif !== null, 'Initial warning notification dispatched');

    // Immediate second attempt for same unresolved issue must be suppressed
    const secondNotif = await notifyUnresolvedRiskIssue(
      student2._id,
      'assignment_overdue',
      'Overdue Notice Duplicate',
      'Duplicate message'
    );
    assert(secondNotif.suppressedDuplicate === true, 'Duplicate warning suppressed to prevent notification spam');

    console.log('\n================================================================');
    console.log(`📊 INTEGRATION TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
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
