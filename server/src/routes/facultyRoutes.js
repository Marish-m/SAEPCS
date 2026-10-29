import express from 'express';
import {
  getFaculty,
  getFacultyById,
  createFaculty,
  updateFaculty,
  deleteFaculty,
} from '../controllers/facultyController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', authorizeRoles('admin', 'faculty'), getFaculty);
router.get('/:id', authorizeRoles('admin', 'faculty'), getFacultyById);
router.post('/', authorizeRoles('admin'), createFaculty);
router.put('/:id', authorizeRoles('admin'), updateFaculty);
router.delete('/:id', authorizeRoles('admin'), deleteFaculty);

export default router;
