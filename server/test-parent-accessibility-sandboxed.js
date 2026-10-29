import User from './src/models/User.js';
import Student from './src/models/Student.js';
import Parent from './src/models/Parent.js';
import Notification from './src/models/Notification.js';
import smsService from './src/services/smsService.js';
import voiceService from './src/services/voiceService.js';
import emailService from './src/services/emailService.js';
import notificationService from './src/services/notificationService.js';
import {
  validatePhoneWithCountryCode,
  validateOptionalEmail,
} from './src/controllers/studentController.js';

console.log('\n================================================================');
console.log('🧪 UNIT TEST SUITE: DIRECT PARENT COMMUNICATION & ACCESSIBILITY');
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

// =========================================================================
// TEST SUITE 1: PHONE NUMBER & EMAIL VALIDATION RULES
// =========================================================================
console.log('[Test Suite 1] Mobile Phone & Optional Email Validation');

assert(validatePhoneWithCountryCode('+91 9876543210'), 'Accepts +91 with space');
assert(validatePhoneWithCountryCode('+91 98401 23456'), 'Accepts +91 with grouped digits');
assert(validatePhoneWithCountryCode('+919876543210'), 'Accepts +91 compact format');
assert(validatePhoneWithCountryCode('+1-555-0202'), 'Accepts +1 North American format');
assert(!validatePhoneWithCountryCode('9876543210'), 'Rejects 10-digit number without country code (+)');
assert(!validatePhoneWithCountryCode(''), 'Rejects empty phone number');
assert(!validatePhoneWithCountryCode(null), 'Rejects null phone number');
assert(!validatePhoneWithCountryCode('invalid-string'), 'Rejects alphanumeric string');

assert(validateOptionalEmail(''), 'Allows empty string for parents without email');
assert(validateOptionalEmail(null), 'Allows null for parents without email');
assert(validateOptionalEmail('parent@example.com'), 'Accepts valid email address');
assert(!validateOptionalEmail('not-an-email'), 'Rejects malformed email string');

// =========================================================================
// TEST SUITE 2: MONGOOSE SCHEMAS & NEW FIELDS VERIFICATION
// =========================================================================
console.log('\n[Test Suite 2] Mongoose Model Schemas for Parent Contact & Notifications');

// Student model parentContact schema
const studentSchemaPaths = Student.schema.paths;
assert(Boolean(studentSchemaPaths['parentContact.phone']), 'Student schema contains parentContact.phone');
assert(Boolean(studentSchemaPaths['parentContact.name']), 'Student schema contains parentContact.name');
assert(Boolean(studentSchemaPaths['parentContact.email']), 'Student schema contains parentContact.email');
assert(Boolean(studentSchemaPaths['parentContact.preferredLanguage']), 'Student schema contains parentContact.preferredLanguage');
assert(Boolean(studentSchemaPaths['parentContact.preferredMethod']), 'Student schema contains parentContact.preferredMethod');
assert(Boolean(studentSchemaPaths['parentContact.consentStatus']), 'Student schema contains parentContact.consentStatus');

const parentContactMethodEnum = studentSchemaPaths['parentContact.preferredMethod'].options.enum;
assert(parentContactMethodEnum.includes('Automatic'), 'Method enum includes "Automatic"');
assert(parentContactMethodEnum.includes('Voice Call'), 'Method enum includes "Voice Call"');
assert(parentContactMethodEnum.includes('SMS'), 'Method enum includes "SMS"');
assert(parentContactMethodEnum.includes('Email'), 'Method enum includes "Email"');

// Parent model extensions
const parentSchemaPaths = Parent.schema.paths;
assert(Boolean(parentSchemaPaths['preferredNotificationMethod']), 'Parent schema contains preferredNotificationMethod');
assert(Boolean(parentSchemaPaths['consentStatus']), 'Parent schema contains consentStatus');

// Notification model extensions
const notifSchemaPaths = Notification.schema.paths;
const notifTypeEnum = notifSchemaPaths['type'].options.enum;
assert(notifTypeEnum.includes('attendance_alert'), 'Notification type enum includes "attendance_alert"');
assert(notifTypeEnum.includes('frequent_absent'), 'Notification type enum includes "frequent_absent"');
assert(notifTypeEnum.includes('low_marks_warning'), 'Notification type enum includes "low_marks_warning"');
assert(notifTypeEnum.includes('announcement'), 'Notification type enum includes "announcement"');
assert(notifTypeEnum.includes('faculty_message'), 'Notification type enum includes "faculty_message"');
assert(notifTypeEnum.includes('meeting_scheduled'), 'Notification type enum includes "meeting_scheduled"');
assert(notifTypeEnum.includes('test_notification'), 'Notification type enum includes "test_notification"');

