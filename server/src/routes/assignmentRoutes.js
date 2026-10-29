import express from 'express';
import {
  getAssignments,
  getAssignmentSubmissions,
  createAssignment,
  submitAssignment,
  gradeSubmission,
  deleteAssignment,
} from '../controllers/assignmentController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { assignmentUpload, handleUpload } from '../middleware/upload.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getAssignments);
router.post('/', authorizeRoles('faculty', 'admin'), createAssignment);
router.get('/:id/submissions', authorizeRoles('faculty', 'admin'), getAssignmentSubmissions);
router.post(
  '/:id/submit',
  authorizeRoles('student'),
  handleUpload(assignmentUpload, 'file'),
  submitAssignment
);
router.post('/:id/grade', authorizeRoles('faculty', 'admin'), gradeSubmission);
router.delete('/:id', authorizeRoles('faculty', 'admin'), deleteAssignment);

export default router;
