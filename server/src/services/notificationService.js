import Student from '../models/Student.js';
import Parent from '../models/Parent.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import emailService from './emailService.js';
import smsService from './smsService.js';
import voiceService from './voiceService.js';

class NotificationService {
  /**
   * Maps an internal riskType string to the Notification model type enum
   */
  mapRiskTypeToNotificationType(riskType) {
    switch (riskType) {
      case 'Attendance':
        return 'attendance_alert';
      case 'Assessment Marks':
        return 'low_marks_warning';
      case 'Missing Assignments':
        return 'assignment_overdue';
      case 'Excessive Leave':
        return 'excessive_leave';
      case 'Composite':
      default:
        return 'academic_risk';
    }
  }

  /**
   * Resolves effective parent contact information for a student.
   * Parents do not need to register or log in; contact details can come directly from student.parentContact.
   */
  async resolveParentContact(student) {
    let name = student.parentContact?.name || '';
    let relationship = student.parentContact?.relationship || 'Parent / Guardian';
    let phone = student.parentContact?.phone || '';
    let email = student.parentContact?.email || '';
    let preferredLanguage = student.parentContact?.preferredLanguage || 'en';
    let preferredMethod = student.parentContact?.preferredMethod || 'Automatic';
    let consentStatus = student.parentContact?.consentStatus || 'Consented';
    let linkedParentUser = null;

    // Check linked Parent model if contact info not complete or to find linked user
    if (student.parents && student.parents.length > 0) {
      const parentDoc = await Parent.findById(student.parents[0]).populate('user');
      if (parentDoc) {
        if (!name && parentDoc.user?.name) name = parentDoc.user.name;
        if (!phone) phone = parentDoc.user?.phone || parentDoc.alternatePhone || '';
        if (!email && parentDoc.user?.email && !parentDoc.user.email.includes('noemail')) {
          email = parentDoc.user.email;
        }
        if (student.parentContact?.preferredLanguage === undefined && parentDoc.notificationLanguagePreference) {
          preferredLanguage = parentDoc.notificationLanguagePreference;
        }
        if (student.parentContact?.preferredMethod === undefined && parentDoc.preferredNotificationMethod) {
          preferredMethod = parentDoc.preferredNotificationMethod;
        }
        if (student.parentContact?.consentStatus === undefined && parentDoc.consentStatus) {
          consentStatus = parentDoc.consentStatus;
        }
        if (parentDoc.user) linkedParentUser = parentDoc.user;
      }
    }

    return {
      name: name || 'Parent / Guardian',
      relationship,
      phone,
      email,
      preferredLanguage,
      preferredMethod,
      consentStatus,
      linkedParentUser,
    };
  }

