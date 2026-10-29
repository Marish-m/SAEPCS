import express from 'express';
import {
  getMyNotifications,
  getParentNotificationHistory,
  getAdminNotificationLogs,
  retryNotification,
  updateNotificationPreferences,
  getVoiceConfig,
  markAsRead,
  markAllAsRead,
  sendCustomNotification,
  testParentNotification,
  sendFacultyParentMessage,
  scheduleParentMeeting,
  sendAcademicAnnouncement,
  getFacultyNotificationHistory,
  getVoiceTwiML,
  handleVoiceStatusWebhook,
  getNotificationDiagnostics,
} from '../controllers/notificationController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Public / Webhook routes (Twilio Voice)
router.get('/voice/twiml', getVoiceTwiML);
router.post('/voice/status', handleVoiceStatusWebhook);

// Protected routes below
router.use(authenticate);

// Public / Authenticated user routes
router.get('/', getMyNotifications);
router.get('/voice-config', getVoiceConfig);
router.put('/preferences', updateNotificationPreferences);
router.put('/read-all', markAllAsRead);
router.put('/:id/read', markAsRead);

// Faculty & Admin Parent Communication routes
router.get('/config-diagnostics', authorizeRoles('admin', 'faculty'), getNotificationDiagnostics);
router.post('/test-parent/:studentId', authorizeRoles('admin', 'faculty'), testParentNotification);
router.post('/faculty-message', authorizeRoles('admin', 'faculty'), sendFacultyParentMessage);
router.post('/schedule-meeting', authorizeRoles('admin', 'faculty'), scheduleParentMeeting);
router.post('/announcement', authorizeRoles('admin', 'faculty'), sendAcademicAnnouncement);
router.get('/faculty-history', authorizeRoles('admin', 'faculty'), getFacultyNotificationHistory);

// Role-specific routes
router.get('/parent', authorizeRoles('parent', 'admin', 'faculty'), getParentNotificationHistory);
router.get('/admin/logs', authorizeRoles('admin'), getAdminNotificationLogs);
router.post('/:id/retry', authorizeRoles('admin', 'faculty'), retryNotification);
router.post('/send', authorizeRoles('admin', 'faculty'), sendCustomNotification);

export default router;
