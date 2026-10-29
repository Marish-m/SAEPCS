import express from 'express';
import {
  getStudentReport,
  getAttendanceReport,
  getMarksReport,
  getAssignmentsReport,
  getLeavesReport,
  getRisksReport,
  getNotificationsReport,
  getClassPerformance,
} from '../controllers/reportController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Universal student summary report (accessed by student, parent, faculty, admin)
router.get('/student-summary/:studentId', getStudentReport);

// Modular domain reports with role-based scoping
router.get('/attendance', getAttendanceReport);
router.get('/marks', getMarksReport);
router.get('/assignments', getAssignmentsReport);
router.get('/leaves', getLeavesReport);
router.get('/academic-risks', getRisksReport);
router.get('/notifications', getNotificationsReport);

// Aggregate cohort reports (faculty & admin only)
router.get('/class-performance', authorizeRoles('admin', 'faculty'), getClassPerformance);

export default router;
