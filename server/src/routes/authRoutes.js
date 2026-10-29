import express from 'express';
import {
  loginUser,
  logoutUser,
  getMe,
  forgotPassword,
  resetPassword,
  demoLogin,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.post('/login', loginUser);
router.post('/logout', authenticate, logoutUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/demo-login', demoLogin);

// Protected routes
router.get('/me', authenticate, getMe);

export default router;
