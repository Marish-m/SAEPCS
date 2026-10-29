import express from 'express';
import {
  getRiskOverview,
  getStudentRiskDetails,
  getStudentRiskHistory,
  resolveRisk,
  sendRiskAlertToParent,
  getRiskSettings,
  updateRiskSettings,
} from '../controllers/riskController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Configurable threshold settings (Admin configurable)
router.get('/settings', getRiskSettings);
router.put('/settings', authorizeRoles('admin'), updateRiskSettings);

// Risk analysis & parent alerts
router.get('/overview', authorizeRoles('admin', 'faculty'), getRiskOverview);
router.get('/history/:studentId', getStudentRiskHistory);
router.put('/:riskId/resolve', authorizeRoles('admin', 'faculty'), resolveRisk);
router.get('/student/:studentId', getStudentRiskDetails);
router.post('/notify-parent/:studentId', authorizeRoles('admin', 'faculty'), sendRiskAlertToParent);

export default router;
