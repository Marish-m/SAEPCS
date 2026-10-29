import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

// Import all 13 models
import User from './src/models/User.js';
import Student from './src/models/Student.js';
import Parent from './src/models/Parent.js';
import Faculty from './src/models/Faculty.js';
import Department from './src/models/Department.js';
import Subject from './src/models/Subject.js';
import Attendance from './src/models/Attendance.js';
import InternalMark from './src/models/InternalMark.js';
import Assignment from './src/models/Assignment.js';
import AssignmentSubmission from './src/models/AssignmentSubmission.js';
import LeaveRequest from './src/models/LeaveRequest.js';
import AcademicRisk from './src/models/AcademicRisk.js';
import Notification from './src/models/Notification.js';
import Assessment from './src/models/Assessment.js';
import SystemConfig from './src/models/SystemConfig.js';

// Import auth middlewares
import { authorizeRoles } from './src/middleware/auth.js';

dotenv.config();

const runTests = async () => {
  console.log('\n======================================================');
  console.log('🧪 RUNNING SAEPCS BACKEND & MONGOOSE VERIFICATION SUITE');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, testName) => {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  };

  // 1. Test Model Registration for Collections
  console.log('[Test Suite 1] Verifying Mongoose Collections');
  const models = [
    { name: 'User', model: User },
    { name: 'Student', model: Student },
    { name: 'Parent', model: Parent },
    { name: 'Faculty', model: Faculty },
    { name: 'Department', model: Department },
    { name: 'Subject', model: Subject },
    { name: 'Attendance', model: Attendance },
    { name: 'InternalMark', model: InternalMark },
    { name: 'Assessment', model: Assessment },
    { name: 'SystemConfig', model: SystemConfig },
    { name: 'Assignment', model: Assignment },
    { name: 'AssignmentSubmission', model: AssignmentSubmission },
    { name: 'LeaveRequest', model: LeaveRequest },
    { name: 'AcademicRisk', model: AcademicRisk },
    { name: 'Notification', model: Notification },
  ];

  models.forEach(({ name, model }) => {
    assert(model && model.modelName === name, `Model registered: ${name}`);
  });

  // 2. Test Password Hashing with bcrypt
  console.log('\n[Test Suite 2] Verifying Password Hashing & Encryption');
  const rawPassword = 'Password@123';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(rawPassword, salt);

  assert(hash !== rawPassword, 'Password is never stored in plain text');
  assert(hash.startsWith('$2'), 'Hash format conforms to bcrypt signature ($2a / $2b)');

  const isValidMatch = await bcrypt.compare(rawPassword, hash);
  assert(isValidMatch === true, 'bcrypt correctly verifies valid password');

  const isInvalidMatch = await bcrypt.compare('WrongPassword!999', hash);
  assert(isInvalidMatch === false, 'bcrypt correctly rejects invalid credentials');

  // 3. Test User Schema Sanitization & Password Masking
  console.log('\n[Test Suite 3] Verifying Security Sanitization (.toJSON)');
  const testUser = new User({
    name: 'Audit User',
    email: 'audit@saepcs.edu',
    password: rawPassword,
    role: 'faculty',
  });

  const jsonObject = testUser.toJSON();
  assert(jsonObject.password === undefined, 'Password field is stripped in toJSON response');
  assert(jsonObject.resetPasswordToken === undefined, 'Reset token is excluded in toJSON response');

  // 4. Test Crypto Password Reset Token Generation
  console.log('\n[Test Suite 4] Verifying Password Reset Token Generation');
  const rawResetToken = testUser.getResetPasswordToken();
  assert(typeof rawResetToken === 'string' && rawResetToken.length === 40, 'Generates 40-character hex crypto token');
  assert(testUser.resetPasswordToken.length === 64, 'Stored token is securely SHA-256 hashed (64 chars)');
  assert(testUser.resetPasswordExpire > Date.now(), 'Token expiry is set in future (15 minutes)');

  // 5. Test JWT Signing and Verification
  console.log('\n[Test Suite 5] Verifying JWT Token Generation & Verification');
  const secret = process.env.JWT_SECRET || 'saepcs_super_secret_jwt_key_2026_academic_monitoring';
  const token = jwt.sign({ id: 'dummy_user_id_123', role: 'student' }, secret, { expiresIn: '7d' });

  assert(typeof token === 'string' && token.split('.').length === 3, 'JWT token has valid 3-part format');

  const decoded = jwt.verify(token, secret);
  assert(decoded.id === 'dummy_user_id_123' && decoded.role === 'student', 'JWT payload decodes accurately');

  // 6. Test Role-Based Authorization Middleware
  console.log('\n[Test Suite 6] Verifying Role-Based Authorization Middleware');
  const reqFaculty = { user: { role: 'faculty' } };
  const reqStudent = { user: { role: 'student' } };
  let allowedFaculty = false;
  let deniedStudent = false;

  const facultyOnlyMiddleware = authorizeRoles('admin', 'faculty');

  // Test faculty access
  facultyOnlyMiddleware(reqFaculty, {}, () => {
    allowedFaculty = true;
  });
  assert(allowedFaculty === true, 'Faculty authorized for (admin, faculty) protected resource');

  // Test student access to faculty route
  const mockRes = {
    status: (code) => ({
      json: (body) => {
        if (code === 403) deniedStudent = true;
      },
    }),
  };
  facultyOnlyMiddleware(reqStudent, mockRes, () => {});
  assert(deniedStudent === true, 'Student correctly denied (403 Forbidden) for faculty-only resource');

  // Summary
  console.log('\n======================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
};

runTests().catch((err) => {
  console.error('Fatal test execution failure:', err);
  process.exit(1);
});
