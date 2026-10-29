import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Student from '../models/Student.js';
import Parent from '../models/Parent.js';
import Faculty from '../models/Faculty.js';

// JWT Verification Middleware
export const authenticate = async (req, res, next) => {
  let token = null;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No authentication token provided.',
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'saepcs_super_secret_jwt_key_2026_academic_monitoring'
    );

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session. User account no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact administrator.',
      });
    }

    req.user = user;

    // Attach role-specific sub-document profile if applicable
    if (user.role === 'student') {
      req.student = await Student.findOne({ user: user._id }).populate('department');
    } else if (user.role === 'parent') {
      req.parent = await Parent.findOne({ user: user._id }).populate({
        path: 'students',
        populate: { path: 'department' },
      });
    } else if (user.role === 'faculty') {
      req.faculty = await Faculty.findOne({ user: user._id }).populate('department');
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token verification failed: ' + error.message,
    });
  }
};

// Role-Based Authorization Middleware
export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before accessing this endpoint.',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: User role '${req.user.role}' is not authorized to perform this operation.`,
      });
    }

    next();
  };
};

// Granular Privacy Guard: Prevent students/parents from inspecting other students' records
export const authorizeStudentRecordAccess = (paramName = 'studentId') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    // Admins and faculty have institutional access
    if (req.user.role === 'admin' || req.user.role === 'faculty') {
      return next();
    }

    const targetStudentId = req.params[paramName] || req.query[paramName] || req.body[paramName];
    if (!targetStudentId) return next();

    // Student role: can only access their own profile/records
    if (req.user.role === 'student') {
      const studentDoc = req.student || (await Student.findOne({ user: req.user._id }));
      if (
        !studentDoc ||
        (studentDoc._id.toString() !== targetStudentId.toString() &&
          studentDoc.user.toString() !== targetStudentId.toString())
      ) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view another student’s academic records.',
        });
      }
      return next();
    }

    // Parent role: can only access their linked children
    if (req.user.role === 'parent') {
      const parentDoc = req.parent || (await Parent.findOne({ user: req.user._id }));
      if (!parentDoc || !parentDoc.students) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: No linked children found for this parent account.',
        });
      }

      const isLinked = parentDoc.students.some(
        (s) =>
          (s._id ? s._id.toString() : s.toString()) === targetStudentId.toString() ||
          (s.user && s.user.toString() === targetStudentId.toString())
      );

      if (!isLinked) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only view records for your linked child.',
        });
      }
      return next();
    }

    return res.status(403).json({ success: false, message: 'Access denied.' });
  };
};
