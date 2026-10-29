import Notification from '../models/Notification.js';
import User from '../models/User.js';
import Parent from '../models/Parent.js';
import Student from '../models/Student.js';
import emailService from '../services/emailService.js';
import smsService from '../services/smsService.js';
import voiceService from '../services/voiceService.js';
import notificationService from '../services/notificationService.js';

// @desc    Get current user notifications
// @route   GET /api/notifications
// @access  Private
export const getMyNotifications = async (req, res, next) => {
  try {
    const { isRead, limit = 50 } = req.query;
    const filter = { recipient: req.user._id };
    if (isRead !== undefined) {
      filter.isRead = isRead === 'true';
    }

    const notifications = await Notification.find(filter)
      .populate('sender', 'name role')
      .populate('student', 'rollNumber')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit, 10));

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      unreadCount,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get parent notification history for linked ward(s)
// @route   GET /api/notifications/parent
// @access  Private (Parent, Admin)
export const getParentNotificationHistory = async (req, res, next) => {
  try {
    const { studentId } = req.query;
    let query = {};

    if (req.user.role === 'parent') {
      const parent = await Parent.findOne({ user: req.user._id });
      if (!parent) {
        return res.status(404).json({ success: false, message: 'Parent profile not found.' });
      }

      const allowedStudentIds = parent.students.map((s) => s.toString());
      if (studentId) {
        if (!allowedStudentIds.includes(studentId)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: Selected student is not linked to your parent account.',
          });
        }
        query = {
          $or: [
            { recipient: req.user._id, student: studentId },
            { student: studentId },
          ],
        };
      } else {
        query = {
          $or: [
            { recipient: req.user._id },
            { student: { $in: parent.students } },
          ],
        };
      }
    } else if (req.user.role === 'admin' || req.user.role === 'faculty') {
      if (studentId) {
        query = { student: studentId };
      }
    }

    const notifications = await Notification.find(query)
      .populate('sender', 'name role')
      .populate('student', 'rollNumber')
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({
      success: true,
      count: notifications.length,
      notifications,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get system-wide notification log for Admin
// @route   GET /api/notifications/admin/logs
// @access  Private (Admin)
export const getAdminNotificationLogs = async (req, res, next) => {
  try {
    const { channel, status, type, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (channel && channel !== 'All') {
      filter.channel = channel.toLowerCase();
    }
    if (status && status !== 'All') {
      filter.status = status.toLowerCase();
    }
    if (type && type !== 'All') {
      filter.type = type;
    }
    if (search && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { message: { $regex: search.trim(), $options: 'i' } },
        { 'academicDetails.studentName': { $regex: search.trim(), $options: 'i' } },
        { 'academicDetails.rollNumber': { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [logs, total, totalDelivered, totalFailed, totalQueued] = await Promise.all([
      Notification.find(filter)
        .populate('recipient', 'name email phone role')
        .populate('sender', 'name role')
        .populate('student', 'rollNumber')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ status: 'delivered' }),
      Notification.countDocuments({ status: 'failed' }),
      Notification.countDocuments({ status: 'queued' }),
    ]);

    // Channel stats
    const byChannel = {
      email: await Notification.countDocuments({ 'deliveryStatus.emailSent': true }),
      sms: await Notification.countDocuments({ 'deliveryStatus.smsSent': true }),
      voice: await Notification.countDocuments({ 'voiceDetails.status': 'ready' }),
      system: await Notification.countDocuments({ channel: 'system' }),
    };

    res.status(200).json({
      success: true,
      summary: {
        total,
        delivered: totalDelivered,
        failed: totalFailed,
        queued: totalQueued,
        byChannel,
      },
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      logs,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Retry failed notification
// @route   POST /api/notifications/:id/retry
// @access  Private (Admin, Faculty)
export const retryNotification = async (req, res, next) => {
  try {
    const updated = await notificationService.retryFailedNotification(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Notification delivery retried.',
      notification: updated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update notification language preference
// @route   PUT /api/notifications/preferences
// @access  Private
export const updateNotificationPreferences = async (req, res, next) => {
  try {
    const { languagePreference } = req.body;
    if (!['en', 'ta', 'hi'].includes(languagePreference)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid language preference. Allowed: en (English), ta (Tamil), hi (Hindi)',
      });
    }

    req.user.notificationLanguagePreference = languagePreference;
    await req.user.save();

    if (req.user.role === 'parent') {
      await Parent.findOneAndUpdate(
        { user: req.user._id },
        { notificationLanguagePreference: languagePreference }
      );
    }

    res.status(200).json({
      success: true,
      message: `Notification language preference updated to ${languagePreference}.`,
      preference: languagePreference,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Voice capabilities and provider configuration
// @route   GET /api/notifications/voice-config
// @access  Private
export const getVoiceConfig = async (req, res) => {
  const config = voiceService.getVoiceCapabilities();
  res.status(200).json({
    success: true,
    config,
  });
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipient: req.user._id,
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    res.status(200).json({ success: true, message: 'Notification marked as read.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
};

// @desc    Send custom direct notification
// @route   POST /api/notifications/send
// @access  Private (Faculty, Admin)
export const sendCustomNotification = async (req, res, next) => {
  try {
    const {
      recipientId,
      studentId = null,
      title,
      message,
      channel = 'all',
      type = 'general',
      academicDetails = {},
    } = req.body;

    if (!recipientId || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Recipient, title, and message are required fields.',
      });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'Recipient user not found.' });
    }

    const voiceMessages = voiceService.generateVoiceMessages({
      studentName: academicDetails.studentName || recipient.name,
      issueType: type,
      metricValue: academicDetails.currentMetric || '',
    });

    const notif = await Notification.create({
      recipient: recipient._id,
      student: studentId,
      sender: req.user._id,
      title,
      message,
      type,
      channel,
      status: 'queued',
      academicDetails,
      voiceMessage: {
        en: voiceMessages.en,
        ta: voiceMessages.ta,
      },
      deliveryStatus: { emailSent: false, smsSent: false },
    });

    if ((channel === 'email' || channel === 'all') && recipient.email) {
      const emailRes = await emailService.sendEmail({
        to: recipient.email,
        subject: title,
        text: message,
      });
      notif.deliveryStatus.emailSent = emailRes.success;
      notif.emailDetails = {
        to: recipient.email,
        status: emailRes.success ? 'delivered' : 'failed',
        messageId: emailRes.messageId || '',
        sentAt: new Date(),
        deliveredAt: emailRes.success ? new Date() : null,
        error: emailRes.error || '',
        attempts: 1,
      };
    }

    if ((channel === 'sms' || channel === 'all') && recipient.phone) {
      const smsRes = await smsService.sendSMS({
        to: recipient.phone,
        message: `${title}: ${message}`,
      });
      notif.deliveryStatus.smsSent = smsRes.success;
      notif.smsDetails = {
        to: recipient.phone,
        status: smsRes.success ? 'delivered' : 'failed',
        provider: smsService.provider,
        messageId: smsRes.messageId || '',
        sentAt: new Date(),
        deliveredAt: smsRes.success ? new Date() : null,
        error: smsRes.error || '',
        attempts: 1,
      };
    }

    notif.status =
      notif.deliveryStatus.emailSent || notif.deliveryStatus.smsSent ? 'delivered' : 'failed';

    await notif.save();

    res.status(201).json({
      success: true,
      message: 'Notification dispatched successfully.',
      notification: notif,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Dispatch test notification to a student's parent
// @route   POST /api/notifications/test-parent/:studentId
// @access  Private (Faculty, Admin)
export const testParentNotification = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { channel = null, language = null, phone, mobileNumber } = req.body;

    const student = await Student.findById(studentId).populate('user', 'name');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    let phoneOverride = (phone || mobileNumber || '').trim();
    if (phoneOverride) {
      const phoneRegex = /^\+[1-9][0-9\s-]{6,16}$/;
      const digitsOnly = phoneOverride.replace(/\D/g, '');
      if (!phoneRegex.test(phoneOverride) || digitsOnly.length < 7 || digitsOnly.length > 15) {
        return res.status(400).json({
          success: false,
          message: `Invalid parent mobile number format: "${phoneOverride}". Must include country code (e.g. +91 86100 85477).`,
        });
      }
    }

    const studentName = student.user?.name || student.rollNumber;
    const targetChannel = channel || student.parentContact?.preferredMethod || 'Automatic';
    const targetLang = language || student.parentContact?.preferredLanguage || 'en';
    const targetPhone = phoneOverride || student.parentContact?.phone;

    if ((targetChannel === 'SMS' || targetChannel === 'Voice Call') && !targetPhone) {
      return res.status(400).json({
        success: false,
        message: 'A registered parent mobile number with country code is required to test SMS notifications. Please specify a phone number.',
      });
    }

    const dispatchResult = await notificationService.dispatchDirectParentNotification({
      studentId: student._id,
      eventType: 'test_notification',
      title: `Test Notification: SAEPCS Parent Link for ${studentName}`,
      message: `This is a test notification from the Faculty Portal verifying your direct communication channel (${targetChannel}) in ${targetLang === 'ta' ? 'Tamil' : 'English'}. No further action is required.`,
      metricValue: 'Test Verification Active',
      details: 'Direct parent communication diagnostic verification test.',
      recommendedAction: 'Verification successful. No action needed.',
      channelOverride: channel,
      languageOverride: language,
      phoneOverride: targetPhone,
      facultyId: req.user._id,
      force: true, // Test notifications should bypass 24h suppression
    });

    if (dispatchResult.status === 'skipped') {
      return res.status(400).json({
        success: false,
        message: 'Notification was NOT sent: Parent consent status is set to "Opted Out". Please edit parent contact and change Consent Status to "Consented" to receive notifications.',
        details: dispatchResult,
      });
    }

    if (!dispatchResult.success) {
      return res.status(500).json({
        success: false,
        message: dispatchResult.error || 'Test notification delivery failed.',
        details: dispatchResult,
      });
    }

    const smsInfo = smsService.getProviderInfo();
    const smsChannelResult = dispatchResult.channels?.sms;
    const isMock = Boolean(dispatchResult.simulated || smsChannelResult?.simulated || smsInfo.isMock);

    const modeText = isMock
      ? `Simulation Mode (Provider: ${smsInfo.provider}) - No cellular transmission was made.`
      : `Live Telecom Provider (${smsChannelResult?.provider || smsInfo.provider}) - Accepted by carrier gateway.`;

    res.status(200).json({
      success: true,
      simulated: isMock,
      provider: smsChannelResult?.provider || smsInfo.provider,
      message: `Test notification processed via ${targetChannel} (${modeText})`,
      diagnostics: {
        activeProvider: smsChannelResult?.provider || smsInfo.provider,
        configuredProvider: smsInfo.configuredProvider,
        isMock,
        isApiKeyConfigured: smsInfo.hasApiKey,
        status: smsChannelResult?.status || dispatchResult.status || 'sent',
        messageId: smsChannelResult?.messageId || '',
        recipient: targetPhone || 'N/A',
      },
      result: dispatchResult,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Safe configuration diagnostics for parent communication gateways
// @route   GET /api/notifications/config-diagnostics
// @access  Private (Faculty, Admin)
export const getNotificationDiagnostics = async (req, res, next) => {
  try {
    const smsInfo = smsService.getProviderInfo();

    const twilioSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
    const twilioToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
    const twilioPhone = (process.env.TWILIO_PHONE_NUMBER || '').trim();
    const voiceEnabled = process.env.TWILIO_VOICE_CALL_ENABLED === 'true';
    const hasTwilioVoice = Boolean(
      voiceEnabled &&
      twilioSid &&
      twilioToken &&
      twilioPhone &&
      !twilioSid.includes('mock') &&
      !twilioSid.includes('dummy')
    );

    const smtpHost = (process.env.SMTP_HOST || '').trim();
    const isEthereal = smtpHost.includes('ethereal');

    res.status(200).json({
      success: true,
      diagnostics: {
        sms: {
          activeProvider: smsInfo.provider,
          configuredProvider: smsInfo.configuredProvider,
          isMock: smsInfo.isMock,
          isApiKeyConfigured: smsInfo.hasApiKey,
          statusDescription: smsInfo.statusDescription,
          fallbackReason: smsInfo.fallbackReason || null,
        },
        voice: {
          provider: hasTwilioVoice ? 'twilio_voice' : 'browser_speech_synthesis',
          outboundCallingEnabled: hasTwilioVoice,
          isCredentialsConfigured: Boolean(twilioSid && !twilioSid.includes('mock')),
          statusDescription: hasTwilioVoice
            ? 'Twilio Voice outbound calls active.'
            : 'Outbound voice calling in test simulation mode. In-browser Web Speech API available for spoken alerts.',
        },
        email: {
          service: isEthereal ? 'Ethereal (Dev Simulation)' : 'Configured SMTP',
          isConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER),
          sender: process.env.EMAIL_FROM || 'alerts@academic-monitoring.edu',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Faculty direct message to parent
// @route   POST /api/notifications/faculty-message
// @access  Private (Faculty, Admin)
export const sendFacultyParentMessage = async (req, res, next) => {
  try {
    const { studentId, subject, message, channel = 'Automatic', urgency = 'Normal', language } = req.body;

    if (!studentId || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Student ID, subject, and message are required fields.',
      });
    }

    const student = await Student.findById(studentId).populate('user', 'name');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const studentName = student.user?.name || student.rollNumber;
    const result = await notificationService.dispatchDirectParentNotification({
      studentId,
      eventType: 'faculty_message',
      title: `Faculty Notice for ${studentName}: ${subject}`,
      message: `${message} (Urgency: ${urgency})`,
      details: subject,
      metricValue: urgency,
      recommendedAction: 'Please contact the department mentor if you have questions.',
      channelOverride: channel === 'Automatic' ? null : channel,
      languageOverride: language || null,
      facultyId: req.user._id,
      force: true,
    });

    res.status(200).json({
      success: true,
      message: `Direct message dispatched to parent of ${studentName}.`,
      result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Schedule parent-faculty meeting
// @route   POST /api/notifications/schedule-meeting
// @access  Private (Faculty, Admin)
export const scheduleParentMeeting = async (req, res, next) => {
  try {
    const {
      studentId,
      meetingDate,
      meetingTime = '10:00 AM',
      meetingType = 'In-Person',
      agenda = 'Academic progress review and attendance discussion',
      location = 'Department Faculty Room 204',
      channel = 'Automatic',
    } = req.body;

    if (!studentId || !meetingDate) {
      return res.status(400).json({
        success: false,
        message: 'Student ID and meeting date are required.',
      });
    }

    const student = await Student.findById(studentId).populate('user', 'name');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const formattedDate = new Date(meetingDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const meetingDetails = `Date: ${formattedDate} at ${meetingTime} | Mode: ${meetingType} (${location}) | Agenda: ${agenda}`;
    const studentName = student.user?.name || student.rollNumber;

    const result = await notificationService.dispatchDirectParentNotification({
      studentId,
      eventType: 'meeting_scheduled',
      title: `Parent-Faculty Conference Scheduled for ${studentName}`,
      message: `Dear Parent, a meeting has been scheduled regarding ${studentName}'s academic standing on ${formattedDate} at ${meetingTime}. Location: ${location}. Agenda: ${agenda}.`,
      details: meetingDetails,
      metricValue: `${formattedDate} ${meetingTime}`,
      recommendedAction: `Please attend the meeting on ${formattedDate} at ${meetingTime} or call faculty to reschedule.`,
      channelOverride: channel === 'Automatic' ? null : channel,
      facultyId: req.user._id,
      force: true,
    });

    res.status(200).json({
      success: true,
      message: `Meeting notification dispatched to ${studentName}'s parent.`,
      meeting: {
        studentId,
        studentName,
        meetingDate,
        meetingTime,
        meetingType,
        location,
        agenda,
      },
      result,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Broadcast academic announcement to multiple parents
// @route   POST /api/notifications/announcement
// @access  Private (Faculty, Admin)
export const sendAcademicAnnouncement = async (req, res, next) => {
  try {
    const { title, message, studentIds, channel = 'Automatic' } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Announcement title and message are required.',
      });
    }

    let targetStudents = [];
    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      targetStudents = await Student.find({ _id: { $in: studentIds } }).populate('user', 'name');
    } else {
      targetStudents = await Student.find({}).limit(50).populate('user', 'name');
    }

    const dispatchSummaries = [];
    for (const student of targetStudents) {
      const studentName = student.user?.name || student.rollNumber;
      const resItem = await notificationService.dispatchDirectParentNotification({
        studentId: student._id,
        eventType: 'announcement',
        title: `Academic Announcement: ${title}`,
        message: `${message} (Notice for ${studentName})`,
        details: title,
        channelOverride: channel === 'Automatic' ? null : channel,
        facultyId: req.user._id,
        force: true,
      });
      dispatchSummaries.push({ studentId: student._id, studentName, status: resItem.status });
    }

    res.status(200).json({
      success: true,
      message: `Announcement broadcast to ${dispatchSummaries.length} student parent contacts.`,
      dispatchedCount: dispatchSummaries.length,
      summaries: dispatchSummaries,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get notification history and status for Faculty Portal
// @route   GET /api/notifications/faculty-history
// @access  Private (Faculty, Admin)
export const getFacultyNotificationHistory = async (req, res, next) => {
  try {
    const { studentId, channel, status, type, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (studentId) {
      filter.student = studentId;
    }
    if (channel && channel !== 'All') {
      filter.channel = channel.toLowerCase();
    }
    if (status && status !== 'All') {
      filter.status = status.toLowerCase();
    }
    if (type && type !== 'All') {
      filter.type = type;
    }

    if (search && search.trim()) {
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { message: { $regex: search.trim(), $options: 'i' } },
        { 'academicDetails.studentName': { $regex: search.trim(), $options: 'i' } },
        { 'academicDetails.rollNumber': { $regex: search.trim(), $options: 'i' } },
        { 'parentContactInfo.name': { $regex: search.trim(), $options: 'i' } },
        { 'parentContactInfo.phone': { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [logs, total, totalDelivered, totalSimulated, totalFailed, totalQueued, totalSkipped] =
      await Promise.all([
        Notification.find(filter)
          .populate('recipient', 'name email phone role')
          .populate('sender', 'name role')
          .populate('student', 'rollNumber user parentContact')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit, 10)),
        Notification.countDocuments(filter),
        Notification.countDocuments({ ...filter, status: 'delivered' }),
        Notification.countDocuments({ ...filter, status: 'simulated' }),
        Notification.countDocuments({ ...filter, status: 'failed' }),
        Notification.countDocuments({ ...filter, status: 'queued' }),
        Notification.countDocuments({ ...filter, status: 'skipped' }),
      ]);

    const byChannel = {
      sms: await Notification.countDocuments({ ...filter, 'deliveryStatus.smsSent': true }),
      email: await Notification.countDocuments({ ...filter, 'deliveryStatus.emailSent': true }),
      voice: await Notification.countDocuments({
        ...filter,
        $or: [{ 'deliveryStatus.voiceCallPlaced': true }, { 'voiceDetails.status': 'ready' }],
      }),
    };

    res.status(200).json({
      success: true,
      summary: {
        total,
        delivered: totalDelivered,
        simulated: totalSimulated,
        failed: totalFailed,
        queued: totalQueued,
        skipped: totalSkipped,
        byChannel,
      },
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)),
      logs,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Generate dynamic TwiML for incoming/outbound Twilio Voice calls
// @route   GET /api/notifications/voice/twiml
// @access  Public / Twilio Webhook
export const getVoiceTwiML = (req, res) => {
  const { message = 'Hello from SAEPCS Academic Alert System.', language = 'en' } = req.query;
  const twiml = voiceService.generateTwiML({ message, language });
  res.type('text/xml');
  res.send(twiml);
};

// @desc    Status callback webhook for Twilio Voice calls
// @route   POST /api/notifications/voice/status
// @access  Public / Twilio Webhook
export const handleVoiceStatusWebhook = async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration } = req.body;
    console.log(`[Twilio Voice Status Webhook] CallSid: ${CallSid}, Status: ${CallStatus}, Duration: ${CallDuration}s`);

    if (CallSid) {
      const update = {
        'voiceDetails.duration': CallDuration ? Number(CallDuration) : 0,
      };

      if (['completed', 'answered'].includes(CallStatus)) {
        update['voiceDetails.status'] = 'delivered';
        update['deliveryStatus.voicePlayed'] = true;
      } else if (['busy', 'no-answer', 'failed', 'canceled'].includes(CallStatus)) {
        update['voiceDetails.status'] = 'failed';
        update['voiceDetails.error'] = `Call ended with status: ${CallStatus}`;
      } else {
        update['voiceDetails.status'] = 'in-progress';
      }

      await Notification.findOneAndUpdate({ 'voiceDetails.callSid': CallSid }, update);
    }

    res.status(200).send('<Response/>');
  } catch (error) {
    console.error('[Twilio Status Webhook Error]:', error.message);
    res.status(200).send('<Response/>');
  }
};