const notifStatusEnum = notifSchemaPaths['status'].options.enum;
assert(notifStatusEnum.includes('delivered'), 'Notification status enum includes "delivered"');
assert(notifStatusEnum.includes('simulated'), 'Notification status enum includes "simulated"');
assert(notifStatusEnum.includes('failed'), 'Notification status enum includes "failed"');
assert(notifStatusEnum.includes('skipped'), 'Notification status enum includes "skipped"');

assert(Boolean(notifSchemaPaths['deliveryStatus.voiceCallPlaced']), 'Notification tracks deliveryStatus.voiceCallPlaced');
assert(Boolean(notifSchemaPaths['deliveryStatus.simulated']), 'Notification tracks deliveryStatus.simulated');
assert(Boolean(notifSchemaPaths['voiceDetails.transcript']), 'Notification tracks voiceDetails.transcript');
assert(Boolean(notifSchemaPaths['voiceDetails.callSid']), 'Notification tracks voiceDetails.callSid');

// =========================================================================
// TEST SUITE 3: VOICE CALL GENERATION & NON-LITERACY ACCESSIBILITY
// =========================================================================
console.log('\n[Test Suite 3] Voice-Friendly Notifications in English, Tamil & Hindi');

const spokenVoice = voiceService.generateVoiceMessages({
  studentName: 'Rohan Patel',
  issueType: 'attendance_alert',
  metricValue: '62%',
});

assert(spokenVoice.en.includes('Hello. This is an academic notification'), 'English spoken alert generated');
assert(spokenVoice.en.includes('Rohan Patel'), 'English spoken alert includes student name');
assert(spokenVoice.en.includes('62%'), 'English spoken alert includes current metric');
assert(spokenVoice.ta.includes('வணக்கம்'), 'Tamil spoken alert includes native Tamil greeting (வணக்கம்)');
assert(spokenVoice.ta_transliterated.includes('Vanakkam'), 'Transliterated Tamil greeting (Vanakkam) provided');
assert(spokenVoice.hi.includes('नमस्ते'), 'Hindi spoken alert includes greeting (नमस्ते)');

// Consecutive daily absence voice message
const absenceVoice = voiceService.generateVoiceMessages({
  studentName: 'Rohan Patel',
  issueType: 'frequent_absent',
});
assert(absenceVoice.en.includes('absent today'), 'Voice message conveys absence clearly');
assert(absenceVoice.ta.includes('இன்று கல்லூரிக்கு வரவில்லை'), 'Tamil voice message conveys absence in Tamil');

// Spoken Meeting voice message
const meetingVoice = voiceService.generateVoiceMessages({
  studentName: 'Rohan Patel',
  issueType: 'meeting_scheduled',
  details: 'Date: 30 Oct 2026 at 10:00 AM',
});
assert(meetingVoice.en.includes('meeting with faculty has been scheduled'), 'Meeting voice notice generated');

// Twilio Voice TwiML generation
const twimlXml = voiceService.generateTwiML({
  message: spokenVoice.ta_transliterated,
  language: 'ta',
});
assert(twimlXml.includes('<Response>'), 'Generates valid TwiML XML tag <Response>');
assert(twimlXml.includes('<Say'), 'Generates <Say> text-to-speech tag');
assert(twimlXml.includes('language="ta-IN"'), 'Specifies Indian Tamil TTS dialect');

// Outbound Voice Call in Simulation Mode
const simVoiceCall = await voiceService.placeOutboundCall({
  toPhone: '+91 98401 23456',
  studentName: 'Rohan Patel',
  issueType: 'attendance_alert',
  metricValue: '62%',
  languagePreference: 'ta',
  consentVerified: true,
});

assert(simVoiceCall.success === true, 'Voice call dispatcher executes cleanly');
assert(simVoiceCall.simulated === true, 'Clearly flagged as simulated in dev mode');
assert(simVoiceCall.status === 'simulated', 'Status accurately recorded as "simulated" (no false claims)');
assert(simVoiceCall.callSid.startsWith('SIM_CALL_'), 'Generates descriptive simulated Call SID');

// Consent restriction on voice calling
const optOutVoiceCall = await voiceService.placeOutboundCall({
  toPhone: '+91 98401 23456',
  studentName: 'Rohan Patel',
  issueType: 'attendance_alert',
  consentVerified: false,
});
assert(optOutVoiceCall.success === false, 'Blocks voice call when consent is unverified');
assert(optOutVoiceCall.status === 'skipped', 'Marks status as skipped');

// =========================================================================
// TEST SUITE 4: SMS PROVIDER ABSTRACTION & SHORT MESSAGING
// =========================================================================
console.log('\n[Test Suite 4] SMS Gateway Formatting & Multi-Language Support');

const smsText = smsService.formatDirectParentAlert({
  studentName: 'Rohan Patel',
  eventType: 'attendance_alert',
  metric: '62%',
  language: 'en',
});
assert(smsText.includes('Dear Parent'), 'Begins with direct parent salutation');
assert(smsText.includes('Rohan Patel'), 'Includes student name');
assert(smsText.includes('62%'), 'Includes current metric');
assert(smsText.length <= 160, 'Adheres to 160 character boundary');

