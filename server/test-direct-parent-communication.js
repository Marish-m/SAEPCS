import { connectDB, disconnectDB } from './src/config/db.js';
import User from './src/models/User.js';
import Student from './src/models/Student.js';
import Parent from './src/models/Parent.js';
import Department from './src/models/Department.js';
import Subject from './src/models/Subject.js';
import Faculty from './src/models/Faculty.js';
import Attendance from './src/models/Attendance.js';
import Notification from './src/models/Notification.js';
import smsService from './src/services/smsService.js';
import voiceService from './src/services/voiceService.js';
import emailService from './src/services/emailService.js';
import notificationService from './src/services/notificationService.js';
import {
  getStudentParentContact,
  updateStudentParentContact,
  validatePhoneWithCountryCode,
  validateOptionalEmail,
} from './src/controllers/studentController.js';
import {
  testParentNotification,
  sendFacultyParentMessage,
  scheduleParentMeeting,
  sendAcademicAnnouncement,
  getFacultyNotificationHistory,
  retryNotification,
} from './src/controllers/notificationController.js';

// Helper for Mock Express req/res
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

const runDirectCommunicationTests = async () => {
  console.log('\n================================================================');
  console.log('🧪 VERIFICATION SUITE: DIRECT PARENT COMMUNICATION & ACCESSIBILITY');
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

  try {
    await connectDB();

    // -------------------------------------------------------------------------
    // TEST SUITE 1: PHONE & EMAIL VALIDATIONS FOR DIRECT PARENT CONTACT
    // -------------------------------------------------------------------------
    console.log('[Test Suite 1] Phone Number and Email Validation Rules');

    // Phone with country code validation
    assert(validatePhoneWithCountryCode('+91 9876543210'), 'Accepts +91 with space');
    assert(validatePhoneWithCountryCode('+919876543210'), 'Accepts +91 without space');
    assert(validatePhoneWithCountryCode('+1-555-0202'), 'Accepts +1 North American format');
    assert(!validatePhoneWithCountryCode('9876543210'), 'Rejects 10-digit number missing country code prefix');
    assert(!validatePhoneWithCountryCode(''), 'Rejects empty phone number');
    assert(!validatePhoneWithCountryCode('abcdefghij'), 'Rejects alphabetic input');

    // Optional email validation
    assert(validateOptionalEmail(''), 'Allows empty string for parents without email');
    assert(validateOptionalEmail(null), 'Allows null for parents without email');
    assert(validateOptionalEmail('parent@example.com'), 'Accepts valid email syntax');
    assert(!validateOptionalEmail('invalid-email-string'), 'Rejects malformed email string');

    // Baseline User Setup
    let adminUser = await User.findOne({ role: 'admin' });
    let facultyUser = await User.findOne({ role: 'faculty' });
    let studentUser = await User.findOne({ email: 'rohan.patel@saepcs.edu' });

    if (!studentUser) {
      studentUser = await User.findOne({ role: 'student' });
    }

    let studentDoc = await Student.findOne({ user: studentUser._id });

    // -------------------------------------------------------------------------
    // TEST SUITE 2: FACULTY PORTAL - GET & UPDATE PARENT CONTACT PREFERENCES
    // -------------------------------------------------------------------------
    console.log('\n[Test Suite 2] Faculty Portal Parent Contact Management API');

    // 2.1 Update parent contact with valid phone, optional email, and Tamil language preference
    const { req: updateReq, res: updateRes, getResult: getUpdateRes } = createMockReqRes({
      user: facultyUser,
      params: { id: studentDoc._id.toString() },
      body: {
        name: 'Meera Patel',
        relationship: 'Mother',
        phone: '+91 98401 23456',
        email: 'meera.patel@saepcs.edu',
        preferredLanguage: 'ta',
        preferredMethod: 'Voice Call',
        consentStatus: 'Consented',
        notes: 'Prefers spoken Tamil voice calls for low attendance.',
      },
    });

    await updateStudentParentContact(updateReq, updateRes, () => {});
    const updateResult = getUpdateRes();

    assert(updateResult.status === 200, 'PUT /api/students/:id/parent-contact returns 200 OK');
    assert(updateResult.data.success === true, 'Response indicates success is true');
    assert(updateResult.data.student.parentContact.phone === '+91 98401 23456', 'Phone with country code persisted');
    assert(updateResult.data.student.parentContact.preferredLanguage === 'ta', 'Preferred language saved as "ta" (Tamil)');
    assert(updateResult.data.student.parentContact.preferredMethod === 'Voice Call', 'Preferred method saved as "Voice Call"');

    // 2.2 Reject missing country code
    const { req: badPhoneReq, res: badPhoneRes, getResult: getBadPhoneRes } = createMockReqRes({
      user: facultyUser,
      params: { id: studentDoc._id.toString() },
      body: {
        name: 'Meera Patel',
        phone: '9840123456', // Missing + country code
      },
    });

    await updateStudentParentContact(badPhoneReq, badPhoneRes, () => {});
    const badPhoneResult = getBadPhoneRes();
    assert(badPhoneResult.status === 400, 'Rejects phone missing country code with 400 Bad Request');
    assert(badPhoneResult.data.message.includes('country code'), 'Error message guides user to include country code');

    // 2.3 GET Parent Contact details
    const { req: getReq, res: getRes, getResult: getContactRes } = createMockReqRes({
      user: facultyUser,
      params: { id: studentDoc._id.toString() },
    });

    await getStudentParentContact(getReq, getRes, () => {});
    const getContactResult = getContactRes();

    assert(getContactResult.status === 200, 'GET /api/students/:id/parent-contact returns 200 OK');
    assert(getContactResult.data.student.parentContact.name === 'Meera Patel', 'Fetches updated parent contact name');

    // -------------------------------------------------------------------------
    // TEST SUITE 3: NON-LITERATE ACCESSIBILITY & VOICE CALL GENERATION (TAMIL & ENGLISH)
    // -------------------------------------------------------------------------
    console.log('\n[Test Suite 3] Voice Calls for Non-Literate Accessibility (Tamil & English)');

    const voiceMsgs = voiceService.generateVoiceMessages({
      studentName: 'Rohan Patel',
      issueType: 'attendance_alert',
      metricValue: '62%',
    });

    assert(voiceMsgs.en.includes('Hello. This is an academic notification'), 'English spoken greeting format verified');
    assert(voiceMsgs.en.includes('Rohan Patel'), 'Spoken audio includes student name');
    assert(voiceMsgs.ta.includes('வணக்கம்'), 'Native Tamil script greeting (வணக்கம்) generated');
    assert(voiceMsgs.ta_transliterated.includes('Vanakkam'), 'Transliterated Tamil generated for phonetic TTS');

    // Twilio Voice TwiML generation
    const twiml = voiceService.generateTwiML({
      message: voiceMsgs.ta_transliterated,
      language: 'ta',
    });
    assert(twiml.includes('<Response>'), 'Generates compliant TwiML XML structure');
    assert(twiml.includes('language="ta-IN"'), 'Specifies Indian Tamil TTS language (ta-IN)');

    // Outbound voice call simulation when Twilio credentials not provided
    const outboundVoiceRes = await voiceService.placeOutboundCall({
      toPhone: '+91 98401 23456',
      studentName: 'Rohan Patel',
      issueType: 'attendance_alert',
      metricValue: '62%',
      languagePreference: 'ta',
      consentVerified: true,
    });

    assert(outboundVoiceRes.success === true, 'Outbound voice call dispatcher returns success');
    assert(outboundVoiceRes.simulated === true, 'Clearly flagged as simulated in dev mode');
    assert(outboundVoiceRes.status === 'simulated', 'Status recorded as "simulated" (no false claims)');
    assert(Boolean(outboundVoiceRes.callSid), 'Generates unique Call SID identifier');

    // -------------------------------------------------------------------------
    // TEST SUITE 4: SMS PROVIDER ABSTRACTION & SHORT MESSAGING
    // -------------------------------------------------------------------------
    console.log('\n[Test Suite 4] SMS Gateway & Direct Parent Messaging');

    const formattedSMS = smsService.formatDirectParentAlert({
      studentName: 'Rohan Patel',
      eventType: 'attendance_alert',
      metric: '62%',
      language: 'en',
    });

    assert(formattedSMS.includes('Dear Parent'), 'Begins with direct parent greeting');
    assert(formattedSMS.includes('Rohan Patel'), 'Includes student name in SMS body');
    assert(formattedSMS.includes('62%'), 'Includes current metric in SMS body');
    assert(formattedSMS.length <= 160, 'SMS message conforms to single-segment standard (<= 160 chars)');

    // Tamil SMS
    const tamilSMS = smsService.formatDirectParentAlert({
      studentName: 'Rohan',
      eventType: 'absence_alert',
      language: 'ta',
    });
    assert(tamilSMS.includes('அன்பார்ந்த பெற்றோரே'), 'Tamil SMS begins with polite Tamil parent salutation');

    // SMS simulation dispatch
    const smsDispatchRes = await smsService.sendSMS({
      to: '+91 98401 23456',
      message: formattedSMS,
    });
    assert(smsDispatchRes.success === true, 'SMS simulated gateway dispatches message');
    assert(Boolean(smsDispatchRes.messageId), 'Logs simulated provider messageId');

    // -------------------------------------------------------------------------
    // TEST SUITE 5: AUTOMATIC NOTIFICATION ROUTING & CHANNEL SELECTION
    // -------------------------------------------------------------------------
    console.log('\n[Test Suite 5] Intelligent Notification Routing Engine');

    // 5.1 Routine Announcement -> Dispatches SMS / Email according to preference
    const routineRes = await notificationService.dispatchDirectParentNotification({
      studentId: studentDoc._id,
      eventType: 'announcement',
      title: 'College Annual Sports Meet Notice',
      message: 'The annual sports meet is scheduled for next Monday.',
      channelOverride: 'SMS',
      force: true,
    });
    assert(routineRes.success === true, 'Dispatches routine announcement');
    assert(routineRes.channels.sms.success === true, 'Delivered through requested SMS channel');

    // 5.2 Low Attendance Warning -> Triggers SMS and Voice Call
    const lowAttRes = await notificationService.dispatchDirectParentNotification({
      studentId: studentDoc._id,
      eventType: 'attendance_alert',
      metricValue: '60% Attendance',
      details: 'Attendance deficit below mandatory 75% benchmark',
      channelOverride: 'Automatic',
      force: true,
    });
    assert(lowAttRes.success === true, 'Dispatches low attendance alert');
    assert(lowAttRes.channels.sms.success === true, 'SMS dispatched for attendance shortage');
    assert(lowAttRes.channels.voice.success === true, 'Voice call dispatched for low attendance warning');

    // 5.3 Email Unavailable Fallback: When parent has no email, routes automatically to SMS/Voice
    const noEmailStudent = await Student.findOne({ 'parentContact.email': '' });
    if (noEmailStudent) {
      const fallbackRes = await notificationService.dispatchDirectParentNotification({
        studentId: noEmailStudent._id,
        eventType: 'attendance_alert',
        channelOverride: 'Email', // Explicitly requested email, but parent has none!
        force: true,
      });
      assert(fallbackRes.channels.sms.success === true, 'Gracefully falls back to SMS when email is unavailable');
    }

    // -------------------------------------------------------------------------
    // TEST SUITE 6: PARENTAL CONSENT & TELECOM OPT-OUT ENFORCEMENT
    // -------------------------------------------------------------------------
    console.log('\n[Test Suite 6] Parental Consent & Telecom Opt-Out Policy');

    // Update consent to 'Opted Out'
    await Student.findByIdAndUpdate(studentDoc._id, {
      'parentContact.consentStatus': 'Opted Out',
    });

    const optOutDispatch = await notificationService.dispatchDirectParentNotification({
      studentId: studentDoc._id,
      eventType: 'attendance_alert',
      metricValue: '55%',
      force: true,
    });

    assert(optOutDispatch.status === 'skipped', 'Notification is skipped when parent has opted out');
    assert(optOutDispatch.message.includes('opted out'), 'Returns descriptive consent notice');

    // Restore consent
    await Student.findByIdAndUpdate(studentDoc._id, {
      'parentContact.consentStatus': 'Consented',
    });

    // -------------------------------------------------------------------------
    // TEST SUITE 7: DUPLICATE NOTIFICATION SUPPRESSION (24-HOUR RULE)
    // -------------------------------------------------------------------------
    console.log('\n[Test Suite 7] Duplicate Notification Suppression');

    // Send first notice
    await notificationService.dispatchDirectParentNotification({
      studentId: studentDoc._id,
      eventType: 'frequent_absent',
      metricValue: '3 Absences',
      force: true,
    });

    // Attempt second notice within 24 hours without force flag
    const dupRes = await notificationService.dispatchDirectParentNotification({
      studentId: studentDoc._id,
      eventType: 'frequent_absent',
      metricValue: '3 Absences',
      force: false,
    });

    assert(dupRes.suppressedDuplicate === true, 'Duplicate warning suppressed within 24h window');
    assert(dupRes.status === 'suppressed', 'Status recorded as suppressed');

    // -------------------------------------------------------------------------
    // TEST SUITE 8: FACULTY DIRECT ACTIONS (TEST, DIRECT MSG, SCHEDULE MEETING)
    // -------------------------------------------------------------------------
    console.log('\n[Test Suite 8] Faculty Portal Direct Actions');

    // 8.1 Test Notification API
    const { req: testReq, res: testRes, getResult: getTestResult } = createMockReqRes({
      user: facultyUser,
      params: { studentId: studentDoc._id.toString() },
      body: { channel: 'Automatic', language: 'en' },
    });
    await testParentNotification(testReq, testRes, () => {});
    const testApiResult = getTestResult();
    assert(testApiResult.status === 200, 'POST /api/notifications/test-parent/:studentId returns 200 OK');
    assert(testApiResult.data.success === true, 'Test notification dispatched successfully');

    // 8.2 Direct Faculty Message API
    const { req: msgReq, res: msgRes, getResult: getMsgResult } = createMockReqRes({
      user: facultyUser,
      body: {
        studentId: studentDoc._id.toString(),
        subject: 'Laboratory Coursework Review',
        message: 'Please advise Rohan to complete Experiment 4 before Friday.',
        urgency: 'Normal',
      },
    });
    await sendFacultyParentMessage(msgReq, msgRes, () => {});
    const msgApiResult = getMsgResult();
    assert(msgApiResult.status === 200, 'POST /api/notifications/faculty-message returns 200 OK');
    assert(msgApiResult.data.success === true, 'Faculty direct message delivered to parent');

    // 8.3 Schedule Meeting API
    const { req: meetReq, res: meetRes, getResult: getMeetResult } = createMockReqRes({
      user: facultyUser,
      body: {
        studentId: studentDoc._id.toString(),
        meetingDate: new Date(Date.now() + 86400000).toISOString(),
        meetingTime: '11:00 AM',
        meetingType: 'In-Person',
        location: 'Department Room 204',
        agenda: 'Review internal exam preparation',
      },
    });
    await scheduleParentMeeting(meetReq, meetRes, () => {});
    const meetApiResult = getMeetResult();
    assert(meetApiResult.status === 200, 'POST /api/notifications/schedule-meeting returns 200 OK');
    assert(meetApiResult.data.success === true, 'Meeting invite dispatched to parent');

    // 8.4 Faculty Notification History API
    const { req: histReq, res: histRes, getResult: getHistResult } = createMockReqRes({
      user: facultyUser,
      query: { limit: 10 },
    });
    await getFacultyNotificationHistory(histReq, histRes, () => {});
    const histApiResult = getHistResult();
    assert(histApiResult.status === 200, 'GET /api/notifications/faculty-history returns 200 OK');
    assert(histApiResult.data.logs.length > 0, 'Returns notification history records');
    assert(Boolean(histApiResult.data.summary), 'Includes summary of delivered/simulated/failed counts');

    // -------------------------------------------------------------------------
    // TEST SUITE 9: FAILED NOTIFICATION RETRY DISPATCH
    // -------------------------------------------------------------------------
    console.log('\n[Test Suite 9] Failure Recovery and Retry Policy');

    const tempFailedNotif = await Notification.create({
      recipient: studentUser._id,
      student: studentDoc._id,
      title: 'Temporary Failure Retry Test',
      message: 'Testing non-breaking retry mechanism',
      type: 'attendance_alert',
      channel: 'sms',
      status: 'failed',
      smsDetails: {
        to: '+91 98401 23456',
        status: 'failed',
        error: 'Simulated Gateway Glitch',
        attempts: 1,
      },
      retryInfo: { attempts: 0, maxRetries: 3, error: 'Initial failure' },
    });

    const retriedDoc = await notificationService.retryFailedNotification(tempFailedNotif._id);
    assert(retriedDoc.retryInfo.attempts === 1, 'Retry increments attempt counter to 1');
    assert(retriedDoc.smsDetails.status === 'delivered', 'SMS recovered to delivered status on retry');
    assert(retriedDoc.status === 'delivered', 'Overall status updated to delivered');

    // -------------------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`📊 DIRECT COMMUNICATION SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    await disconnectDB();
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error running direct parent communication test suite:', error);
    await disconnectDB();
    process.exit(1);
  }
};

runDirectCommunicationTests();

