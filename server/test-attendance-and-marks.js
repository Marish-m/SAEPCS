import { connectDB, disconnectDB } from './src/config/db.js';
import { seedDatabase } from './src/utils/seedData.js';
import User from './src/models/User.js';
import Student from './src/models/Student.js';
import Subject from './src/models/Subject.js';
import Faculty from './src/models/Faculty.js';
import Parent from './src/models/Parent.js';
import Attendance from './src/models/Attendance.js';
import Assessment from './src/models/Assessment.js';
import InternalMark from './src/models/InternalMark.js';
import AcademicRisk from './src/models/AcademicRisk.js';
import SystemConfig from './src/models/SystemConfig.js';
import {
  markAttendance,
  correctAttendance,
  getAttendance,
  getAttendanceSummary,
  getAttendanceHistory,
} from './src/controllers/attendanceController.js';
import {
  createAssessment,
  enterMarksBatch,
  addMarks,
  getMarks,
  getStudentMarksAnalytics,
  updateMarks,
} from './src/controllers/marksController.js';
import { updateRiskSettings, getRiskSettings } from './src/controllers/riskController.js';
import { calculateStudentRisk } from './src/services/riskAnalysisService.js';

const runIntegrationTests = async () => {
  console.log('\n================================================================');
  console.log('🧪 TESTING ATTENDANCE, INTERNAL ASSESSMENT & RISK SYSTEM');
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
    const student1 = await Student.findOne({ rollNumber: 'CS2026-001' }).populate('user');
    const student2 = await Student.findOne({ rollNumber: 'CS2026-002' }).populate('user');
    const student3 = await Student.findOne({ rollNumber: 'CS2026-003' }).populate('user');
    const subjectDSA = await Subject.findOne({ code: 'CS401' });
    const subjectML = await Subject.findOne({ code: 'CS402' });

    console.log('[Test Suite 1] Attendance Recording with Approved Statuses');
    const testDate = '2026-11-15';
    const mockMark = createMockReqRes({
      user: facultyUser,
      body: {
        subject: subjectDSA._id.toString(),
        date: testDate,
        semester: 4,
        section: 'A',
        records: [
          { studentId: student1._id.toString(), status: 'Present', remarks: 'Active engagement' },
          { studentId: student2._id.toString(), status: 'Absent', remarks: 'Uninformed absence' },
          { studentId: student3._id.toString(), status: 'On Duty', remarks: 'Hackathon duty' },
        ],
      },
    });

    await markAttendance(mockMark.req, mockMark.res, mockMark.next);
    const markRes = mockMark.getResult();
    assert(markRes.status === 201, 'Status 201 Created on valid attendance mark');
    assert(markRes.data?.recordsCount === 3, '3 student attendance records saved');

    console.log('\n[Test Suite 2] Duplicate Attendance Entry Prevention');
    const mockDup = createMockReqRes({
      user: facultyUser,
      body: {
        subject: subjectDSA._id.toString(),
        date: testDate,
        semester: 4,
        section: 'A',
        records: [
          { studentId: student1._id.toString(), status: 'Present' },
        ],
      },
    });

    await markAttendance(mockDup.req, mockDup.res, mockDup.next);
    const dupRes = mockDup.getResult();
    assert(dupRes.status === 409, 'Status 409 Conflict returned for duplicate attendance');
    assert(dupRes.data?.isDuplicate === true, 'Duplicate flag set true');
    assert(dupRes.data?.message.includes('Duplicate attendance entry prevented'), 'Accurate duplicate warning message');

    console.log('\n[Test Suite 3] Attendance Correction with Audit Trail');
    const targetRecord = await Attendance.findOne({
      student: student2._id,
      subject: subjectDSA._id,
      dateStr: testDate,
    });

    // Subtest: missing reason rejected
    const mockCorrectNoReason = createMockReqRes({
      user: facultyUser,
      params: { id: targetRecord._id.toString() },
      body: {
        status: 'Excused',
        remarks: 'Doctor note produced',
        reason: '',
      },
    });
    await correctAttendance(mockCorrectNoReason.req, mockCorrectNoReason.res, mockCorrectNoReason.next);
    assert(mockCorrectNoReason.getResult().status === 400, 'Rejects correction when audit reason is omitted');

    // Subtest: valid correction with audit trail
    const mockCorrectValid = createMockReqRes({
      user: facultyUser,
      params: { id: targetRecord._id.toString() },
      body: {
        status: 'Excused',
        remarks: 'Approved medical excuse',
        reason: 'Student submitted medical certificate verified by campus health centre.',
      },
    });
    await correctAttendance(mockCorrectValid.req, mockCorrectValid.res, mockCorrectValid.next);
    const correctRes = mockCorrectValid.getResult();
    assert(correctRes.status === 200, 'Status 200 OK on successful correction');
    assert(correctRes.data?.record?.status === 'Excused', 'Status updated to Excused');
    assert(correctRes.data?.record?.auditTrail?.length >= 1, 'Audit trail entry logged in record');
    assert(
      correctRes.data?.record?.auditTrail[0].previousStatus === 'Absent' &&
      correctRes.data?.record?.auditTrail[0].newStatus === 'Excused',
      'Audit trail captured exact previousStatus and newStatus'
    );

    console.log('\n[Test Suite 4] Attendance Summary & Accurate Percentage Calculation');
    const mockSummary = createMockReqRes({
      user: facultyUser,
      params: { studentId: student1._id.toString() },
    });
    await getAttendanceSummary(mockSummary.req, mockSummary.res, mockSummary.next);
    const summaryRes = mockSummary.getResult();
    assert(summaryRes.status === 200, 'Status 200 OK for attendance summary');
    assert(typeof summaryRes.data?.summary?.overallPercentage === 'number', 'Overall percentage computed');
    assert(summaryRes.data?.summary?.totalClasses > 0, 'Total classes counted from actual database records');
    assert(Array.isArray(summaryRes.data?.summary?.subjectStats), 'Subject-wise breakdown array provided');

    console.log('\n[Test Suite 5] Assessment Creation (Subject, Max Marks, Date, Type)');
    const mockCreateAss = createMockReqRes({
      user: facultyUser,
      body: {
        title: 'Midterm Evaluation Test',
        subject: subjectML._id.toString(),
        maxMarks: 50,
        date: '2026-11-20',
        assessmentType: 'Internal 1',
        semester: 4,
        description: 'Covers linear regression, classification, and neural nets',
      },
    });
    await createAssessment(mockCreateAss.req, mockCreateAss.res, mockCreateAss.next);
    const createAssRes = mockCreateAss.getResult();
    assert(createAssRes.status === 201, 'Status 201 Created for new Assessment');
    assert(createAssRes.data?.assessment?.maxMarks === 50, 'Max marks saved as 50');
    assert(createAssRes.data?.assessment?.assessmentType === 'Internal 1', 'Assessment type saved as Internal 1');
    const createdAssessmentId = createAssRes.data?.assessment?._id;

    console.log('\n[Test Suite 6] Boundary Validation for Internal Marks Entry');
    // Boundary 1: Negative marks -> should reject
    const mockNegMarks = createMockReqRes({
      user: facultyUser,
      body: {
        studentId: student1._id.toString(),
        subject: subjectML._id.toString(),
        maxMarks: 50,
        obtainedMarks: -5,
        assessmentType: 'Internal 1',
      },
    });
    await addMarks(mockNegMarks.req, mockNegMarks.res, mockNegMarks.next);
    assert(mockNegMarks.getResult().status === 400, 'Rejects negative obtained marks (< 0)');

    // Boundary 2: Marks exceeding max -> should reject
    const mockExceedMarks = createMockReqRes({
      user: facultyUser,
      body: {
        studentId: student1._id.toString(),
        subject: subjectML._id.toString(),
        maxMarks: 50,
        obtainedMarks: 55,
        assessmentType: 'Internal 1',
      },
    });
    await addMarks(mockExceedMarks.req, mockExceedMarks.res, mockExceedMarks.next);
    assert(mockExceedMarks.getResult().status === 400, 'Rejects marks exceeding max marks (> 50)');

    // Boundary 3: Boundary 0 / 50 -> should succeed
    const mockZeroMarks = createMockReqRes({
      user: facultyUser,
      body: {
        studentId: student2._id.toString(),
        subject: subjectML._id.toString(),
        maxMarks: 50,
        obtainedMarks: 0,
        assessmentType: 'Internal 1',
        remarks: 'Zero score test',
      },
    });
    await addMarks(mockZeroMarks.req, mockZeroMarks.res, mockZeroMarks.next);
    assert(mockZeroMarks.getResult().status === 201, 'Accepts valid zero score (0 / 50)');

    // Boundary 4: Maximum score 50 / 50 -> should succeed
    const mockMaxMarks = createMockReqRes({
      user: facultyUser,
      body: {
        studentId: student1._id.toString(),
        subject: subjectML._id.toString(),
        maxMarks: 50,
        obtainedMarks: 50,
        assessmentType: 'Internal 1',
        remarks: 'Perfect score test',
      },
    });
    await addMarks(mockMaxMarks.req, mockMaxMarks.res, mockMaxMarks.next);
    assert(mockMaxMarks.getResult().status === 201, 'Accepts valid maximum score (50 / 50)');

    console.log('\n[Test Suite 7] Batch Marks Entry & Student Analytics');
    const mockBatch = createMockReqRes({
      user: facultyUser,
      body: {
        assessmentId: createdAssessmentId.toString(),
        subject: subjectML._id.toString(),
        assessmentType: 'Internal 1',
        maxMarks: 50,
        records: [
          { studentId: student1._id.toString(), obtainedMarks: 48, remarks: 'High rank' },
          { studentId: student3._id.toString(), obtainedMarks: 35, remarks: 'Good grasp' },
        ],
      },
    });
    await enterMarksBatch(mockBatch.req, mockBatch.res, mockBatch.next);
    assert(mockBatch.getResult().status === 200, 'Batch marks entry successfully recorded');

    // Test student marks analytics
    const mockAnalytics = createMockReqRes({
      user: facultyUser,
      params: { studentId: student1._id.toString() },
    });
    await getStudentMarksAnalytics(mockAnalytics.req, mockAnalytics.res, mockAnalytics.next);
    const analyticsRes = mockAnalytics.getResult();
    assert(analyticsRes.status === 200, 'Student marks analytics returned');
    assert(analyticsRes.data?.analytics?.totalAssessments > 0, 'Total assessments calculated');
    assert(analyticsRes.data?.analytics?.overallAveragePercentage > 0, 'Overall average percentage calculated');
    assert(Array.isArray(analyticsRes.data?.analytics?.subjectAverages), 'Subject averages calculated');

    console.log('\n[Test Suite 8] Configurable Risk Threshold by Administrator');
    const adminUser = await User.findOne({ role: 'admin' });

    // Read initial settings (default 75%)
    const mockGetSettings = createMockReqRes({ user: adminUser });
    await getRiskSettings(mockGetSettings.req, mockGetSettings.res, mockGetSettings.next);
    assert(mockGetSettings.getResult().data?.settings?.attendanceThreshold === 75, 'Initial default threshold is 75%');

    // Update threshold to 80%
    const mockUpdateSettings = createMockReqRes({
      user: adminUser,
      body: {
        attendanceThreshold: 80,
        marksThreshold: 50,
        description: 'Stricter exam eligibility policy: 80% threshold',
      },
    });
    await updateRiskSettings(mockUpdateSettings.req, mockUpdateSettings.res, mockUpdateSettings.next);
    const updateRes = mockUpdateSettings.getResult();
    assert(updateRes.status === 200, 'Administrator successfully updated threshold to 80%');
    assert(updateRes.data?.settings?.attendanceThreshold === 80, 'Config reflects 80%');
    assert(updateRes.data?.recalculatedCount >= 3, 'All students re-evaluated against new 80% threshold');

    // Verify student risk record updated
    const s3Risk = await calculateStudentRisk(student3._id);
    assert(typeof s3Risk.metrics.attendanceThreshold === 'number', 'Risk metrics include active configured threshold');
    assert(s3Risk.metrics.attendanceThreshold === 80, 'Active threshold is 80%');

    // Reset threshold back to standard 75%
    const mockResetSettings = createMockReqRes({
      user: adminUser,
      body: { attendanceThreshold: 75, marksThreshold: 50 },
    });
    await updateRiskSettings(mockResetSettings.req, mockResetSettings.res, mockResetSettings.next);
    assert(mockResetSettings.getResult().data?.settings?.attendanceThreshold === 75, 'Reset threshold back to standard 75%');

    console.log('\n[Test Suite 9] Role-Based Privacy & Authorization Enforcement');
    // Student 1 tries to access Student 2's attendance summary -> should get 403 Forbidden
    const mockPrivStudent = createMockReqRes({
      user: student1.user,
      params: { studentId: student2._id.toString() },
    });
    await getAttendanceSummary(mockPrivStudent.req, mockPrivStudent.res, mockPrivStudent.next);
    assert(mockPrivStudent.getResult().status === 403, 'Student blocked (403 Forbidden) from viewing another student attendance');

    // Parent 2 (linked to Student 2) tries to access Student 1's marks -> should get 403 Forbidden
    const parentUser2 = await User.findOne({ email: 'meera.patel@saepcs.edu' });
    const mockPrivParent = createMockReqRes({
      user: parentUser2,
      params: { studentId: student1._id.toString() },
    });
    await getStudentMarksAnalytics(mockPrivParent.req, mockPrivParent.res, mockPrivParent.next);
    assert(mockPrivParent.getResult().status === 403, 'Parent blocked (403 Forbidden) from viewing non-linked student marks');

    // Parent 2 accessing linked ward Student 2 -> should get 200 OK
    const mockAllowedParent = createMockReqRes({
      user: parentUser2,
      params: { studentId: student2._id.toString() },
    });
    await getStudentMarksAnalytics(mockAllowedParent.req, mockAllowedParent.res, mockAllowedParent.next);
    assert(mockAllowedParent.getResult().status === 200, 'Parent allowed (200 OK) to view linked ward academic marks');

    console.log('\n================================================================');
    console.log(`📊 INTEGRATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
  } finally {
    await disconnectDB();
  }
};

runIntegrationTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
