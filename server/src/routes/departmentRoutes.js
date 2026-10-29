import express from 'express';
import {
  getDepartments,
  createDepartment,
  createSubject,
  deleteSubject,
} from '../controllers/departmentController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getDepartments);
router.post('/', authorizeRoles('admin'), createDepartment);
router.post('/subjects', authorizeRoles('admin', 'faculty'), createSubject);
router.delete('/subjects/:id', authorizeRoles('admin'), deleteSubject);

export default router;
