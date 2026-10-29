import { connectDB, disconnectDB } from './src/config/db.js';
import { seedDatabase } from './src/utils/seedData.js';
import User from './src/models/User.js';
import Student from './src/models/Student.js';
import Parent from './src/models/Parent.js';
import Notification from './src/models/Notification.js';
import AcademicRisk from './src/models/AcademicRisk.js';
import emailService from './src/services/emailService.js';
import smsService from './src/services/smsService.js';
import voiceService from './src/services/voiceService.js';
import notificationService from './src/services/notificationService.js';
import { syncRiskRecord } from './src/services/riskAnalysisService.js';
import {
  getMyNotifications,
  getParentNotificationHistory,
  getAdminNotificationLogs,
  retryNotification,
  updateNotificationPreferences,
  getVoiceConfig,
} from './src/controllers/notificationController.js';

const runTests = async () => {
  console.log('\n================================================================');
  console.log('🧪 UNIT & INTEGRATION TESTS: PARENT COMMUNICATION & NOTIFICATIONS');
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

    // Baseline entities
    const adminUser = await User.findOne({ role: 'admin' });
    const facultyUser = await User.findOne({ role: 'faculty' });
    const studentUser = await User.findOne({ email: 'student@saepcs.edu' });
    const studentDoc = await Student.findOne({ user: studentUser._id }).populate('user');
    const atRiskUser = await User.findOne({ email: 'rohan.patel@saepcs.edu' });
    const atRiskStudentDoc = await Student.findOne({ user: atRiskUser._id })
      .populate('user')
      .populate('parents');

    const parentUser = await User.findOne({ email: 'parent@saepcs.edu' });
    const atRiskParentUser = await User.findOne({ email: 'meera.patel@saepcs.edu' });
    const atRiskParentDoc = await Parent.findOne({ user: atRiskParentUser._id });

    // =========================================================================
    // TEST SUITE 1: EMAIL SERVICE WITH ACADEMIC WARNING FORMATTING & SMTP
    // =========================================================================
    console.log('[Test Suite 1] Email Service with Rich Academic Warning Templates');

    const sampleDate = new Date('2026-10-15');
    const emailResult = await emailService.sendAcademicWarningEmail({
      to: 'parent@saepcs.edu',
      studentName: 'Rohan Patel',
      rollNumber: 'CS2026-003',
      issue: 'Attendance Deficit Alert',
      currentMetric: '62% (Threshold: 75%)',
      recommendedAction: 'Schedule remedial advisory with mentor Dr. Alan Turing.',
      date: sampleDate,
      isParent: true,
    });

    assert(emailResult.success === true, 'Email service sends message successfully');
    assert(Boolean(emailResult.messageId), 'Email dispatch returns unique provider messageId');
    assert(emailResult.status === 'delivered', 'Email delivery status recorded as "delivered"');
    assert(emailResult.attempts >= 1, 'Email tracks transmission attempts (attempts >= 1)');

    // =========================================================================
    // TEST SUITE 2: SMS SERVICE PROVIDER ABSTRACTION & STATUS TRACKING
    // =========================================================================
    console.log('\n[Test Suite 2] SMS Service Provider Abstraction & Verified Numbers');

    assert(['mock', 'twilio', 'fast2sms'].includes(smsService.provider), 'SMS provider abstraction configured');

    const smsText = smsService.formatAcademicWarningSMS({
      studentName: 'Rohan Patel',
      issue: 'Low Attendance',
      currentMetric: '62%',
      recommendedAction: 'Contact faculty mentor',
    });

    assert(smsText.includes('Rohan Patel'), 'SMS text includes student name');
    assert(smsText.includes('62%'), 'SMS text includes current metric');
    assert(smsText.length <= 160, 'SMS formatted within 160 character boundary');

    const smsResult = await smsService.sendSMS({
      to: '+1-555-0202',
      message: smsText,
    });

    assert(smsResult.success === true, 'SMS successfully dispatched to verified recipient');
    assert(Boolean(smsResult.messageId), 'Logs provider message ID (messageId/SID)');
    assert(smsResult.status === 'delivered', 'SMS delivery status is "delivered"');
    assert(Boolean(smsResult.sentAt), 'SMS delivery timestamp is recorded');

    // =========================================================================
    // TEST SUITE 3: NON-BREAKING FAILURE RECOVERY FOR SMS & EMAIL
    // =========================================================================
    console.log('\n[Test Suite 3] Non-Breaking Failure Handling Without Breaking Flow');

    // Attempt SMS dispatch with empty destination
    const failedSms = await smsService.sendSMS({
      to: '',
      message: 'Test message',
    });

    assert(failedSms.success === false, 'Handles missing/invalid recipient cleanly without crash');
    assert(failedSms.status === 'failed', 'Sets status to "failed" on transmission error');
    assert(Boolean(failedSms.error), 'Captures descriptive error string');

    // Ensure database operations still work smoothly after provider error
    const testDoc = await User.findById(adminUser._id);
    assert(Boolean(testDoc), 'Academic record operations remain completely uninterrupted');

    // =========================================================================
    // TEST SUITE 4: VOICE-FRIENDLY NOTIFICATIONS & INDIAN LANGUAGES (TAMIL & ENGLISH)
    // =========================================================================
    console.log('\n[Test Suite 4] Voice-Friendly Notifications in Tamil and English');

    const voiceMessages = voiceService.generateVoiceMessages({
      studentName: 'Rohan Patel',
      issueType: 'attendance_alert',
      metricValue: '62%',
    });

    assert(Boolean(voiceMessages.en), 'Generates clear English voice message');
    assert(voiceMessages.en.includes('Rohan Patel'), 'English voice message includes student name');
    assert(voiceMessages.en.includes('62%'), 'English voice message includes current metric');

    assert(Boolean(voiceMessages.ta), 'Generates native Tamil voice message');
    assert(voiceMessages.ta.includes('வணக்கம்'), 'Tamil message includes native Tamil cultural greeting (வணக்கம்)');

    assert(Boolean(voiceMessages.ta_transliterated), 'Generates transliterated Tamil message for phonetic speech synthesis');
    assert(voiceMessages.ta_transliterated.includes('Vanakkam'), 'Transliterated message contains "Vanakkam"');
    assert(
      voiceMessages.ta_transliterated.includes('Please contact the class faculty'),
      'Transliterated message contains clear institutional advisory instruction'
    );

    // Test Voice Capabilities & Transparent Provider Status
    const voiceCaps = voiceService.getVoiceCapabilities();
    assert(voiceCaps.browserTTS.supported === true, 'Browser Text-to-Speech is supported');
    assert(
      voiceCaps.browserTTS.supportedLanguages.some((l) => l.code === 'ta'),
      'Tamil (ta) registered in supported voice languages'
    );
    assert(
      voiceCaps.browserTTS.supportedLanguages.some((l) => l.code === 'en'),
      'English (en) registered in supported voice languages'
    );
    assert(
      voiceCaps.automatedPhoneCalls.consentMandatory === true,
      'Automated phone calls mandate explicit consent & number verification'
    );

    // Prepare voice record in default browser TTS mode
    const preparedVoice = await voiceService.prepareVoiceNotification({
      toPhone: '+1-555-0202',
      studentName: 'Rohan Patel',
      issueType: 'attendance_alert',
      metricValue: '62%',
      languagePreference: 'ta',
      consentVerified: false,
    });

    assert(preparedVoice.mode === 'browser_tts', 'Defaults to "browser_tts" when automated calling not configured');
    assert(preparedVoice.callSid === '', 'Does NOT claim a phone call was placed when browser TTS is active');
    assert(preparedVoice.provider === 'browser_speech_synthesis', 'Reports browser_speech_synthesis provider');

    // =========================================================================
    // TEST SUITE 5: NOTIFICATION RULES: TRIGGER ON NEW RISK & SEVERITY CHANGE
    // =========================================================================
    console.log('\n[Test Suite 5] Warning Dispatch on New Risk Detection & Severity Transition');

    // Clean previous notifications for clean test slate
    await Notification.deleteMany({ student: atRiskStudentDoc._id });

    // 1. Trigger NEW risk
    const dispatchRes = await notificationService.dispatchAcademicWarning({
      studentId: atRiskStudentDoc._id,
      riskType: 'Attendance',
      severity: 'Medium',
      reason: 'Attendance is 70% in DSA (Threshold: 75%)',
      currentMetric: '70% Attendance',
      recommendedAction: 'Advisory session with faculty mentor.',
      force: true,
    });

    assert(dispatchRes.success === true, 'NotificationService dispatches academic warning');
    assert(dispatchRes.studentNotified === true, 'Student notification record generated');
    assert(dispatchRes.parentNotified === true, 'Linked parent notification record generated');

    const parentNotifDoc = await Notification.findOne({
      recipient: atRiskParentUser._id,
      student: atRiskStudentDoc._id,
    });

    assert(Boolean(parentNotifDoc), 'Parent notification record persisted in MongoDB');
    assert(parentNotifDoc.type === 'attendance_alert', 'Mapped to type "attendance_alert"');
    assert(parentNotifDoc.academicDetails.studentName === 'Rohan Patel', 'Persists student name in academicDetails');
    assert(parentNotifDoc.academicDetails.currentMetric === '70% Attendance', 'Persists currentMetric');
    assert(Boolean(parentNotifDoc.academicDetails.recommendedAction), 'Persists recommendedAction');
    assert(Boolean(parentNotifDoc.voiceMessage.ta), 'Stores Tamil voice message in record');
    assert(parentNotifDoc.deliveryStatus.emailSent === true, 'Marks emailSent true');
    assert(parentNotifDoc.deliveryStatus.smsSent === true, 'Marks smsSent true');

    // 2. Trigger on SEVERITY CHANGE (Medium -> High)
    const severityChangeRes = await notificationService.dispatchAcademicWarning({
      studentId: atRiskStudentDoc._id,
      riskType: 'Attendance',
      severity: 'High',
      previousSeverity: 'Medium',
      reason: 'Attendance dropped further to 60%',
      currentMetric: '60% Attendance',
      recommendedAction: 'Immediate parent-faculty conference required.',
    });

    assert(severityChangeRes.success === true, 'Triggers notification on severity transition (Medium -> High)');
    assert(severityChangeRes.studentNotified === true, 'Dispatches notice upon severity escalation');

    // =========================================================================
    // TEST SUITE 6: DUPLICATE WARNING SUPPRESSION WITHIN 24 HOURS
    // =========================================================================
    console.log('\n[Test Suite 6] Duplicate Warning Suppression for Unresolved Issues');

    const dupRes = await notificationService.dispatchAcademicWarning({
      studentId: atRiskStudentDoc._id,
      riskType: 'Attendance',
      severity: 'High',
      previousSeverity: null, // Repeated evaluation with no severity change
      reason: 'Attendance remains at 60%',
      currentMetric: '60% Attendance',
      force: false,
    });

    assert(dupRes.suppressedDuplicate === true, 'Suppresses duplicate warning within 24 hours');
    assert(dupRes.parentNotified === false, 'Parent is NOT spammed with identical warning');

    // =========================================================================
    // TEST SUITE 7: RETRY HANDLING FOR TEMPORARY FAILURES
    // =========================================================================
    console.log('\n[Test Suite 7] Retry Handling for Temporary Dispatches');

    const failedNotif = await Notification.create({
      recipient: atRiskParentUser._id,
      student: atRiskStudentDoc._id,
      title: 'Temporary Failure Test Alert',
      message: 'Test message for retry handling',
      type: 'low_marks_warning',
      channel: 'all',
      status: 'failed',
      emailDetails: {
        to: atRiskParentUser.email,
        status: 'failed',
        error: 'SMTP Connection timeout (simulated)',
        attempts: 1,
      },
      smsDetails: {
        to: '+1-555-0202',
        status: 'failed',
        provider: 'fast2sms',
        error: 'Gateway network glitch',
        attempts: 1,
      },
      retryInfo: {
        attempts: 0,
        maxRetries: 3,
        error: 'Initial failure',
      },
    });

    const retriedDoc = await notificationService.retryFailedNotification(failedNotif._id);
    assert(retriedDoc.retryInfo.attempts === 1, 'Increments retry attempt counter to 1');
    assert(retriedDoc.emailDetails.status === 'delivered', 'Email recovered to "delivered" status on retry');
    assert(retriedDoc.smsDetails.status === 'delivered', 'SMS recovered to "delivered" status on retry');
    assert(retriedDoc.status === 'delivered', 'Notification status updated to "delivered"');

    // =========================================================================
    // TEST SUITE 8: CONTROLLERS & REST APIS: PARENT HISTORY, ADMIN LOGS, PREFERENCES
    // =========================================================================
    console.log('\n[Test Suite 8] REST API Controllers (Parent History, Admin Logs & Preferences)');

    // 1. Parent Notification History (Authorized Ward)
    const { req: parentReq, res: parentRes, getResult: getParentResult } = createMockReqRes({
      user: atRiskParentUser,
      query: { studentId: atRiskStudentDoc._id.toString() },
    });
    await getParentNotificationHistory(parentReq, parentRes, () => {});
    const parentApiRes = getParentResult();

    assert(parentApiRes.status === 200, 'GET /api/notifications/parent returns 200 OK');
    assert(parentApiRes.data.success === true, 'Parent history response success is true');
    assert(parentApiRes.data.count > 0, 'Returns notification history for linked ward');

    // 2. Parent Notification History (Unauthorized Ward Denial)
    const { req: unauthReq, res: unauthRes, getResult: getUnauthResult } = createMockReqRes({
      user: atRiskParentUser,
      query: { studentId: studentDoc._id.toString() }, // Aarav Sharma (not linked to Meera Patel)
    });
    await getParentNotificationHistory(unauthReq, unauthRes, () => {});
    const unauthApiRes = getUnauthResult();

    assert(unauthApiRes.status === 403, 'Rejects non-linked ward query with 403 Forbidden');

    // 3. Admin Notification Log API with Summary & Filter
    const { req: adminReq, res: adminRes, getResult: getAdminResult } = createMockReqRes({
      user: adminUser,
      query: { channel: 'all', status: 'delivered' },
    });
    await getAdminNotificationLogs(adminReq, adminRes, () => {});
    const adminApiRes = getAdminResult();

    assert(adminApiRes.status === 200, 'GET /api/notifications/admin/logs returns 200 OK');
    assert(Boolean(adminApiRes.data.summary), 'Includes summary object with totals and channel metrics');
    assert(adminApiRes.data.summary.total > 0, 'Total logs count is positive');

    // 4. Update Language Preference API (Tamil)
    const { req: prefReq, res: prefRes, getResult: getPrefResult } = createMockReqRes({
      user: atRiskParentUser,
      body: { languagePreference: 'ta' },
    });
    await updateNotificationPreferences(prefReq, prefRes, () => {});
    const prefApiRes = getPrefResult();

    assert(prefApiRes.status === 200, 'PUT /api/notifications/preferences returns 200 OK');
    assert(prefApiRes.data.preference === 'ta', 'Updates preference to "ta" (Tamil)');

    // 5. Voice Config API
    const { req: voiceReq, res: voiceRes, getResult: getVoiceResult } = createMockReqRes({
      user: atRiskParentUser,
    });
    await getVoiceConfig(voiceReq, voiceRes);
    const voiceApiRes = getVoiceResult();

    assert(voiceApiRes.status === 200, 'GET /api/notifications/voice-config returns 200 OK');
    assert(voiceApiRes.data.config.browserTTS.supported === true, 'Returns browser TTS capabilities');

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n================================================================');
    console.log(`📊 TEST EXECUTION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    await disconnectDB();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Test Suite encountered fatal error:', error);
    await disconnectDB();
    process.exit(1);
  }
};

runTests();