  /**
   * Core routing engine: Dispatches direct notification to parent across preferred channel(s).
   * Supports Automatic routing based on event importance, SMS, Email, and Programmable Voice Calls.
   */
  async dispatchDirectParentNotification({
    studentId,
    eventType = 'attendance_alert',
    title,
    message,
    metricValue = '',
    details = '',
    recommendedAction = 'Please contact the department faculty for guidance.',
    channelOverride = null,
    languageOverride = null,
    phoneOverride = null,
    facultyId = null,
    force = false,
  }) {
    try {
      const student = await Student.findById(studentId)
        .populate('user')
        .populate({
          path: 'parents',
          populate: { path: 'user' },
        });

      if (!student || !student.user) {
        return { success: false, error: 'Student record not found' };
      }

      const studentName = student.user.name;
      const rollNumber = student.rollNumber;
      const parentInfo = await this.resolveParentContact(student);

      if (phoneOverride && typeof phoneOverride === 'string' && phoneOverride.trim()) {
        parentInfo.phone = phoneOverride.trim();
      }

      const targetLanguage = languageOverride || parentInfo.preferredLanguage || 'en';
      const targetMethod = channelOverride || parentInfo.preferredMethod || 'Automatic';

      const normalizedChannel = (targetMethod || 'automatic')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_');

      // 1. Consent Check - Respect Opt-Outs & Calling Restrictions
      if (parentInfo.consentStatus === 'Opted Out') {
        console.warn(`[Parent Communication Notice] Parent of ${studentName} opted out. Notification withheld.`);
        const skippedNotif = await Notification.create({
          recipient: parentInfo.linkedParentUser?._id || student.user._id,
          student: student._id,
          sender: facultyId || null,
          title: title || `Academic Notice: ${studentName}`,
          message: message || `Notice for ${studentName}`,
          type: eventType,
          channel: normalizedChannel,
          status: 'skipped',
          academicDetails: {
            studentName,
            rollNumber,
            issue: eventType,
            currentMetric: metricValue,
            recommendedAction,
            date: new Date(),
          },
          parentContactInfo: {
            name: parentInfo.name,
            phone: parentInfo.phone,
            email: parentInfo.email,
            preferredLanguage: targetLanguage,
            preferredMethod: targetMethod,
            consentStatus: 'Opted Out',
          },
          deliveryStatus: {
            error: 'Parent opted out of communications. Delivery skipped per consent policy.',
          },
        });

        return {
          success: true,
          status: 'skipped',
          message: 'Notification skipped: Parent has opted out of automated communications.',
          notification: skippedNotif,
        };
      }

      // 2. Duplicate Suppression: Check if same notification was sent within 24 hours
      const since24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (!force) {
        const existingNotif = await Notification.findOne({
          student: student._id,
          type: eventType,
          createdAt: { $gte: since24Hours },
          status: { $in: ['delivered', 'sent', 'simulated'] },
        });

        if (existingNotif) {
          console.log(`[NotificationService] Duplicate suppressed within 24h for ${studentName} (${eventType})`);
          return {
            success: true,
            suppressedDuplicate: true,
            status: 'suppressed',
            message: 'Duplicate notice suppressed within 24-hour window.',
            notification: existingNotif,
          };
        }
      }

      // 3. Resolve Channels Based on Routing Rules & Parent Preferences
      let shouldSendSMS = false;
      let shouldSendEmail = false;
      let shouldPlaceVoiceCall = false;

      if (eventType === 'test_notification') {
        // Diagnostic test: Respect selected test method, testing SMS explicitly when requested or Automatic
        if (targetMethod === 'SMS') {
          shouldSendSMS = true;
        } else if (targetMethod === 'Voice Call') {
          shouldPlaceVoiceCall = true;
        } else if (targetMethod === 'Email') {
          shouldSendEmail = true;
        } else {
          // 'Automatic' test mode: test SMS if phone exists, test Email if email exists
          if (parentInfo.phone) shouldSendSMS = true;
          if (parentInfo.email) shouldSendEmail = true;
        }
      } else if (targetMethod === 'SMS') {
        shouldSendSMS = true;
      } else if (targetMethod === 'Email') {
        if (parentInfo.email) {
          shouldSendEmail = true;
        } else {
          // Fallback rule: When email is unavailable, fallback to SMS
          shouldSendSMS = true;
        }
      } else if (targetMethod === 'Voice Call') {
        shouldPlaceVoiceCall = true;
      } else {
        // 'Automatic' - Intelligently routes based on event severity and accessibility needs:
        switch (eventType) {
          case 'attendance_alert':
          case 'frequent_absent':
          case 'absence_alert':
            // High urgency attendance issues: SMS + Voice Call for immediate reach
            shouldSendSMS = true;
            shouldPlaceVoiceCall = true;
            if (parentInfo.email) shouldSendEmail = true;
            break;

          case 'academic_risk':
            // Critical academic risk alert
            shouldSendSMS = true;
            shouldPlaceVoiceCall = true;
            if (parentInfo.email) shouldSendEmail = true;
            break;

          case 'low_marks_warning':
            shouldSendSMS = true;
            if (parentInfo.email) shouldSendEmail = true;
            break;

          case 'meeting_scheduled':
            shouldSendSMS = true;
            shouldPlaceVoiceCall = true;
            if (parentInfo.email) shouldSendEmail = true;
            break;

          case 'announcement':
          case 'faculty_message':
          default:
            if (parentInfo.email) {
              shouldSendEmail = true;
            } else {
              shouldSendSMS = true;
            }
            break;
        }
      }

      // Format default titles and messages if not provided
      const notifTitle =
        title ||
        (targetLanguage === 'ta'
          ? `கல்லூரி அறிவிப்பு: ${studentName}`
          : `College Notification for ${studentName}`);

      const notifMsg =
        message ||
        (targetLanguage === 'ta'
          ? `மாணவர் ${studentName} (பதிவு எண்: ${rollNumber}) தொடர்பான கல்வி தகவல்: ${details || metricValue}.`
          : `Academic notice regarding student ${studentName} (Roll: ${rollNumber}): ${details || metricValue}.`);

      // 4. Generate Voice Messages (English, Tamil, and Hindi)
      const voiceMessages = voiceService.generateVoiceMessages({
        studentName,
        issueType: eventType,
        metricValue,
        details,
      });

      // 5. Dispatch SMS
      let smsResult = { success: false, status: 'none', attempts: 0 };
      if (shouldSendSMS && parentInfo.phone) {
        const smsText = smsService.formatDirectParentAlert({
          studentName,
          eventType,
          details: details || notifMsg,
          metric: metricValue,
          language: targetLanguage,
        });

        smsResult = await smsService.sendSMS({
          to: parentInfo.phone,
          message: smsText,
        });
      }

      // 6. Dispatch Email
      let emailResult = { success: false, status: 'none', attempts: 0 };
      if (shouldSendEmail && parentInfo.email) {
        emailResult = await emailService.sendAcademicWarningEmail({
          to: parentInfo.email,
          studentName,
          rollNumber,
          issue: details || eventType,
          currentMetric: metricValue || notifMsg,
          recommendedAction,
          language: targetLanguage,
          isParent: true,
        });
      }

      // 7. Dispatch Voice Call (For non-readers and accessibility)
      let voiceResult = {
        mode: shouldPlaceVoiceCall ? 'automated_call' : 'browser_tts',
        status: shouldPlaceVoiceCall ? 'queued' : 'ready',
        transcript: targetLanguage === 'ta' ? voiceMessages.ta : voiceMessages.en,
        language: targetLanguage,
        simulated: false,
        attempts: 0,
      };

      if (shouldPlaceVoiceCall && parentInfo.phone) {
        voiceResult = await voiceService.placeOutboundCall({
          toPhone: parentInfo.phone,
          studentName,
          issueType: eventType,
          metricValue,
          details,
          languagePreference: targetLanguage,
          consentVerified: parentInfo.consentStatus === 'Consented',
        });
      }

      // Determine Overall Status
      const resultsArray = [];
      if (shouldSendSMS) resultsArray.push(smsResult);
      if (shouldSendEmail) resultsArray.push(emailResult);
      if (shouldPlaceVoiceCall) resultsArray.push(voiceResult);

      const anyDelivered = resultsArray.some((r) => r.status === 'delivered');
      const anySent = resultsArray.some((r) => r.status === 'sent' || r.status === 'accepted');
      const anySimulated = resultsArray.some((r) => r.simulated || r.status === 'simulated');
      const allFailed = resultsArray.length > 0 && resultsArray.every((r) => r.status === 'failed');

      let overallStatus = 'sent';
      if (allFailed) {
        overallStatus = 'failed';
      } else if (anyDelivered) {
        overallStatus = 'delivered';
      } else if (anySent) {
        overallStatus = 'sent';
      } else if (anySimulated) {
        overallStatus = 'simulated';
      }

      const notifDoc = await Notification.create({
        recipient: parentInfo.linkedParentUser?._id || student.user._id,
        student: student._id,
        sender: facultyId || null,
        title: notifTitle,
        message: notifMsg,
        type: eventType,
        channel: normalizedChannel,
        status: overallStatus,
        academicDetails: {
          studentName,
          rollNumber,
          issue: details || eventType,
          currentMetric: metricValue,
          recommendedAction,
          date: new Date(),
        },
        voiceMessage: {
          en: voiceMessages.en,
          ta: voiceMessages.ta,
          hi: voiceMessages.hi,
        },
        parentContactInfo: {
          name: parentInfo.name,
          phone: parentInfo.phone,
          email: parentInfo.email,
          preferredLanguage: targetLanguage,
          preferredMethod: targetMethod,
          consentStatus: parentInfo.consentStatus,
        },
        deliveryStatus: {
          emailSent: emailResult.success || false,
          smsSent: smsResult.success || false,
          voiceCallPlaced: voiceResult.success || false,
          voicePlayed: false,
          simulated: anySimulated,
          error: [emailResult.error, smsResult.error, voiceResult.error].filter(Boolean).join('; '),
        },
        emailDetails: {
          to: parentInfo.email || '',
          status: emailResult.status || 'none',
          messageId: emailResult.messageId || '',
          sentAt: emailResult.sentAt || new Date(),
          deliveredAt: emailResult.deliveredAt || (emailResult.success ? new Date() : null),
          error: emailResult.error || '',
          attempts: emailResult.attempts || 0,
          simulated: Boolean(emailResult.simulated),
        },
        smsDetails: {
          to: parentInfo.phone || '',
          status: smsResult.status || 'none',
          provider: smsResult.provider || smsService.provider,
          messageId: smsResult.messageId || '',
          sentAt: smsResult.sentAt || new Date(),
          deliveredAt: smsResult.deliveredAt || (smsResult.success ? new Date() : null),
          error: smsResult.error || '',
          attempts: smsResult.attempts || 0,
          simulated: Boolean(smsResult.simulated),
        },
        voiceDetails: {
          to: parentInfo.phone || '',
          mode: shouldPlaceVoiceCall ? 'automated_call' : 'browser_tts',
          status: voiceResult.status || (shouldPlaceVoiceCall ? 'completed' : 'ready'),
          language: targetLanguage,
          transcript: voiceResult.transcript || voiceMessages.en,
          provider: voiceResult.provider || 'browser_speech_synthesis',
          callSid: voiceResult.callSid || '',
          consentVerified: parentInfo.consentStatus === 'Consented',
          attempts: voiceResult.attempts || (shouldPlaceVoiceCall ? 1 : 0),
          error: voiceResult.error || '',
          simulated: Boolean(voiceResult.simulated),
        },
      });

      // Update student's lastNotifiedAt timestamp
      await Student.findByIdAndUpdate(student._id, {
        'parentContact.lastNotifiedAt': new Date(),
      });

      return {
        success: !allFailed,
        status: overallStatus,
        simulated: anySimulated,
        channels: {
          sms: smsResult,
          email: emailResult,
          voice: voiceResult,
        },
        notification: notifDoc,
      };
    } catch (err) {
      console.error('[NotificationService Error] Direct parent dispatch failed:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Dispatches academic warning across Email, SMS, Voice-friendly TTS, and Portal.
   * Fully backwards-compatible with existing riskAnalysisService and tests.
   */
  async dispatchAcademicWarning({
    studentId,
    riskType,
    severity = 'High',
    previousSeverity = null,
    reason = '',
    currentMetric = '',
    recommendedAction = 'Please contact faculty advisor for guidance.',
    force = false,
  }) {
    try {
      const student = await Student.findById(studentId)
        .populate('user')
        .populate({
          path: 'parents',
          populate: { path: 'user' },
        });

      if (!student || !student.user) {
        return { success: false, error: 'Student or linked user not found' };
      }

      const notifType = this.mapRiskTypeToNotificationType(riskType);
      const studentName = student.user.name;
      const rollNumber = student.rollNumber;
      const noticeDate = new Date();
      const since24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const voiceMessages = voiceService.generateVoiceMessages({
        studentName,
        issueType: notifType,
        metricValue: currentMetric,
      });

      const results = {
        studentNotified: false,
        parentNotified: false,
        suppressedDuplicate: false,
        notifications: [],
      };

      // Part A: Student Notification
      const existingStudentNotif = await Notification.findOne({
        recipient: student.user._id,
        type: notifType,
        createdAt: { $gte: since24Hours },
      });

      if (!existingStudentNotif || force || previousSeverity !== null) {
        const studentTitle = `Academic Warning: ${riskType} (${severity} Priority)`;
        const studentMsg = `${reason}. Current status: ${currentMetric}. Action required: ${recommendedAction}`;

        let emailStatus = 'none';
        let emailMsgId = '';
        let emailErr = '';

        if (student.user.email) {
          const emailRes = await emailService.sendAcademicWarningEmail({
            to: student.user.email,
            studentName,
            rollNumber,
            issue: `${riskType} Advisory (${severity} Severity)`,
            currentMetric: currentMetric || reason,
            recommendedAction,
            date: noticeDate,
            isParent: false,
          });
          emailStatus = emailRes.success ? 'delivered' : 'failed';
          emailMsgId = emailRes.messageId || '';
          emailErr = emailRes.error || '';
        }

        const studentNotifDoc = await Notification.create({
          recipient: student.user._id,
          student: student._id,
          title: studentTitle,
          message: studentMsg,
          type: notifType,
          channel: 'all',
          status: emailStatus === 'failed' ? 'failed' : 'delivered',
          academicDetails: {
            studentName,
            rollNumber,
            issue: riskType,
            currentMetric: currentMetric || reason,
            recommendedAction,
            date: noticeDate,
          },
          voiceMessage: {
            en: voiceMessages.en,
            ta: voiceMessages.ta,
          },
          deliveryStatus: {
            emailSent: emailStatus === 'delivered',
            smsSent: false,
            voicePlayed: false,
            error: emailErr,
          },
          emailDetails: {
            to: student.user.email || '',
            status: emailStatus,
            messageId: emailMsgId,
            sentAt: noticeDate,
            deliveredAt: emailStatus === 'delivered' ? noticeDate : null,
            error: emailErr,
            attempts: 1,
          },
          voiceDetails: {
            mode: 'browser_tts',
            status: 'ready',
            language: student.user.notificationLanguagePreference || 'en',
            transcript:
              student.user.notificationLanguagePreference === 'ta'
                ? voiceMessages.ta_transliterated
                : voiceMessages.en,
            provider: 'browser_speech_synthesis',
          },
        });

        results.studentNotified = true;
        results.notifications.push(studentNotifDoc);
      } else {
        results.suppressedDuplicate = true;
      }

      // Part B: Parent Notification
      const parentInfo = await this.resolveParentContact(student);
      const parentUser = parentInfo.linkedParentUser;

      if (parentUser || parentInfo.phone || parentInfo.email) {
        const existingParentNotif = await Notification.findOne({
          student: student._id,
          recipient: parentUser ? parentUser._id : student.user._id,
          type: notifType,
          createdAt: { $gte: since24Hours },
        });

        if (existingParentNotif && !force && previousSeverity === null) {
          results.suppressedDuplicate = true;
        } else {
          const langPref = parentInfo.preferredLanguage || 'en';
          const parentTitle = `Academic Advisory for ${studentName}: ${riskType}`;
          const parentMsg = `Notice for ${studentName} (Roll: ${rollNumber}): ${reason}. Record: ${currentMetric}. Recommended Action: ${recommendedAction}`;

          let emailStatus = 'none';
          let emailMsgId = '';
          let emailErr = '';

          const parentEmail = parentInfo.email || parentUser?.email;
          if (parentEmail) {
            const emailRes = await emailService.sendAcademicWarningEmail({
              to: parentEmail,
              studentName,
              rollNumber,
              issue: `${riskType} Shortage / Risk (${severity})`,
              currentMetric: currentMetric || reason,
              recommendedAction,
              date: noticeDate,
              isParent: true,
              language: langPref,
            });
            emailStatus = emailRes.success ? 'delivered' : 'failed';
            emailMsgId = emailRes.messageId || '';
            emailErr = emailRes.error || '';
          }

          let smsStatus = 'none';
          let smsMsgId = '';
          let smsErr = '';
          const parentPhone = parentInfo.phone || parentUser?.phone;

          if (parentPhone) {
            const smsText = smsService.formatAcademicWarningSMS({
              studentName,
              issue: riskType,
              currentMetric: currentMetric || reason,
              recommendedAction,
              language: langPref,
            });

            const smsRes = await smsService.sendSMS({
              to: parentPhone,
              message: smsText,
            });

            smsStatus = smsRes.success ? 'delivered' : 'failed';
            smsMsgId = smsRes.messageId || '';
            smsErr = smsRes.error || '';
          }

          const voiceDetails = await voiceService.prepareVoiceNotification({
            toPhone: parentPhone,
            studentName,
            issueType: notifType,
            metricValue: currentMetric,
            languagePreference: langPref,
            consentVerified: false,
          });

          const overallStatus =
            emailStatus === 'failed' && smsStatus === 'failed' ? 'failed' : 'delivered';

          const parentNotifDoc = await Notification.create({
            recipient: parentUser ? parentUser._id : student.user._id,
            student: student._id,
            title: parentTitle,
            message: parentMsg,
            type: notifType,
            channel: 'all',
            status: overallStatus,
            academicDetails: {
              studentName,
              rollNumber,
              issue: riskType,
              currentMetric: currentMetric || reason,
              recommendedAction,
              date: noticeDate,
            },
            voiceMessage: {
              en: voiceMessages.en,
              ta: voiceMessages.ta,
            },
            deliveryStatus: {
              emailSent: emailStatus === 'delivered',
              smsSent: smsStatus === 'delivered',
              voicePlayed: false,
              error: [emailErr, smsErr].filter(Boolean).join('; '),
            },
            emailDetails: {
              to: parentEmail || '',
              status: emailStatus,
              messageId: emailMsgId,
              sentAt: noticeDate,
              deliveredAt: emailStatus === 'delivered' ? noticeDate : null,
              error: emailErr,
              attempts: parentEmail ? 1 : 0,
            },
            smsDetails: {
              to: parentPhone || '',
              status: smsStatus,
              provider: smsService.provider,
              messageId: smsMsgId,
              sentAt: noticeDate,
              deliveredAt: smsStatus === 'delivered' ? noticeDate : null,
              error: smsErr,
              attempts: parentPhone ? 1 : 0,
            },
            voiceDetails,
          });

          results.parentNotified = true;
          results.notifications.push(parentNotifDoc);
        }
      }

      return {
        success: true,
        ...results,
      };
    } catch (err) {
      console.error('[NotificationService Error] Failed to dispatch academic warning:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Retries temporary failed delivery (email, SMS, or Voice) for an existing notification record.
   */
  async retryFailedNotification(notificationId) {
    const notif = await Notification.findById(notificationId).populate('student');
    if (!notif) throw new Error('Notification not found');

    notif.retryInfo.attempts += 1;
    notif.retryInfo.lastAttemptAt = new Date();

    let emailRecovered = false;
    let smsRecovered = false;
    let voiceRecovered = false;

    // 1. Retry Email
    if (notif.emailDetails && notif.emailDetails.status === 'failed' && notif.emailDetails.to) {
      const emailRes = await emailService.sendAcademicWarningEmail({
        to: notif.emailDetails.to,
        studentName: notif.academicDetails?.studentName || 'Student',
        rollNumber: notif.academicDetails?.rollNumber || '',
        issue: notif.academicDetails?.issue || notif.title,
        currentMetric: notif.academicDetails?.currentMetric || '',
        recommendedAction: notif.academicDetails?.recommendedAction || '',
      });

      notif.emailDetails.attempts += 1;
      if (emailRes.success) {
        notif.emailDetails.status = 'delivered';
        notif.emailDetails.messageId = emailRes.messageId || notif.emailDetails.messageId;
        notif.emailDetails.deliveredAt = new Date();
        notif.deliveryStatus.emailSent = true;
        emailRecovered = true;
      } else {
        notif.emailDetails.error = emailRes.error;
      }
    }

    // 2. Retry SMS
    if (notif.smsDetails && notif.smsDetails.status === 'failed' && notif.smsDetails.to) {
      const smsRes = await smsService.sendSMS({
        to: notif.smsDetails.to,
        message: smsService.formatAcademicWarningSMS({
          studentName: notif.academicDetails?.studentName || 'Student',
          issue: notif.academicDetails?.issue || notif.title,
          currentMetric: notif.academicDetails?.currentMetric || '',
          recommendedAction: notif.academicDetails?.recommendedAction || '',
        }),
      });

      notif.smsDetails.attempts += 1;
      if (smsRes.success) {
        notif.smsDetails.status = 'delivered';
        notif.smsDetails.messageId = smsRes.messageId || notif.smsDetails.messageId;
        notif.smsDetails.deliveredAt = new Date();
        notif.deliveryStatus.smsSent = true;
        smsRecovered = true;
      } else {
        notif.smsDetails.error = smsRes.error;
      }
    }

    // 3. Retry Voice Call if failed
    if (notif.voiceDetails && notif.voiceDetails.status === 'failed' && notif.voiceDetails.to) {
      const voiceRes = await voiceService.placeOutboundCall({
        toPhone: notif.voiceDetails.to,
        studentName: notif.academicDetails?.studentName || 'Student',
        issueType: notif.type,
        metricValue: notif.academicDetails?.currentMetric || '',
        languagePreference: notif.voiceDetails.language || 'en',
        consentVerified: notif.voiceDetails.consentVerified,
      });

      notif.voiceDetails.attempts += 1;
      if (voiceRes.success) {
        notif.voiceDetails.status = voiceRes.simulated ? 'simulated' : 'delivered';
        notif.voiceDetails.callSid = voiceRes.callSid || notif.voiceDetails.callSid;
        notif.deliveryStatus.voiceCallPlaced = true;
        voiceRecovered = true;
      } else {
        notif.voiceDetails.error = voiceRes.error;
      }
    }

    const isDeliveredNow =
      (notif.emailDetails?.status === 'delivered' || notif.emailDetails?.status === 'none') &&
      (notif.smsDetails?.status === 'delivered' || notif.smsDetails?.status === 'none') &&
      (notif.voiceDetails?.status !== 'failed');

    if (isDeliveredNow) {
      notif.status = 'delivered';
      notif.retryInfo.error = '';
    }

    await notif.save();
    return notif;
  }
}

export default new NotificationService();
