import InternalMark from '../models/InternalMark.js';
import Assessment from '../models/Assessment.js';
import Student from '../models/Student.js';
import Subject from '../models/Subject.js';
import Faculty from '../models/Faculty.js';
import Parent from '../models/Parent.js';
import Notification from '../models/Notification.js';
import { calculateStudentRisk } from '../services/riskAnalysisService.js';
import emailService from '../services/emailService.js';
import smsService from '../services/smsService.js';
import notificationService from '../services/notificationService.js';

// @desc    Create an assessment (Faculty / Admin)
// @route   POST /api/marks/assessments
// @access  Private (Faculty, Admin)
export const createAssessment = async (req, res, next) => {
  try {
    const { title, subject: subjectParam, assessmentType, maxMarks, date, semester, academicYear, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Assessment title is required.' });
    }

    const max = Number(maxMarks);
    if (!max || max <= 0) {
      return res.status(400).json({ success: false, message: 'Maximum marks must be a positive number greater than 0.' });
    }

    // Resolve subject
    let subjectDoc = null;
    if (subjectParam && subjectParam.match(/^[0-9a-fA-F]{24}$/)) {
      subjectDoc = await Subject.findById(subjectParam);
    } else if (subjectParam) {
      subjectDoc = await Subject.findOne({ $or: [{ name: subjectParam }, { code: subjectParam }] });
    }

    if (!subjectDoc) {
      subjectDoc = await Subject.findOne();
    }

    if (!subjectDoc) {
      return res.status(404).json({ success: false, message: 'Valid subject reference required.' });
    }

    // Resolve faculty
    let faculty = await Faculty.findOne({ user: req.user._id });
    if (!faculty) faculty = await Faculty.findOne();

    const assessment = await Assessment.create({
      title: title.trim(),
      subject: subjectDoc._id,
      faculty: faculty._id,
      assessmentType: assessmentType || 'Internal 1',
      maxMarks: max,
      date: date ? new Date(date) : new Date(),
      semester: semester || subjectDoc.semester || 1,
      academicYear: academicYear || '2025-2026',
      description: description || '',
    });

    const populated = await Assessment.findById(assessment._id)
      .populate('subject', 'name code')
      .populate({
        path: 'faculty',
        populate: { path: 'user', select: 'name designation' },
      });

    res.status(201).json({
      success: true,
      message: `Assessment "${assessment.title}" created successfully.`,
      assessment: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get assessments list
// @route   GET /api/marks/assessments
// @access  Private
export const getAssessments = async (req, res, next) => {
  try {
    const { subject, semester, assessmentType } = req.query;
    const query = {};

    if (semester) query.semester = Number(semester);
    if (assessmentType) query.assessmentType = assessmentType;

    if (subject) {
      if (subject.match(/^[0-9a-fA-F]{24}$/)) {
        query.subject = subject;
      } else {
        const subDoc = await Subject.findOne({ $or: [{ name: subject }, { code: subject }] });
        if (subDoc) query.subject = subDoc._id;
      }
    }

    const assessments = await Assessment.find(query)
      .populate('subject', 'name code semester credits')
      .populate({
        path: 'faculty',
        populate: { path: 'user', select: 'name designation' },
      })
      .sort({ date: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: assessments.length,
      assessments,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Enter/Update marks for multiple students in batch
// @route   POST /api/marks/batch
// @access  Private (Faculty, Admin)
export const enterMarksBatch = async (req, res, next) => {
  try {
    const { assessmentId, subject: subjectParam, assessmentType, maxMarks, records } = req.body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, message: 'Records array is required with student marks.' });
    }

    // Resolve assessment if provided
    let assessmentDoc = null;
    if (assessmentId) {
      assessmentDoc = await Assessment.findById(assessmentId);
    }

    const effectiveMax = assessmentDoc ? assessmentDoc.maxMarks : maxMarks ? Number(maxMarks) : 50;
    const effectiveType = assessmentDoc ? assessmentDoc.assessmentType : assessmentType || 'Internal 1';

    // Resolve subject
    let subjectDoc = null;
    if (assessmentDoc) {
      subjectDoc = await Subject.findById(assessmentDoc.subject);
    } else if (subjectParam && subjectParam.match(/^[0-9a-fA-F]{24}$/)) {
      subjectDoc = await Subject.findById(subjectParam);
    } else if (subjectParam) {
      subjectDoc = await Subject.findOne({ $or: [{ name: subjectParam }, { code: subjectParam }] });
    }

    if (!subjectDoc) subjectDoc = await Subject.findOne();

    // Resolve faculty
    let faculty = await Faculty.findOne({ user: req.user._id });
    if (!faculty) faculty = await Faculty.findOne();

    // SERVER-SIDE VALIDATION: Validate marks between zero and assessment maximum
    for (const r of records) {
      const obt = Number(r.obtainedMarks);
      if (isNaN(obt) || obt < 0 || obt > effectiveMax) {
        return res.status(400).json({
          success: false,
          message: `Validation error: Marks for student (${r.studentId}) must be between 0 and maximum marks (${effectiveMax}). Received: ${r.obtainedMarks}`,
        });
      }
    }

    const savedMarks = [];
    const lowMarksAlerts = [];

    for (const item of records) {
      const { studentId, obtainedMarks, remarks } = item;
      const obtained = Number(obtainedMarks);

      // Resolve student
      let student = null;
      if (studentId.match(/^[0-9a-fA-F]{24}$/)) {
        student = await Student.findById(studentId);
      }
      if (!student) {
        student = await Student.findOne({ rollNumber: studentId });
      }
      if (!student) continue;

      const percentage = Math.round((obtained / effectiveMax) * 100 * 10) / 10;

      // Check existing mark record
      const markQuery = {
        student: student._id,
        subject: subjectDoc._id,
        assessmentType: effectiveType,
      };
      if (assessmentDoc) {
        markQuery.assessment = assessmentDoc._id;
      }

      let mark = await InternalMark.findOne(markQuery);

      if (mark) {
        mark.maxMarks = effectiveMax;
        mark.obtainedMarks = obtained;
        mark.percentage = percentage;
        mark.remarks = remarks !== undefined ? remarks : mark.remarks;
        mark.faculty = faculty._id;
        if (assessmentDoc) mark.assessment = assessmentDoc._id;
        await mark.save();
        savedMarks.push(mark);
      } else {
        mark = await InternalMark.create({
          assessment: assessmentDoc ? assessmentDoc._id : null,
          student: student._id,
          subject: subjectDoc._id,
          faculty: faculty._id,
          assessmentType: effectiveType,
          maxMarks: effectiveMax,
          obtainedMarks: obtained,
          percentage,
          semester: student.semester || 1,
          remarks: remarks || '',
        });
        savedMarks.push(mark);
      }

      // Recalculate academic risk for this student
      await calculateStudentRisk(student._id);

      // If score is below 50%, alert parent
      if (percentage < 50) {
        const studentName = student.user?.name || student.rollNumber;
        const warningMsg = `Academic Warning: ${studentName} scored ${obtained}/${effectiveMax} (${percentage}%) in ${subjectDoc.name} (${effectiveType}). Remedial intervention is advised.`;

        const dispatchResult = await notificationService.dispatchDirectParentNotification({
          studentId: student._id,
          eventType: 'low_marks_warning',
          title: `Assessment Score Warning: ${studentName} in ${subjectDoc.name}`,
          message: warningMsg,
          metricValue: `${obtained}/${effectiveMax} (${percentage}%)`,
          details: `Scored below passing benchmark in ${subjectDoc.name} (${effectiveType})`,
          recommendedAction: 'Remedial faculty guidance and parent-faculty discussion recommended.',
          facultyId: req.user?._id,
        });

        if (dispatchResult.notification) {
          lowMarksAlerts.push(dispatchResult.notification);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Successfully saved marks for ${savedMarks.length} students in ${subjectDoc.name} (${effectiveType}).`,
      savedCount: savedMarks.length,
      lowMarksAlertsCount: lowMarksAlerts.length,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add individual internal assessment mark
// @route   POST /api/marks
// @access  Private (Faculty, Admin)
export const addMarks = async (req, res, next) => {
  try {
    const { studentId, subject: subjectParam, assessmentType, maxMarks, obtainedMarks, remarks, assessmentId } = req.body;

    if (!studentId || obtainedMarks === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Student and obtained marks are required.',
      });
    }

    const max = maxMarks ? Number(maxMarks) : 50;
    const obtained = Number(obtainedMarks);

    // SERVER-SIDE VALIDATION: Validate marks between zero and the assessment maximum
    if (isNaN(obtained) || obtained < 0 || obtained > max) {
      return res.status(400).json({
        success: false,
        message: `Validation Error: Obtained marks must be between 0 and maximum marks (${max}). Received: ${obtainedMarks}`,
      });
    }

    // Resolve student
    let student = null;
    if (studentId.match(/^[0-9a-fA-F]{24}$/)) {
      student = await Student.findById(studentId);
    }
    if (!student) {
      student = await Student.findOne({ rollNumber: studentId });
    }
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    // Resolve subject
    let subject = null;
    if (subjectParam && subjectParam.match(/^[0-9a-fA-F]{24}$/)) {
      subject = await Subject.findById(subjectParam);
    } else if (subjectParam) {
      subject = await Subject.findOne({ $or: [{ name: subjectParam }, { code: subjectParam }] });
    }
    if (!subject) subject = await Subject.findOne();

    // Resolve faculty
    let faculty = await Faculty.findOne({ user: req.user._id });
    if (!faculty) faculty = await Faculty.findOne();

    const percentage = Math.round((obtained / max) * 100 * 10) / 10;

    // Upsert or create assessment mark
    let markDoc = await InternalMark.findOne({
      student: student._id,
      subject: subject._id,
      assessmentType: assessmentType || 'Internal 1',
    });

    if (markDoc) {
      markDoc.maxMarks = max;
      markDoc.obtainedMarks = obtained;
      markDoc.percentage = percentage;
      markDoc.remarks = remarks || markDoc.remarks;
      markDoc.faculty = faculty._id;
      if (assessmentId) markDoc.assessment = assessmentId;
      await markDoc.save();
    } else {
      markDoc = await InternalMark.create({
        assessment: assessmentId || null,
        student: student._id,
        subject: subject._id,
        faculty: faculty._id,
        assessmentType: assessmentType || 'Internal 1',
        maxMarks: max,
        obtainedMarks: obtained,
        percentage,
        semester: student.semester || 1,
        remarks: remarks || '',
      });
    }

    // Recalculate academic risk
    const riskReport = await calculateStudentRisk(student._id);

    // If score is critically low (< 50%), alert parent
    if (percentage < 50) {
      const studentName = student.user?.name || student.rollNumber;
      const warningMsg = `Academic Warning: ${studentName} scored ${obtained}/${max} (${percentage}%) in ${subject.name} (${assessmentType || 'Internal 1'}). Remedial session is advised.`;

      await notificationService.dispatchDirectParentNotification({
        studentId: student._id,
        eventType: 'low_marks_warning',
        title: `Low Marks Warning: ${studentName} in ${subject.name}`,
        message: warningMsg,
        metricValue: `${obtained}/${max} (${percentage}%)`,
        details: `Assessment score below 50% in ${subject.name}`,
        recommendedAction: 'Remedial session with faculty advisor is advised.',
        facultyId: req.user?._id,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Assessment mark recorded successfully.',
      mark: markDoc,
      compositeRiskScore: riskReport.metrics.compositeRiskScore,
      riskLevel: riskReport.riskLevel,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get marks records with privacy enforcement
// @route   GET /api/marks
// @access  Private
export const getMarks = async (req, res, next) => {
  try {
    const { studentId, subject, assessmentType, semester, assessmentId } = req.query;
    const query = {};

    if (semester) query.semester = Number(semester);
    if (assessmentType) query.assessmentType = assessmentType;
    if (assessmentId) query.assessment = assessmentId;

    if (subject) {
      if (subject.match(/^[0-9a-fA-F]{24}$/)) {
        query.subject = subject;
      } else {
        const subDoc = await Subject.findOne({ $or: [{ name: subject }, { code: subject }] });
        if (subDoc) query.subject = subDoc._id;
      }
    }

    // Role-based privacy guard
    if (req.user.role === 'student') {
      const studentDoc = await Student.findOne({ user: req.user._id });
      if (!studentDoc) return res.status(200).json({ success: true, count: 0, marks: [] });
      query.student = studentDoc._id;
    } else if (req.user.role === 'parent') {
      const parentDoc = await Parent.findOne({ user: req.user._id });
      if (!parentDoc || !parentDoc.students || parentDoc.students.length === 0) {
        return res.status(200).json({ success: true, count: 0, marks: [] });
      }
      if (studentId && parentDoc.students.some((s) => s.toString() === studentId)) {
        query.student = studentId;
      } else {
        query.student = { $in: parentDoc.students };
      }
    } else if (studentId) {
      if (studentId.match(/^[0-9a-fA-F]{24}$/)) {
        query.student = studentId;
      } else {
        const st = await Student.findOne({ rollNumber: studentId });
        if (st) query.student = st._id;
      }
    }

    const marks = await InternalMark.find(query)
      .populate({
        path: 'student',
        populate: { path: 'user', select: 'name email rollNumber' },
      })
      .populate('subject', 'name code')
      .populate('assessment', 'title date')
      .populate({
        path: 'faculty',
        populate: { path: 'user', select: 'name designation' },
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: marks.length,
      marks,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get detailed marks analytics and totals for a student
// @route   GET /api/marks/student/:studentId
// @access  Private
export const getStudentMarksAnalytics = async (req, res, next) => {
  try {
    let studentId = req.params.studentId;

    let studentDoc = null;
    if (studentId.match(/^[0-9a-fA-F]{24}$/)) {
      studentDoc = await Student.findById(studentId);
      if (!studentDoc) {
        studentDoc = await Student.findOne({ user: studentId });
      }
    }
    if (!studentDoc) {
      studentDoc = await Student.findOne({ rollNumber: studentId });
    }

    if (!studentDoc) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    studentId = studentDoc._id;

    // Privacy guard
    if (req.user.role === 'student') {
      const myStudent = await Student.findOne({ user: req.user._id });
      if (!myStudent || myStudent._id.toString() !== studentId.toString()) {
        return res.status(403).json({ success: false, message: 'Forbidden access.' });
      }
    } else if (req.user.role === 'parent') {
      const parentDoc = await Parent.findOne({ user: req.user._id });
      if (!parentDoc || !parentDoc.students.some((s) => s.toString() === studentId.toString())) {
        return res.status(403).json({ success: false, message: 'Forbidden access to non-linked student.' });
      }
    }

    const marks = await InternalMark.find({ student: studentId })
      .populate('subject', 'name code')
      .populate('assessment', 'title date')
      .sort({ createdAt: 1 });

    const subjectMap = {};
    let totalObtained = 0;
    let totalMax = 0;

    marks.forEach((m) => {
      totalObtained += m.obtainedMarks;
      totalMax += m.maxMarks;
      const subKey = m.subject ? m.subject._id.toString() : 'unknown';
      const subName = m.subject ? m.subject.name : 'Unknown Course';
      const subCode = m.subject ? m.subject.code : '';

      if (!subjectMap[subKey]) {
        subjectMap[subKey] = {
          subjectId: subKey,
          subject: subName,
          code: subCode,
          assessments: [],
          totalObtained: 0,
          totalMax: 0,
        };
      }
      subjectMap[subKey].assessments.push({
        _id: m._id,
        type: m.assessmentType,
        title: m.assessment?.title || m.assessmentType,
        obtained: m.obtainedMarks,
        max: m.maxMarks,
        percentage: m.percentage,
        remarks: m.remarks,
        date: m.createdAt,
      });
      subjectMap[subKey].totalObtained += m.obtainedMarks;
      subjectMap[subKey].totalMax += m.maxMarks;
    });

    const subjectAverages = Object.values(subjectMap).map((s) => ({
      subjectId: s.subjectId,
      subject: s.subject,
      code: s.code,
      assessmentsCount: s.assessments.length,
      totalObtained: s.totalObtained,
      totalMax: s.totalMax,
      averagePercentage: s.totalMax > 0 ? Math.round((s.totalObtained / s.totalMax) * 100 * 10) / 10 : 0,
      assessments: s.assessments,
    }));

    const overallAveragePercentage =
      totalMax > 0 ? Math.round((totalObtained / totalMax) * 100 * 10) / 10 : 0;

    const academicStanding =
      overallAveragePercentage >= 75
        ? 'Distinction'
        : overallAveragePercentage >= 60
        ? 'First Class'
        : overallAveragePercentage >= 50
        ? 'Pass benchmark'
        : 'Remedial Required (<50%)';

    res.status(200).json({
      success: true,
      analytics: {
        totalAssessments: marks.length,
        totalObtained,
        totalMax,
        overallAveragePercentage,
        academicStanding,
        subjectAverages,
        rawRecords: marks,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update assessment mark
// @route   PUT /api/marks/:id
// @access  Private (Faculty, Admin)
export const updateMarks = async (req, res, next) => {
  try {
    const { obtainedMarks, maxMarks, remarks } = req.body;
    const mark = await InternalMark.findById(req.params.id);

    if (!mark) {
      return res.status(404).json({ success: false, message: 'Marks record not found.' });
    }

    const effectiveMax = maxMarks !== undefined ? Number(maxMarks) : mark.maxMarks;
    const effectiveObt = obtainedMarks !== undefined ? Number(obtainedMarks) : mark.obtainedMarks;

    // SERVER-SIDE VALIDATION: Validate marks between zero and the assessment maximum
    if (isNaN(effectiveObt) || effectiveObt < 0 || effectiveObt > effectiveMax) {
      return res.status(400).json({
        success: false,
        message: `Validation error: Obtained marks must be between 0 and maximum marks (${effectiveMax}). Received: ${obtainedMarks}`,
      });
    }

    mark.maxMarks = effectiveMax;
    mark.obtainedMarks = effectiveObt;
    mark.percentage = Math.round((effectiveObt / effectiveMax) * 100 * 10) / 10;
    if (remarks !== undefined) mark.remarks = remarks;

    await mark.save();

    // Recalculate academic risk for student
    await calculateStudentRisk(mark.student);

    res.status(200).json({
      success: true,
      message: 'Marks updated successfully.',
      mark,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete assessment mark
// @route   DELETE /api/marks/:id
// @access  Private (Faculty, Admin)
export const deleteMarks = async (req, res, next) => {
  try {
    const mark = await InternalMark.findById(req.params.id);
    if (!mark) {
      return res.status(404).json({ success: false, message: 'Marks record not found.' });
    }

    const studentId = mark.student;
    await mark.deleteOne();

    // Recalculate academic risk
    await calculateStudentRisk(studentId);

    res.status(200).json({
      success: true,
      message: 'Assessment mark record deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};
