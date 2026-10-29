import express from 'express';
import {
  createAssessment,
  getAssessments,
  enterMarksBatch,
  addMarks,
  getMarks,
  getStudentMarksAnalytics,
  updateMarks,
  deleteMarks,
} from '../controllers/marksController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Assessment definitions
router.post('/assessments', authorizeRoles('faculty', 'admin'), createAssessment);
router.get('/assessments', getAssessments);

// Marks entry and batch
router.post('/batch', authorizeRoles('faculty', 'admin'), enterMarksBatch);
router.post('/', authorizeRoles('faculty', 'admin'), addMarks);
router.get('/', getMarks);
router.get('/student/:studentId', getStudentMarksAnalytics);
router.put('/:id', authorizeRoles('faculty', 'admin'), updateMarks);
router.delete('/:id', authorizeRoles('faculty', 'admin'), deleteMarks);

export default router;
