import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Recipient reference is required'],
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
    },
    type: {
      type: String,
      enum: [
        'attendance_alert',
        'frequent_absent',
        'low_marks_warning',
        'leave_status',
        'assignment_due',
        'assignment_overdue',
        'excessive_leave',
        'academic_risk',
        'announcement',
        'faculty_message',
        'meeting_scheduled',
        'test_notification',
        'general',
      ],
      default: 'general',
      index: true,
    },
    channel: {
      type: String,
      enum: ['system', 'email', 'sms', 'voice', 'voice_call', 'voice call', 'all', 'automatic'],
      default: 'system',
      index: true,
    },
    status: {
      type: String,
      enum: ['queued', 'accepted', 'sent', 'delivered', 'failed', 'simulated', 'skipped'],
      default: 'queued',
    },
    academicDetails: {
      studentName: { type: String, default: '' },
      rollNumber: { type: String, default: '' },
      issue: { type: String, default: '' },
      currentMetric: { type: String, default: '' },
      recommendedAction: { type: String, default: '' },
      date: { type: Date, default: Date.now },
    },
    voiceMessage: {
      en: { type: String, default: '' },
      ta: { type: String, default: '' },
      hi: { type: String, default: '' },
    },
    deliveryStatus: {
      emailSent: { type: Boolean, default: false },
      smsSent: { type: Boolean, default: false },
      voicePlayed: { type: Boolean, default: false },
      voiceCallPlaced: { type: Boolean, default: false },
      simulated: { type: Boolean, default: false },
      error: { type: String, default: '' },
    },
    parentContactInfo: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      email: { type: String, default: '' },
      preferredLanguage: { type: String, default: 'en' },
      preferredMethod: { type: String, default: 'Automatic' },
      consentStatus: { type: String, default: 'Consented' },
    },
    emailDetails: {
      to: { type: String, default: '' },
      status: {
        type: String,
        enum: ['none', 'queued', 'accepted', 'sent', 'delivered', 'failed', 'simulated', 'skipped'],
        default: 'none',
      },
      messageId: { type: String, default: '' },
      sentAt: { type: Date, default: null },
      deliveredAt: { type: Date, default: null },
      error: { type: String, default: '' },
      attempts: { type: Number, default: 0 },
      simulated: { type: Boolean, default: false },
    },
    smsDetails: {
      to: { type: String, default: '' },
      status: {
        type: String,
        enum: ['none', 'queued', 'accepted', 'sent', 'delivered', 'failed', 'simulated', 'skipped'],
        default: 'none',
      },
      provider: { type: String, default: 'mock' },
      messageId: { type: String, default: '' },
      sentAt: { type: Date, default: null },
      deliveredAt: { type: Date, default: null },
      error: { type: String, default: '' },
      attempts: { type: Number, default: 0 },
      simulated: { type: Boolean, default: false },
    },
    voiceDetails: {
      to: { type: String, default: '' },
      mode: {
        type: String,
        enum: ['browser_tts', 'automated_call', 'none'],
        default: 'browser_tts',
      },
      status: {
        type: String,
        enum: ['none', 'ready', 'queued', 'completed', 'delivered', 'simulated', 'failed', 'skipped'],
        default: 'ready',
      },
      language: { type: String, default: 'en' },
      transcript: { type: String, default: '' },
      provider: { type: String, default: 'browser_speech_synthesis' },
      callSid: { type: String, default: '' },
      consentVerified: { type: Boolean, default: false },
      duration: { type: Number, default: 0 },
      error: { type: String, default: '' },
      attempts: { type: Number, default: 0 },
      simulated: { type: Boolean, default: false },
    },
    retryInfo: {
      attempts: { type: Number, default: 0 },
      maxRetries: { type: Number, default: 3 },
      lastAttemptAt: { type: Date, default: null },
      error: { type: String, default: '' },
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ student: 1, createdAt: -1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ status: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
