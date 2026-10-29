import express from 'express';
import {
  applyLeave,
  getLeaves,
  updateLeaveStatus,
  getLeaveUsage,
} from '../controllers/leaveController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { leaveUpload, handleUpload } from '../middleware/upload.js';

const router = express.Router();

router.use(authenticate);

router.post(
  '/apply',
  authorizeRoles('student', 'parent'),
  handleUpload(leaveUpload, 'document'),
  applyLeave
);
router.get('/', getLeaves);
router.get('/usage/:studentId', getLeaveUsage);
router.put('/:id/status', authorizeRoles('faculty', 'admin'), updateLeaveStatus);

export default router;
