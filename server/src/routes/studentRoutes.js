import express from 'express';
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getMyChildren,
  getParentsList,
  getSubjectsList,
  createParent,
  linkStudentToParent,
  unlinkStudentFromParent,
  deleteParent,
  getStudentParentContact,
  updateStudentParentContact,
} from '../controllers/studentController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/subjects', getSubjectsList);
router.get('/parent/my-children', authorizeRoles('parent', 'admin'), getMyChildren);
router.get('/parents/list', authorizeRoles('admin', 'faculty'), getParentsList);
router.get('/:id/parent-contact', authorizeRoles('admin', 'faculty'), getStudentParentContact);
router.put('/:id/parent-contact', authorizeRoles('admin', 'faculty'), updateStudentParentContact);
router.post('/parents', authorizeRoles('admin'), createParent);
router.post('/parents/link', authorizeRoles('admin'), linkStudentToParent);
router.post('/parents/unlink', authorizeRoles('admin'), unlinkStudentFromParent);
router.delete('/parents/:id', authorizeRoles('admin'), deleteParent);

router.get('/', authorizeRoles('admin', 'faculty'), getStudents);
router.get('/:id', getStudentById);
router.post('/', authorizeRoles('admin'), createStudent);
router.put('/:id', authorizeRoles('admin'), updateStudent);
router.delete('/:id', authorizeRoles('admin'), deleteStudent);

export default router;
