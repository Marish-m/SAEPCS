import express from 'express';
import {
  markAttendance,
  correctAttendance,
  checkAttendanceSession,
  getAttendance,
  getAttendanceSummary,
  getAttendanceHistory,
} from '../controllers/attendanceController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Faculty & Admin endpoints
router.post('/mark', authorizeRoles('faculty', 'admin'), markAttendance);
router.put('/correct/:id', authorizeRoles('faculty', 'admin'), correctAttendance);
router.get('/check', authorizeRoles('faculty', 'admin'), checkAttendanceSession);
router.get('/history', authorizeRoles('faculty', 'admin'), getAttendanceHistory);

// Generalized & Role-guarded endpoints
router.get('/', getAttendance);
router.get('/summary/:studentId', getAttendanceSummary);

export default router;
