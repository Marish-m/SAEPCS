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
import Assessment from './src/models/Assessment.js';
import Assignment from './src/models/Assignment.js';
import AssignmentSubmission from './src/models/AssignmentSubmission.js';
import LeaveRequest from './src/models/LeaveRequest.js';
import AcademicRisk from './src/models/AcademicRisk.js';
import Notification from './src/models/Notification.js';

import {
  getStudentReport,
  getAttendanceReport,
  getMarksReport,
  getAssignmentsReport,
  getLeavesReport,
  getRisksReport,
  getNotificationsReport,
  getClassPerformance,
} from './src/controllers/reportController.js';

const runTests = async () => {
  console.log('\n================================================================');
  console.log('🧪 UNIT & INTEGRATION TESTS: REPORTING & ANALYTICS ENGINE');
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
    console.log('Connecting to MongoDB & seeding baseline fixtures...');
    await connectDB();
    await seedDatabase();

    // Fetch baseline seed entities
    const adminUser = await User.findOne({ role: 'admin' });
    const facultyUser = await User.findOne({ role: 'faculty' });
    const studentUsers = await User.find({ role: 'student' });
    const parentUsers = await User.find({ role: 'parent' });

    const student1 = await Student.findOne({ user: studentUsers[0]._id })
      .populate('user')
      .populate('department');
    const student2 = await Student.findOne({ user: studentUsers[1]._id })
      .populate('user')
      .populate('department');

    const parent1 = await Parent.findOne({ user: parentUsers[0]._id });
    const subjects = await Subject.find();
    const department = await Department.findOne();

    console.log(`Loaded test entities: Student 1 (${student1.rollNumber}), Student 2 (${student2.rollNumber})\n`);

    // ========================================================================
    // TEST SUITE 1: STUDENT ATTENDANCE REPORT (FILTERING & CHART DATA)
    // ========================================================================
    console.log('--- Test Suite 1: Attendance Report & Date Range / Subject Filters ---');

    // 1.1 All attendance for student 1
    {
      const { req, res, next, getResult } = createMockReqRes({
        user: adminUser,
        query: { studentId: student1._id.toString() },
      });
      await getAttendanceReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200 && data.success === true, '1.1 Attendance report returns 200 OK');
      assert(data.summary && typeof data.summary.overallPercentage === 'number', '1.1 Summary contains overallPercentage metric');
      assert(Array.isArray(data.chartTrend?.labels) && Array.isArray(data.chartTrend?.values), '1.1 Returns chartTrend structure for Chart.js Line chart');
      assert(Array.isArray(data.subjectStats) && data.subjectStats.length > 0, '1.1 Returns course-wise breakdown subjectStats');
    }

    // 1.2 Filter by Subject
    {
      const targetSubjectId = subjects[0]._id.toString();
      const { req, res, next, getResult } = createMockReqRes({
        user: adminUser,
        query: { studentId: student1._id.toString(), subjectId: targetSubjectId },
      });
      await getAttendanceReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200, '1.2 Subject filter returns 200 OK');
      const allMatchSubject = data.records.every(
        (r) => r.subject._id.toString() === targetSubjectId || r.subject.toString() === targetSubjectId
      );
      assert(allMatchSubject, '1.2 All returned attendance records match filtered subjectId');
    }

    // 1.3 Filter by Date Range
    {
      const today = new Date();
      const pastDate = new Date();
      pastDate.setDate(today.getDate() - 15);

      const { req, res, next, getResult } = createMockReqRes({
        user: adminUser,
        query: {
          studentId: student1._id.toString(),
          startDate: pastDate.toISOString().slice(0, 10),
          endDate: today.toISOString().slice(0, 10),
        },
      });
      await getAttendanceReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200, '1.3 Date range filter returns 200 OK');
      const allWithinDate = data.records.every((r) => {
        const d = new Date(r.date);
        return d >= new Date(pastDate.toISOString().slice(0, 10)) && d <= today;
      });
      assert(allWithinDate, '1.3 All returned attendance records fall within specified date boundaries');
    }

    // ========================================================================
    // TEST SUITE 2: INTERNAL ASSESSMENT MARKS REPORT
    // ========================================================================
    console.log('\n--- Test Suite 2: Internal Marks & Performance Report ---');

    // 2.1 Marks report with average and chartData
    {
      const { req, res, next, getResult } = createMockReqRes({
        user: facultyUser,
        query: { studentId: student1._id.toString() },
      });
      await getMarksReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200 && data.success === true, '2.1 Marks report returns 200 OK');
      assert(typeof data.summary.averagePercentage === 'number', '2.1 Contains averagePercentage summary');
      assert(data.chartData && Array.isArray(data.chartData.labels) && Array.isArray(data.chartData.obtained), '2.1 Contains chartData for Chart.js Bar chart');
    }

    // 2.2 Filter by examType
    {
      const { req, res, next, getResult } = createMockReqRes({
        user: facultyUser,
        query: { examType: 'Internal 1' },
      });
      await getMarksReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200, '2.2 Marks report with examType filter returns 200 OK');
      const allInternal1 = data.records.every((m) => m.examType === 'Internal 1');
      assert(allInternal1, '2.2 All returned marks records match filtered examType');
    }

    // ========================================================================
    // TEST SUITE 3: ASSIGNMENT SUBMISSION & MISSING WORK STATUS
    // ========================================================================
    console.log('\n--- Test Suite 3: Assignment Submissions & Missing Work Status ---');

    // Seed an overdue assignment with no submission to verify 'Missing' status
    const overdueAssignment = await Assignment.create({
      title: 'Automated Overdue Assignment Test',
      description: 'Audit test for missing assignment detection',
      subject: subjects[0]._id,
      faculty: facultyUser._id,
      department: student1.department._id,
      semester: student1.semester,
      dueDate: new Date(Date.now() - 3600 * 1000 * 48), // 2 days ago
      maxMarks: 50,
    });

    {
      const { req, res, next, getResult } = createMockReqRes({
        user: adminUser,
        query: { studentId: student1._id.toString() },
      });
      await getAssignmentsReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200 && data.success === true, '3.1 Assignments report returns 200 OK');
      assert(data.summary && typeof data.summary.missingCount === 'number', '3.1 Summary contains missingCount');
      assert(data.summary.missingCount > 0, '3.1 Overdue assignment with no submission is correctly flagged as Missing');

      const missingItem = data.records.find((r) => r.assignmentId.toString() === overdueAssignment._id.toString());
      assert(missingItem && missingItem.status === 'Missing', '3.1 Specific overdue item has status "Missing"');
    }

    // 3.2 Filter by status='Missing'
    {
      const { req, res, next, getResult } = createMockReqRes({
        user: facultyUser,
        query: { status: 'Missing' },
      });
      await getAssignmentsReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200, '3.2 Assignment status filter returns 200 OK');
      const allMissing = data.records.every((r) => r.status === 'Missing');
      assert(allMissing, '3.2 All returned records match status "Missing"');
    }

    // Clean up test assignment
    await Assignment.findByIdAndDelete(overdueAssignment._id);

    // ========================================================================
    // TEST SUITE 4: LEAVE HISTORY & APPROVAL STATUS
    // ========================================================================
    console.log('\n--- Test Suite 4: Leave History & Approval Status Report ---');

    {
      const { req, res, next, getResult } = createMockReqRes({
        user: adminUser,
        query: { studentId: student1._id.toString() },
      });
      await getLeavesReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200 && data.success === true, '4.1 Leaves report returns 200 OK');
      assert(data.summary && typeof data.summary.totalApprovedDays === 'number', '4.1 Summary contains totalApprovedDays calculation');
      assert(data.summary.byType && typeof data.summary.byType.Medical === 'number', '4.1 Summary breaks down approved leaves by category');
    }

    // 4.2 Filter by status='Approved'
    {
      const { req, res, next, getResult } = createMockReqRes({
        user: facultyUser,
        query: { status: 'Approved' },
      });
      await getLeavesReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200, '4.2 Leaves status filter returns 200 OK');
      const allApproved = data.records.every((l) => l.status === 'Approved');
      assert(allApproved, '4.2 All returned leave records have status "Approved"');
    }

    // ========================================================================
    // TEST SUITE 5: ACADEMIC RISK SUMMARIES & AUDIT TRAIL
    // ========================================================================
    console.log('\n--- Test Suite 5: Academic Risk Summaries & Audit History ---');

    {
      const { req, res, next, getResult } = createMockReqRes({
        user: adminUser,
        query: {},
      });
      await getRisksReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200 && data.success === true, '5.1 Risks report returns 200 OK');
      assert(data.summary.counts && typeof data.summary.counts.high === 'number', '5.1 Returns severity counts for RiskDoughnutChart');
      assert(data.summary.counts.low !== undefined && data.summary.counts.moderate !== undefined, '5.1 Contains low, moderate, and high distribution slots');
      assert(data.summary.byRiskType && typeof data.summary.byRiskType.Attendance === 'number', '5.1 Contains byRiskType categories');
    }

    // 5.2 Filter by Severity
    {
      const { req, res, next, getResult } = createMockReqRes({
        user: facultyUser,
        query: { severity: 'High' },
      });
      await getRisksReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200, '5.2 Severity filter returns 200 OK');
      const allHigh = data.records.every((r) => r.severity === 'High');
      assert(allHigh, '5.2 All returned risk records have severity "High"');
    }

    // ========================================================================
    // TEST SUITE 6: PARENT NOTIFICATION HISTORY REPORT
    // ========================================================================
    console.log('\n--- Test Suite 6: Parent Notification History Report ---');

    {
      const { req, res, next, getResult } = createMockReqRes({
        user: adminUser,
        query: {},
      });
      await getNotificationsReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200 && data.success === true, '6.1 Notifications report returns 200 OK');
      assert(data.summary && typeof data.summary.delivered === 'number', '6.1 Summary contains delivered count');
      assert(data.summary.byChannel && typeof data.summary.byChannel.email === 'number', '6.1 Summary contains multi-channel breakdown');
    }

    // 6.2 Filter by Channel
    {
      const { req, res, next, getResult } = createMockReqRes({
        user: facultyUser,
        query: { channel: 'system' },
      });
      await getNotificationsReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200, '6.2 Channel filter returns 200 OK');
      const allSystem = data.records.every((n) => n.channel === 'system');
      assert(allSystem, '6.2 All returned notifications have channel "system"');
    }

    // ========================================================================
    // TEST SUITE 7: ROLE-BASED ACCESS CONTROL & PRIVACY ENFORCEMENT
    // ========================================================================
    console.log('\n--- Test Suite 7: Role-Based Access Control & Privacy Enforcement ---');

    // 7.1 Student accessing their OWN report -> Allowed (200)
    {
      const { req, res, next, getResult } = createMockReqRes({
        user: studentUsers[0], // student 1
        params: { studentId: student1._id.toString() },
      });
      await getStudentReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200 && data.success === true, '7.1 Student can access their own student report (200 OK)');
      assert(data.report?.student?.rollNumber === student1.rollNumber, '7.1 Student report contains student 1 profile data');
    }

    // 7.2 Student attempting to access ANOTHER student's report -> Forbidden (403)
    {
      const { req, res, next, getResult } = createMockReqRes({
        user: studentUsers[0], // student 1
        params: { studentId: student2._id.toString() }, // student 2
      });
      await getStudentReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 403, '7.2 Student attempting to access another student report is blocked with HTTP 403 Forbidden');
      assert(data.success === false, '7.2 Access denied message returned');
    }

    // 7.3 Student attempting to query another student's attendance -> Forbidden (403)
    {
      const { req, res, next, getResult } = createMockReqRes({
        user: studentUsers[0],
        query: { studentId: student2._id.toString() },
      });
      await getAttendanceReport(req, res, next);
      const { status } = getResult();

      assert(status === 403, '7.3 Student querying another student attendance is blocked with HTTP 403 Forbidden');
    }

    // 7.4 Parent accessing linked child report -> Allowed (200)
    {
      // Ensure parent1 has student1 linked
      await Parent.findByIdAndUpdate(parent1._id, { $addToSet: { students: student1._id } });

      const { req, res, next, getResult } = createMockReqRes({
        user: parentUsers[0],
        params: { studentId: student1._id.toString() },
      });
      await getStudentReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200 && data.success === true, '7.4 Parent can access linked child student report (200 OK)');
    }

    // 7.5 Parent attempting to access UNLINKED student report -> Forbidden (403)
    {
      // Ensure student2 is NOT in parent1.students
      await Parent.findByIdAndUpdate(parent1._id, { $pull: { students: student2._id } });

      const { req, res, next, getResult } = createMockReqRes({
        user: parentUsers[0],
        params: { studentId: student2._id.toString() },
      });
      await getStudentReport(req, res, next);
      const { status } = getResult();

      assert(status === 403, '7.5 Parent accessing unlinked student report is blocked with HTTP 403 Forbidden');
    }

    // ========================================================================
    // TEST SUITE 8: EMPTY DATASETS HANDLING (NO CRASHES, VALID ZERO METRICS)
    // ========================================================================
    console.log('\n--- Test Suite 8: Empty Datasets Graceful Handling ---');

    // 8.1 Empty Attendance (Date far in future)
    {
      const { req, res, next, getResult } = createMockReqRes({
        user: adminUser,
        query: { startDate: '2099-01-01', endDate: '2099-01-02' },
      });
      await getAttendanceReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200, '8.1 Empty attendance returns 200 OK');
      assert(data.summary.totalSessions === 0, '8.1 Empty totalSessions is 0');
      assert(data.summary.overallPercentage === 100, '8.1 Empty attendance defaults to safe 100%');
      assert(Array.isArray(data.records) && data.records.length === 0, '8.1 Empty records array returned without crash');
      assert(data.chartTrend.labels.length === 0, '8.1 Empty chart trend returned cleanly');
    }

    // 8.2 Empty Marks (Non-existent subject)
    {
      const dummyId = '507f1f77bcf86cd799439011';
      const { req, res, next, getResult } = createMockReqRes({
        user: adminUser,
        query: { subjectId: dummyId },
      });
      await getMarksReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200, '8.2 Empty marks returns 200 OK');
      assert(data.summary.totalAssessments === 0, '8.2 Empty totalAssessments is 0');
      assert(data.summary.averagePercentage === 0, '8.2 Empty averagePercentage is 0');
      assert(data.chartData.labels.length === 0, '8.2 Empty chartData labels array');
    }

    // 8.3 Empty Assignments
    {
      const dummyId = '507f1f77bcf86cd799439011';
      const { req, res, next, getResult } = createMockReqRes({
        user: adminUser,
        query: { subjectId: dummyId },
      });
      await getAssignmentsReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200, '8.3 Empty assignments returns 200 OK');
      assert(data.summary.missingCount === 0 && data.summary.submittedCount === 0, '8.3 Empty assignment counts are 0');
      assert(Array.isArray(data.records) && data.records.length === 0, '8.3 Empty assignment records array');
    }

    // 8.4 Empty Leaves
    {
      const { req, res, next, getResult } = createMockReqRes({
        user: adminUser,
        query: { startDate: '2099-01-01', endDate: '2099-01-02' },
      });
      await getLeavesReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200, '8.4 Empty leaves returns 200 OK');
      assert(data.summary.totalApprovedDays === 0, '8.4 Empty approved days is 0');
      assert(Array.isArray(data.records) && data.records.length === 0, '8.4 Empty leave records array');
    }

    // 8.5 Empty Risks
    {
      const dummyId = '507f1f77bcf86cd799439011';
      const { req, res, next, getResult } = createMockReqRes({
        user: adminUser,
        query: { studentId: dummyId },
      });
      await getRisksReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200, '8.5 Empty risks returns 200 OK');
      assert(data.summary.total === 0 && data.summary.active === 0, '8.5 Empty risk total is 0');
      assert(data.summary.counts.high === 0, '8.5 High severity count is 0');
    }

    // ========================================================================
    // TEST SUITE 9: PDF REPORT COMPLIANCE & STRUCTURE
    // ========================================================================
    console.log('\n--- Test Suite 9: PDF Report Export Data Schema Compliance ---');

    {
      const { req, res, next, getResult } = createMockReqRes({
        user: adminUser,
        params: { studentId: student1._id.toString() },
      });
      await getStudentReport(req, res, next);
      const { status, data } = getResult();

      assert(status === 200, '9.1 Consolidated student summary report for PDF returns 200 OK');
      const rep = data.report;

      assert(rep.student && rep.student.name && rep.student.rollNumber, '9.1 PDF schema: student profile contains name and rollNumber');
      assert(rep.student.department && rep.student.semester, '9.1 PDF schema: student profile contains department and semester');
      assert(typeof rep.generatedAt === 'string', '9.1 PDF schema: contains ISO timestamp generatedAt');
      assert(rep.academicStanding && typeof rep.compositeRiskScore === 'number', '9.1 PDF schema: contains academic standing and composite risk score');
      assert(Array.isArray(rep.attendance?.subjectStats), '9.1 PDF schema: contains structured attendance subjectStats for autoTable');
      assert(Array.isArray(rep.marks?.records), '9.1 PDF schema: contains marks records for autoTable');
      assert(Array.isArray(rep.assignments), '9.1 PDF schema: contains assignments list for autoTable');
      assert(Array.isArray(rep.riskFactors), '9.1 PDF schema: contains official observations and risk factors');
      assert(typeof rep.recommendedAction === 'string', '9.1 PDF schema: contains faculty recommended action for endorsement');
    }

    console.log('\n================================================================');
    console.log(`📊 TEST EXECUTION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    await disconnectDB();

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test error:', err);
    await disconnectDB().catch(() => {});
    process.exit(1);
  }
};

runTests();
