import LeaveRequest from '../models/LeaveRequest.js';
import Student from '../models/Student.js';
import Parent from '../models/Parent.js';
import Faculty from '../models/Faculty.js';
import Notification from '../models/Notification.js';
import SystemConfig from '../models/SystemConfig.js';
import { calculateStudentRisk } from '../services/riskAnalysisService.js';

// @desc    Apply for student leave with date validation and optional document upload
// @route   POST /api/leaves/apply
// @access  Private (Student, Parent)
export const applyLeave = async (req, res, next) => {
  try {
    const { studentId, startDate, endDate, reason, leaveType, documentUrl: explicitDocUrl } = req.body;

    let targetStudent = null;

    if (req.user.role === 'student') {
      targetStudent = await Student.findOne({ user: req.user._id });
      if (!targetStudent) {
        return res.status(403).json({ success: false, message: 'Student profile not found.' });
      }
    } else if (req.user.role === 'parent') {
      const parentDoc = await Parent.findOne({ user: req.user._id });
      if (!parentDoc || !parentDoc.students || parentDoc.students.length === 0) {
        return res.status(403).json({ success: false, message: 'No linked students found.' });
      }

      if (studentId) {
        targetStudent = await Student.findOne({
          _id: studentId,
          _id: { $in: parentDoc.students },
        });
      } else {
        targetStudent = await Student.findById(parentDoc.students[0]);
      }

      if (!targetStudent) {
        return res.status(403).json({
          success: false,
          message: 'You can only apply on behalf of your verified linked child.',
        });
      }
    }

    if (!startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Start date, end date, and reason are required fields.',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide valid start and end calendar dates.',
      });
    }

    // STRICT DATE RANGE VALIDATION: Prevent invalid date ranges
    if (end < start) {
      return res.status(400).json({
        success: false,
        message: 'End date cannot be earlier than start date.',
      });
    }

    // Calculate duration in days (inclusive)
    const diffTime = Math.abs(end - start);
    const durationDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

    // Supporting document from Multer file or payload
    let documentUrl = explicitDocUrl || '';
    let documentName = '';
    let documentSize = 0;

    if (req.file) {
      documentUrl = `/uploads/leaves/${req.file.filename}`;
      documentName = req.file.originalname;
      documentSize = req.file.size;
    }

    // Check for duplicate pending requests for the same date range
    const existingPending = await LeaveRequest.findOne({
      student: targetStudent._id,
      status: 'Pending',
      startDate: start,
      endDate: end,
    });

    if (existingPending) {
      return res.status(409).json({
        success: false,
        message: 'A pending leave application already exists for this exact date range.',
      });
    }

    // Check against institutional rules
    const config = await SystemConfig.getRiskThresholds();
    const threshold = config.excessiveLeaveThreshold || 6;

    const approvedLeaves = await LeaveRequest.find({
      student: targetStudent._id,
      status: 'Approved',
    });

    let currentApprovedDays = 0;
    approvedLeaves.forEach((l) => {
      currentApprovedDays += l.durationDays || 1;
    });

    const willExceedThreshold = currentApprovedDays + durationDays >= threshold;

    const leave = await LeaveRequest.create({
      student: targetStudent._id,
      startDate: start,
      endDate: end,
      durationDays,
      reason: reason.trim(),
      leaveType: leaveType || 'Personal',
      appliedBy: req.user.role,
      documentUrl,
      documentName,
      documentSize,
      status: 'Pending',
    });

    // Notify faculty advisor or admin
    if (targetStudent.facultyAdvisor) {
      const advisor = await Faculty.findById(targetStudent.facultyAdvisor).populate('user');
      if (advisor?.user) {
        await Notification.create({
          recipient: advisor.user._id,
          sender: req.user._id,
          title: `New Leave Application: ${leaveType || 'Leave'}`,
          message: `Student (Roll: ${targetStudent.rollNumber}) applied for ${durationDays} day(s) leave from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}.`,
          type: 'leave_status',
          channel: 'system',
        });
      }
    }

    // Recalculate student risk
    await calculateStudentRisk(targetStudent._id);

    res.status(201).json({
      success: true,
      message: 'Leave request submitted successfully for faculty review.',
      leave,
      usageAdvisory: willExceedThreshold
        ? `Advisory: Total approved leave would reach ${currentApprovedDays + durationDays} days (Institutional threshold: ${threshold} days).`
        : null,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get leave applications with privacy guards and full history
// @route   GET /api/leaves
// @access  Private
export const getLeaves = async (req, res, next) => {
  try {
    const { status, studentId } = req.query;
    const query = {};

    if (status && ['Pending', 'Approved', 'Rejected'].includes(status)) {
      query.status = status;
    }

    if (req.user.role === 'student') {
      const studentDoc = await Student.findOne({ user: req.user._id });
      if (!studentDoc) return res.status(200).json({ success: true, count: 0, leaves: [] });
      query.student = studentDoc._id;
    } else if (req.user.role === 'parent') {
      const parentDoc = await Parent.findOne({ user: req.user._id });
      if (!parentDoc || !parentDoc.students) {
        return res.status(200).json({ success: true, count: 0, leaves: [] });
      }
      if (studentId && parentDoc.students.some((s) => s.toString() === studentId)) {
        query.student = studentId;
      } else {
        query.student = { $in: parentDoc.students };
      }
    } else if (studentId) {
      query.student = studentId;
    }

    const leaves = await LeaveRequest.find(query)
      .populate({
        path: 'student',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'department', select: 'name code' },
        ],
      })
      .populate({
        path: 'reviewedBy',
        populate: { path: 'user', select: 'name designation' },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: leaves.length,
      leaves,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Approve or reject leave request with reviewer tracking
// @route   PUT /api/leaves/:id/status
// @access  Private (Faculty, Admin)
export const updateLeaveStatus = async (req, res, next) => {
  try {
    const { status, facultyRemarks } = req.body;

    // Decision validation
    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either Approved or Rejected.',
      });
    }

    const leave = await LeaveRequest.findById(req.params.id).populate({
      path: 'student',
      populate: [
        { path: 'user' },
        { path: 'parents', populate: { path: 'user' } },
      ],
    });

    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found.' });
    }

    // Prevent unauthorized status modification if already finalized
    if (leave.status !== 'Pending' && req.user.role !== 'admin') {
      let facultyDoc = await Faculty.findOne({ user: req.user._id });
      if (leave.reviewedBy && facultyDoc && leave.reviewedBy.toString() !== facultyDoc._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Unauthorized: This leave request has already been finalized by another reviewer.',
        });
      }
    }

    let facultyDoc = await Faculty.findOne({ user: req.user._id });
    if (!facultyDoc) facultyDoc = await Faculty.findOne();

    // Record reviewer, decision, timestamps and comments
    leave.status = status;
    leave.facultyRemarks = facultyRemarks ? facultyRemarks.trim() : '';
    leave.reviewedBy = facultyDoc?._id || null;
    leave.reviewedAt = new Date();
    await leave.save();

    // 1. Notify Student
    if (leave.student?.user) {
      await Notification.create({
        recipient: leave.student.user._id,
        sender: req.user._id,
        title: `Leave Request ${status}`,
        message: `Your ${leave.leaveType} leave application (${new Date(leave.startDate).toLocaleDateString()} to ${new Date(
          leave.endDate
        ).toLocaleDateString()}) has been ${status}. Remarks: ${facultyRemarks || 'None'}`,
        type: 'leave_status',
        channel: 'system',
      });
    }

    // 2. Notify Parent if linked
    if (leave.student?.parents && leave.student.parents.length > 0) {
      const parentUser = leave.student.parents[0]?.user;
      if (parentUser) {
        await Notification.create({
          recipient: parentUser._id,
          sender: req.user._id,
          title: `Leave Application for ${leave.student.user.name} ${status}`,
          message: `The leave request for ${leave.student.user.name} has been ${status} by faculty. Remarks: ${facultyRemarks || 'None'}`,
          type: 'leave_status',
          channel: 'all',
        });
      }
    }

    // Recalculate student risk immediately
    await calculateStudentRisk(leave.student._id);

    res.status(200).json({
      success: true,
      message: `Leave request has been marked as ${status}.`,
      leave,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student leave usage statistics and institutional threshold compliance
// @route   GET /api/leaves/usage/:studentId
// @access  Private
export const getLeaveUsage = async (req, res, next) => {
  try {
    let studentId = req.params.studentId;

    if (studentId === 'me' || req.user.role === 'student') {
      const studentDoc = await Student.findOne({ user: req.user._id });
      if (!studentDoc) {
        return res.status(404).json({ success: false, message: 'Student profile not found.' });
      }
      studentId = studentDoc._id;
    }

    const student = await Student.findById(studentId).populate('user', 'name rollNumber');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    // Load institutional rules
    const config = await SystemConfig.getRiskThresholds();
    const threshold = config.excessiveLeaveThreshold || 6;

    const allLeaves = await LeaveRequest.find({ student: student._id });

    let totalApprovedDays = 0;
    let pendingDays = 0;
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;

    const breakdownByType = {
      Medical: 0,
      'Academic/Duty': 0,
      Personal: 0,
      Family: 0,
    };

    allLeaves.forEach((l) => {
      const days = l.durationDays || 1;
      if (l.status === 'Approved') {
        totalApprovedDays += days;
        approvedCount++;
        breakdownByType[l.leaveType] = (breakdownByType[l.leaveType] || 0) + days;
      } else if (l.status === 'Pending') {
        pendingDays += days;
        pendingCount++;
      } else if (l.status === 'Rejected') {
        rejectedCount++;
      }
    });

    const isExceeded = totalApprovedDays >= threshold;
    const remainingDays = Math.max(0, threshold - totalApprovedDays);

    res.status(200).json({
      success: true,
      student: {
        _id: student._id,
        name: student.user?.name,
        rollNumber: student.rollNumber,
      },
      usage: {
        totalApprovedDays,
        pendingDays,
        threshold,
        remainingDays,
        isExceeded,
        approvedCount,
        rejectedCount,
        pendingCount,
        breakdownByType,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  applyLeave,
  getLeaves,
  updateLeaveStatus,
  getLeaveUsage,
};
