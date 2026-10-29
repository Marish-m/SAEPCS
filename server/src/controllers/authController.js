import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Student from '../models/Student.js';
import Parent from '../models/Parent.js';
import Faculty from '../models/Faculty.js';
import emailService from '../services/emailService.js';

// Generate JWT token helper
const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'saepcs_super_secret_jwt_key_2026_academic_monitoring',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Helper: Populate profile depending on role
const populateUserProfile = async (user) => {
  let profileData = null;
  if (user.role === 'student') {
    profileData = await Student.findOne({ user: user._id })
      .populate('department', 'name code')
      .populate('facultyAdvisor', 'employeeId designation');
  } else if (user.role === 'parent') {
    profileData = await Parent.findOne({ user: user._id }).populate({
      path: 'students',
      populate: [
        { path: 'user', select: 'name email phone' },
        { path: 'department', select: 'name code' },
      ],
    });
  } else if (user.role === 'faculty') {
    profileData = await Faculty.findOne({ user: user._id })
      .populate('department', 'name code')
      .populate('subjectsTaught', 'name code semester credits');
  }

  const userObj = user.toObject();
  delete userObj.password;
  delete userObj.resetPasswordToken;
  delete userObj.resetPasswordExpire;

  return {
    ...userObj,
    profile: profileData,
  };
};

// @desc    Login user & get JWT token
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email address and password.',
      });
    }

    if (mongoose.connection.readyState !== 1) {
      if (mongoose.connection.readyState === 2) {
        let attempts = 0;
        while (mongoose.connection.readyState === 2 && attempts < 20) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          attempts++;
        }
      }
      if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({
          success: false,
          message: 'Database service is currently initializing. Please try again in a few moments.',
        });
      }
    }

    // Must explicitly select +password since it is excluded by default in schema
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. User account not found.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Password is incorrect.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated. Please contact administrator.',
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
    const populatedUser = await populateUserProfile(user);

    res.status(200).json({
      success: true,
      message: 'Authentication successful.',
      token,
      user: populatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user (Session invalidation)
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = async (req, res, next) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Logged out successfully. Authentication token cleared.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current authenticated user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database service is currently unavailable.',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const populatedUser = await populateUserProfile(user);

    res.status(200).json({
      success: true,
      user: populatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot Password - Generate secure reset token
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide an email address.' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database service is currently unavailable.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No user registered with this email address.',
      });
    }

    // Generate token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Construct reset URL
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    const message = `You are receiving this email because a password reset request was submitted for your SAEPCS account.\n\nPlease reset your password by opening the following link (valid for 15 minutes):\n\n${resetUrl}\n\nIf you did not request this reset, please ignore this email.`;

    try {
      await emailService.sendEmail({
        to: user.email,
        subject: 'SAEPCS Password Reset Token',
        text: message,
      });

      res.status(200).json({
        success: true,
        message: 'Password reset link dispatched to user email.',
        resetLinkTest: process.env.NODE_ENV !== 'production' ? resetUrl : undefined,
      });
    } catch (err) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      return res.status(500).json({ success: false, message: 'Email could not be dispatched.' });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset Password with token
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password is required and must be at least 6 characters.',
      });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database service is currently unavailable.',
      });
    }

    // Hash token to compare with database
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select('+password');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired.',
      });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    const token = generateToken(user._id);
    const populatedUser = await populateUserProfile(user);

    res.status(200).json({
      success: true,
      message: 'Password updated successfully.',
      token,
      user: populatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Quick Demo Login Switcher
// @route   POST /api/auth/demo-login
// @access  Public
export const demoLogin = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['admin', 'faculty', 'student', 'parent'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid demo role provided' });
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: 'Database service is currently unavailable. Please verify MONGODB_URI in server/.env.',
      });
    }

    const user = await User.findOne({ role, isActive: true });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `No active ${role} found in database. Please run initial seed.`,
      });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);
    const populatedUser = await populateUserProfile(user);

    res.status(200).json({
      success: true,
      message: `Signed in as Demo ${role.toUpperCase()}`,
      token,
      user: populatedUser,
    });
  } catch (error) {
    next(error);
  }
};
