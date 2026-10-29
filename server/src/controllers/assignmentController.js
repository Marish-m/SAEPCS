import Assignment from '../models/Assignment.js';
import AssignmentSubmission from '../models/AssignmentSubmission.js';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';
import Subject from '../models/Subject.js';
import Department from '../models/Department.js';
import Parent from '../models/Parent.js';
import Notification from '../models/Notification.js';
import { calculateStudentRisk } from '../services/riskAnalysisService.js';

// @desc    Get assignments with dynamic status detection (Pending, Submitted, Late, Missing, Graded)
// @route   GET /api/assignments
// @access  Private
export const getAssignments = async (req, res, next) => {
  try {
    const { department, semester, subject } = req.query;
    const query = {};

    if (department) query.department = department;
    if (semester) query.semester = Number(semester);
    if (subject) query.subject = subject;

    let studentDoc = null;
    if (req.user.role === 'student') {
      studentDoc = await Student.findOne({ user: req.user._id });
      if (studentDoc) {
        if (!query.department && studentDoc.department) {
          query.department = studentDoc.department;
        }
        if (!query.semester && studentDoc.semester) {
          query.semester = studentDoc.semester;
        }
      }
    } else if (req.user.role === 'parent') {
      const parentDoc = await Parent.findOne({ user: req.user._id });
      if (parentDoc && parentDoc.students?.length > 0) {
        const targetStudentId = req.query.studentId || parentDoc.students[0];
        studentDoc = await Student.findById(targetStudentId);
        if (studentDoc) {
          if (!query.department && studentDoc.department) {
            query.department = studentDoc.department;
          }
          if (!query.semester && studentDoc.semester) {
            query.semester = studentDoc.semester;
          }
        }
      }
    }

    const assignments = await Assignment.find(query)
      .populate('subject', 'name code')
      .populate('department', 'name code')
      .populate({
        path: 'faculty',
        populate: { path: 'user', select: 'name designation email' },
      })
      .sort({ dueDate: 1 });

    const now = new Date();

    const formattedAssignments = await Promise.all(
      assignments.map(async (a) => {
        const obj = a.toObject();
        const dueDate = new Date(a.dueDate);
        const isPastDeadline = now > dueDate;
        obj.isOverdue = isPastDeadline;

        if (studentDoc) {
          const submission = await AssignmentSubmission.findOne({
            assignment: a._id,
            student: studentDoc._id,
          });

          obj.mySubmission = submission || null;

          // Compute accurate status for student: Pending, Submitted, Late, Missing, Graded
          if (submission) {
            if (submission.status === 'Graded') {
              obj.status = 'Graded';
            } else if (submission.status === 'Late' || submission.isLate) {
              obj.status = 'Late';
            } else {
              obj.status = 'Submitted';
            }
          } else {
            if (isPastDeadline) {
              obj.status = 'Missing';
            } else {
              obj.status = 'Pending';
            }
          }
        } else {
          // Faculty / Admin view metrics
          const submissions = await AssignmentSubmission.find({ assignment: a._id });
          obj.submissionsCount = submissions.length;
          obj.gradedCount = submissions.filter((s) => s.status === 'Graded').length;

          // Eligible students count
          const eligibleStudents = await Student.find({
            department: a.department?._id || a.department,
            semester: a.semester,
          });
          obj.totalEligibleStudents = eligibleStudents.length;

          const submittedStudentIds = new Set(submissions.map((s) => s.student.toString()));
          const unsubmittedStudents = eligibleStudents.filter(
            (s) => !submittedStudentIds.has(s._id.toString())
          );

          obj.missingCount = isPastDeadline ? unsubmittedStudents.length : 0;
          obj.pendingCount = !isPastDeadline ? unsubmittedStudents.length : 0;
          obj.status = isPastDeadline ? 'Closed' : 'Active';
        }

        return obj;
      })
    );

    res.status(200).json({
      success: true,
      count: formattedAssignments.length,
      assignments: formattedAssignments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get submissions for a specific assignment (Faculty Review Console)
// @route   GET /api/assignments/:id/submissions
// @access  Private (Faculty, Admin)
export const getAssignmentSubmissions = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate('subject', 'name code')
      .populate('department', 'name code')
      .populate({
        path: 'faculty',
        populate: { path: 'user', select: 'name designation' },
      });

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    const submissions = await AssignmentSubmission.find({ assignment: assignment._id })
      .populate({
        path: 'student',
        populate: [
          { path: 'user', select: 'name email phone' },
          { path: 'department', select: 'name code' },
        ],
      })
      .populate({
        path: 'gradedBy',
        populate: { path: 'user', select: 'name designation' },
      })
      .sort({ submittedAt: -1 });

    // Identify students in this class who haven't submitted
    const deptId = assignment.department?._id || assignment.department;
    const eligibleStudents = await Student.find({
      department: deptId,
      semester: assignment.semester,
    }).populate('user', 'name email rollNumber');

    const submittedStudentIds = new Set(submissions.map((s) => s.student?._id?.toString()));
    const now = new Date();
    const isPastDeadline = now > new Date(assignment.dueDate);

    const missingStudents = eligibleStudents
      .filter((st) => !submittedStudentIds.has(st._id.toString()))
      .map((st) => ({
        student: st,
        status: isPastDeadline ? 'Missing' : 'Pending',
        isOverdue: isPastDeadline,
      }));

    res.status(200).json({
      success: true,
      assignment,
      submissions,
      missingStudents,
      stats: {
        totalEligible: eligibleStudents.length,
        submittedCount: submissions.length,
        missingCount: isPastDeadline ? missingStudents.length : 0,
        pendingCount: !isPastDeadline ? missingStudents.length : 0,
        gradedCount: submissions.filter((s) => s.status === 'Graded').length,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new assignment
// @route   POST /api/assignments
// @access  Private (Faculty, Admin)
export const createAssignment = async (req, res, next) => {
  try {
    const {
      title,
      description,
      subject: subjectParam,
      department: deptParam,
      semester,
      dueDate,
      maxMarks,
    } = req.body;

    if (!title || !description || !dueDate) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and due date are required fields.',
      });
    }

    const parsedDueDate = new Date(dueDate);
    if (isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid deadline date.',
      });
    }

    const parsedMaxMarks = maxMarks ? Number(maxMarks) : 50;
    if (isNaN(parsedMaxMarks) || parsedMaxMarks <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Maximum marks must be a positive number greater than 0.',
      });
    }

    // Resolve Faculty
    let facultyDoc = await Faculty.findOne({ user: req.user._id });
    if (!facultyDoc) facultyDoc = await Faculty.findOne();

    // Resolve Subject
    let subjectDoc = null;
    if (subjectParam && subjectParam.match(/^[0-9a-fA-F]{24}$/)) {
      subjectDoc = await Subject.findById(subjectParam);
    } else if (subjectParam) {
      subjectDoc = await Subject.findOne({ $or: [{ name: subjectParam }, { code: subjectParam }] });
    }
    if (!subjectDoc) subjectDoc = await Subject.findOne();

    // Resolve Department
    let deptDoc = null;
    if (deptParam && deptParam.match(/^[0-9a-fA-F]{24}$/)) {
      deptDoc = await Department.findById(deptParam);
    } else if (deptParam) {
      deptDoc = await Department.findOne({ $or: [{ name: deptParam }, { code: deptParam }] });
    }
    if (!deptDoc && subjectDoc?.department) {
      deptDoc = await Department.findById(subjectDoc.department);
    }
    if (!deptDoc) deptDoc = await Department.findOne();

    const assignment = await Assignment.create({
      faculty: facultyDoc._id,
      subject: subjectDoc._id,
      department: deptDoc._id,
      semester: semester ? Number(semester) : (subjectDoc?.semester || 4),
      title: title.trim(),
      description: description.trim(),
      dueDate: parsedDueDate,
      maxMarks: parsedMaxMarks,
    });

    // Notify students of this department & semester
    const targetStudents = await Student.find({
      department: deptDoc._id,
      semester: assignment.semester,
    }).populate('user');

    if (targetStudents.length > 0) {
      const notifs = targetStudents
        .filter((s) => s.user && s.user.isActive)
        .map((s) => ({
          recipient: s.user._id,
          sender: req.user._id,
          title: `New Assignment Published: ${title}`,
          message: `An assignment for ${subjectDoc.name} has been published. Due date: ${parsedDueDate.toLocaleDateString()} (Max Marks: ${parsedMaxMarks}).`,
          type: 'assignment_due',
          channel: 'system',
        }));
      await Notification.insertMany(notifs);

      // Recalculate risk for students in this class
      targetStudents.forEach((st) => {
        calculateStudentRisk(st._id).catch(() => {});
      });
    }

    res.status(201).json({
      success: true,
      message: 'Assignment published and students notified.',
      assignment,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit assignment (Student) with optional secure file upload
// @route   POST /api/assignments/:id/submit
// @access  Private (Student)
export const submitAssignment = async (req, res, next) => {
  try {
    const { submissionText, fileUrl: explicitFileUrl } = req.body;
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    const studentDoc = await Student.findOne({ user: req.user._id });
    if (!studentDoc) {
      return res.status(403).json({ success: false, message: 'Student profile not found.' });
    }

    const now = new Date();
    const isLate = now > new Date(assignment.dueDate);

    // Process file if uploaded via Multer
    let finalFileUrl = explicitFileUrl || '';
    let fileName = '';
    let originalFileName = '';
    let fileSize = 0;

    if (req.file) {
      finalFileUrl = `/uploads/assignments/${req.file.filename}`;
      fileName = req.file.filename;
      originalFileName = req.file.originalname;
      fileSize = req.file.size;
    }

    if (!submissionText && !finalFileUrl) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either a solution summary/text or upload a submission file.',
      });
    }

    // Upsert submission record
    let submission = await AssignmentSubmission.findOne({
      assignment: assignment._id,
      student: studentDoc._id,
    });

    if (submission) {
      submission.submissionText = submissionText !== undefined ? submissionText : submission.submissionText;
      if (finalFileUrl) {
        submission.fileUrl = finalFileUrl;
        submission.fileName = fileName || submission.fileName;
        submission.originalFileName = originalFileName || submission.originalFileName;
        submission.fileSize = fileSize || submission.fileSize;
      }
      submission.submittedAt = now;
      submission.isLate = isLate;
      // Preserve Graded status if already graded, otherwise set Late or Submitted
      if (submission.status !== 'Graded') {
        submission.status = isLate ? 'Late' : 'Submitted';
      }
      await submission.save();
    } else {
      submission = await AssignmentSubmission.create({
        assignment: assignment._id,
        student: studentDoc._id,
        submissionText: submissionText || '',
        fileUrl: finalFileUrl,
        fileName,
        originalFileName,
        fileSize,
        submittedAt: now,
        isLate,
        status: isLate ? 'Late' : 'Submitted',
      });
    }

    // Recalculate student risk after submission
    await calculateStudentRisk(studentDoc._id);

    res.status(200).json({
      success: true,
      message: isLate
        ? 'Assignment submitted after deadline (Marked Late).'
        : 'Assignment submitted successfully on time!',
      submission,
      isLate,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Grade submission and enter feedback (Faculty)
// @route   POST /api/assignments/:id/grade
// @access  Private (Faculty, Admin)
export const gradeSubmission = async (req, res, next) => {
  try {
    const { studentId, submissionId, obtainedMarks, feedback } = req.body;
    const assignment = await Assignment.findById(req.params.id);

    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    if (obtainedMarks === undefined || obtainedMarks === null || obtainedMarks === '') {
      return res.status(400).json({
        success: false,
        message: 'Obtained marks value is required.',
      });
    }

    const marksNum = Number(obtainedMarks);
    if (isNaN(marksNum)) {
      return res.status(400).json({
        success: false,
        message: 'Obtained marks must be a valid number.',
      });
    }

    // Boundary validation: 0 <= marks <= maxMarks
    if (marksNum < 0) {
      return res.status(400).json({
        success: false,
        message: 'Obtained marks cannot be negative.',
      });
    }

    if (marksNum > assignment.maxMarks) {
      return res.status(400).json({
        success: false,
        message: `Obtained marks (${marksNum}) cannot exceed maximum marks (${assignment.maxMarks}).`,
      });
    }

    let facultyDoc = await Faculty.findOne({ user: req.user._id });
    if (!facultyDoc) facultyDoc = await Faculty.findOne();

    let querySub = null;
    if (submissionId) {
      querySub = { _id: submissionId, assignment: assignment._id };
    } else if (studentId) {
      querySub = { assignment: assignment._id, student: studentId };
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either studentId or submissionId is required for grading.',
      });
    }

    const submission = await AssignmentSubmission.findOne(querySub).populate({
      path: 'student',
      populate: { path: 'user' },
    });

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'No submission found for this student to grade.',
      });
    }

    submission.obtainedMarks = marksNum;
    submission.feedback = feedback ? feedback.trim() : '';
    submission.status = 'Graded';
    submission.gradedBy = facultyDoc?._id || null;
    submission.gradedAt = new Date();
    await submission.save();

    // Notify student of grading and feedback
    if (submission.student?.user) {
      await Notification.create({
        recipient: submission.student.user._id,
        sender: req.user._id,
        title: `Assignment Evaluated: ${assignment.title}`,
        message: `Your submission for "${assignment.title}" has been graded: ${marksNum}/${assignment.maxMarks}. Feedback: ${feedback || 'Satisfactory work.'}`,
        type: 'assignment_due',
        channel: 'system',
      });
    }

    // Recalculate student risk after marks updated
    await calculateStudentRisk(studentId);

    res.status(200).json({
      success: true,
      message: 'Submission graded successfully and student notified.',
      submission,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete assignment
// @route   DELETE /api/assignments/:id
// @access  Private (Faculty, Admin)
export const deleteAssignment = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ success: false, message: 'Assignment not found.' });
    }

    // Fetch affected students before deleting
    const affectedSubmissions = await AssignmentSubmission.find({ assignment: assignment._id });
    const studentIds = [...new Set(affectedSubmissions.map((s) => s.student.toString()))];

    await AssignmentSubmission.deleteMany({ assignment: assignment._id });
    await assignment.deleteOne();

    // Recalculate risk for affected students
    studentIds.forEach((stId) => {
      calculateStudentRisk(stId).catch(() => {});
    });

    res.status(200).json({ success: true, message: 'Assignment deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

export default {
  getAssignments,
  getAssignmentSubmissions,
  createAssignment,
  submitAssignment,
  gradeSubmission,
  deleteAssignment,
};