const absenceSms = smsService.formatDirectParentAlert({
  studentName: 'Rohan',
  eventType: 'absence_alert',
  language: 'en',
});
assert(absenceSms.includes('your child Rohan was absent today'), 'Formats absence alert per requirement specification');

const tamilSms = smsService.formatDirectParentAlert({
  studentName: 'Rohan',
  eventType: 'absence_alert',
  language: 'ta',
});
assert(tamilSms.includes('அன்பார்ந்த பெற்றோரே'), 'Tamil SMS begins with polite Tamil salutation');
assert(tamilSms.includes('இன்று வரவில்லை'), 'Tamil SMS communicates absence clearly');

// Test provider recognition & diagnostics
const providerInfo = smsService.getProviderInfo();
assert(providerInfo.hasApiKey === true, 'Recognizes configured Fast2SMS API key in server/.env');
assert(providerInfo.provider === 'fast2sms' || providerInfo.configuredProvider === 'fast2sms', 'Detects fast2sms provider');

// Simulated SMS dispatch (under mock mode to verify fallback simulation)
const origSmsProvider = process.env.SMS_PROVIDER;
process.env.SMS_PROVIDER = 'mock';
const smsResult = await smsService.sendSMS({
  to: '+91 98401 23456',
  message: smsText,
});
process.env.SMS_PROVIDER = origSmsProvider;
assert(smsResult.success === true, 'SMS simulated gateway dispatches message');
assert(Boolean(smsResult.messageId), 'Logs simulated provider messageId');
assert(smsResult.simulated === true, 'Clearly flagged as simulated in dev mode');

// Rejection of empty recipient
const failedSms = await smsService.sendSMS({ to: '', message: 'Test' });
assert(failedSms.success === false, 'Rejects empty recipient cleanly without throwing error');

// =========================================================================
// TEST SUITE 5: EMAIL SERVICE WITH INSTITUTIONAL CONTACT & NO LOGIN REQUIRED
// =========================================================================
console.log('\n[Test Suite 5] Email Service with Multi-Lingual Advisory & Contact Details');

const emailResult = await emailService.sendAcademicWarningEmail({
  to: 'parent@saepcs.edu',
  studentName: 'Rohan Patel',
  rollNumber: 'CS2026-002',
  issue: 'Attendance Deficit Alert',
  currentMetric: '60% (Threshold: 75%)',
  recommendedAction: 'Schedule remedial advisory with department mentor.',
  language: 'en',
  facultyContact: 'Dr. Alan Turing (+91 44 2250 1234)',
  isParent: true,
});

assert(emailResult.success === true, 'Email service sends message in simulation mode');
assert(Boolean(emailResult.messageId), 'Generates unique messageId');
assert(emailResult.simulated === true, 'Recognizes demo/simulation mode without SMTP timeout');

// Tamil Email
const tamilEmailResult = await emailService.sendAcademicWarningEmail({
  to: 'parent@saepcs.edu',
  studentName: 'Rohan Patel',
  rollNumber: 'CS2026-002',
  issue: 'வருகை பதிவு குறைவு',
  currentMetric: '60%',
  recommendedAction: 'வகுப்பு ஆசிரியரை தொடர்பு கொள்ளவும்.',
  language: 'ta',
  isParent: true,
});
assert(tamilEmailResult.success === true, 'Dispatches Tamil localized email alert');

// =========================================================================
// TEST SUITE 6: ROUTING LOGIC & RISK TYPE MAPPING
// =========================================================================
console.log('\n[Test Suite 6] NotificationService Routing & Risk Mapping');

assert(notificationService.mapRiskTypeToNotificationType('Attendance') === 'attendance_alert', 'Maps Attendance to attendance_alert');
assert(notificationService.mapRiskTypeToNotificationType('Assessment Marks') === 'low_marks_warning', 'Maps Assessment Marks to low_marks_warning');
assert(notificationService.mapRiskTypeToNotificationType('Missing Assignments') === 'assignment_overdue', 'Maps Missing Assignments to assignment_overdue');
assert(notificationService.mapRiskTypeToNotificationType('Excessive Leave') === 'excessive_leave', 'Maps Excessive Leave to excessive_leave');

// Voice capabilities summary
const voiceCaps = voiceService.getVoiceCapabilities();
assert(voiceCaps.browserTTS.supported === true, 'Browser SpeechSynthesis supported');
assert(voiceCaps.browserTTS.supportedLanguages.some((l) => l.code === 'ta'), 'Tamil voice registered');
assert(voiceCaps.browserTTS.supportedLanguages.some((l) => l.code === 'en'), 'English voice registered');
assert(voiceCaps.automatedPhoneCalls.consentMandatory === true, 'Automated calling mandates parental consent');

// =========================================================================
// SUMMARY
// =========================================================================
console.log('\n================================================================');
console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

process.exit(failed > 0 ? 1 : 0);

