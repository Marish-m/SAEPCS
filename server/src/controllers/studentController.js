import User from '../models/User.js';
import Student from '../models/Student.js';
import Parent from '../models/Parent.js';
import Department from '../models/Department.js';
import AcademicRisk from '../models/AcademicRisk.js';
import Subject from '../models/Subject.js';

// @desc    Get all subjects
// @route   GET /api/students/subjects
// @access  Private
export const getSubjectsList = async (req, res, next) => {
  try {
    const { semester, department } = req.query;
    const query = {};
    if (semester) query.semester = Number(semester);
    if (department) query.department = department;

    const subjects = await Subject.find(query)
      .populate('department', 'name code')
      .sort({ code: 1 });

    res.status(200).json({
      success: true,
      count: subjects.length,
      subjects,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all students
// @route   GET /api/students
// @access  Private (Admin, Faculty)
export const getStudents = async (req, res, next) => {
  try {
    const { search, department, semester } = req.query;
    const query = {};

    if (semester) query.semester = Number(semester);

    if (department) {
      const deptDoc = await Department.findOne({
        $or: [{ code: department.toUpperCase() }, { name: department }],
      });
      if (deptDoc) query.department = deptDoc._id;
    }

    let students = await Student.find(query)
      .populate('user', 'name email phone isActive')
      .populate('department', 'name code')
      .populate({
        path: 'parents',
        populate: { path: 'user', select: 'name email phone' },
      })
      .populate({
        path: 'facultyAdvisor',
        populate: { path: 'user', select: 'name designation' },
      });

    // Filter active users and search query
    students = students.filter((s) => s.user && s.user.isActive);

    if (search) {
      const sLower = search.toLowerCase();
      students = students.filter(
        (s) =>
          s.rollNumber.toLowerCase().includes(sLower) ||
          s.user.name.toLowerCase().includes(sLower) ||
          s.user.email.toLowerCase().includes(sLower)
      );
    }

    // Attach AcademicRisk data to each student
    const studentListWithRisk = await Promise.all(
      students.map(async (st) => {
        const risk = await AcademicRisk.findOne({ student: st._id });
        return {
          ...st.toObject(),
          risk: risk || null,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: studentListWithRisk.length,
      students: studentListWithRisk,
      data: studentListWithRisk,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get student details with academic summary
// @route   GET /api/students/:id
// @access  Private
export const getStudentById = async (req, res, next) => {
  try {
    const studentId = req.params.id;

    const student = await Student.findById(studentId)
      .populate('user', 'name email phone isActive')
      .populate('department', 'name code')
      .populate({
        path: 'parents',
        populate: { path: 'user', select: 'name email phone' },
      })
      .populate({
        path: 'facultyAdvisor',
        populate: { path: 'user', select: 'name email phone' },
      });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    // Security check: Student can only view own record; Parent can only view linked children
    if (req.user.role === 'student' && student.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to view another student’s profile.',
      });
    }

    if (req.user.role === 'parent') {
      const parentDoc = await Parent.findOne({ user: req.user._id });
      const isLinked = parentDoc?.students.some((s) => s.toString() === student._id.toString());
      if (!isLinked) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only view profiles for your linked children.',
        });
      }
    }

    const risk = await AcademicRisk.findOne({ student: student._id });

    res.status(200).json({
      success: true,
      student,
      academicSummary: risk,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new student
// @route   POST /api/students
// @access  Private (Admin)
export const createStudent = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      rollNumber,
      department,
      semester,
      section,
      parentId,
      parentName,
      parentPhone,
      parentEmail,
    } = req.body;

    if (!name || !email || !rollNumber) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and roll number are mandatory fields.',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user account with this email already exists.',
      });
    }

    const existingRoll = await Student.findOne({ rollNumber: rollNumber.toUpperCase().trim() });
    if (existingRoll) {
      return res.status(400).json({
        success: false,
        message: 'This roll number is already assigned to an existing student.',
      });
    }

    // Resolve Department ObjectId
    let deptId = department;
    if (department && !department.toString().match(/^[0-9a-fA-F]{24}$/)) {
      const d = await Department.findOne({
        $or: [{ code: department.toUpperCase() }, { name: department }],
      });
      if (d) deptId = d._id;
    }
    if (!deptId) {
      const firstDept = await Department.findOne();
      if (firstDept) deptId = firstDept._id;
    }

    // Create User credentials
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password || 'Password@123',
      role: 'student',
      phone: phone || '',
    });

    // Handle parent linking or creation
    let linkedParentIds = [];
    if (parentId && parentId.toString().match(/^[0-9a-fA-F]{24}$/)) {
      linkedParentIds.push(parentId);
    } else if (parentName && parentName.trim()) {
      // Find or create parent
      const pEmail = parentEmail
        ? parentEmail.toLowerCase().trim()
        : `${email.split('@')[0]}.parent@saepcs.edu`;
      let pUser = await User.findOne({ email: pEmail });
      let pDoc = null;

      if (!pUser) {
        pUser = await User.create({
          name: parentName.trim(),
          email: pEmail,
          password: 'Password@123',
          role: 'parent',
          phone: parentPhone || '',
        });
        pDoc = await Parent.create({
          user: pUser._id,
          relationship: 'Parent / Guardian',
          students: [],
        });
      } else {
        pDoc = await Parent.findOne({ user: pUser._id });
        if (!pDoc) {
          pDoc = await Parent.create({
            user: pUser._id,
            relationship: 'Parent / Guardian',
            students: [],
          });
        }
      }

      if (pDoc) {
        linkedParentIds.push(pDoc._id);
      }
    }

    // Create Student Profile
    const student = await Student.create({
      user: user._id,
      rollNumber: rollNumber.toUpperCase().trim(),
      department: deptId,
      semester: semester ? Number(semester) : 4,
      section: section || 'A',
      parents: linkedParentIds,
    });

    // If parent was linked, update Parent's students array
    if (linkedParentIds.length > 0) {
      await Parent.updateMany(
        { _id: { $in: linkedParentIds } },
        { $addToSet: { students: student._id } }
      );
    }

    // Initialize clean AcademicRisk record with all required schema fields
    const initialRisk = await AcademicRisk.create({
      student: student._id,
      riskType: 'Composite',
      severity: 'Low',
      reason: 'Initial enrollment profile initialized',
      status: 'Active',
      attendancePercentage: 100,
      marksAveragePercentage: 0,
      pendingAssignmentsCount: 0,
      missingAssignmentsCount: 0,
      approvedLeaveDays: 0,
      compositeRiskScore: 0,
      riskLevel: 'Low Risk',
      riskFactors: [],
      recommendedAction: 'Continue routine academic engagement tracking.',
    });

    const populatedStudent = await Student.findById(student._id)
      .populate('user', 'name email phone isActive')
      .populate('department', 'name code')
      .populate({
        path: 'parents',
        populate: { path: 'user', select: 'name email phone' },
      });

    res.status(201).json({
      success: true,
      message: 'Student enrolled successfully.',
      student: {
        ...populatedStudent.toObject(),
        risk: initialRisk,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update student details
// @route   PUT /api/students/:id
// @access  Private (Admin)
export const updateStudent = async (req, res, next) => {
  try {
    const { name, phone, semester, section, department } = req.body;
    const student = await Student.findById(req.params.id);

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    if (name || phone !== undefined) {
      await User.findByIdAndUpdate(student.user, {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
      });
    }

    if (semester) student.semester = Number(semester);
    if (section) student.section = section;
    if (department) student.department = department;

    await student.save();

    res.status(200).json({
      success: true,
      message: 'Student profile updated successfully.',
      student,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete student (Soft deactivate)
// @route   DELETE /api/students/:id
// @access  Private (Admin)
export const deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    await User.findByIdAndUpdate(student.user, { isActive: false });

    res.status(200).json({
      success: true,
      message: 'Student account deactivated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get linked children for logged in parent
// @route   GET /api/students/parent/my-children
// @access  Private (Parent)
export const getMyChildren = async (req, res, next) => {
  try {
    const parent = await Parent.findOne({ user: req.user._id });
    if (!parent || !parent.students || parent.students.length === 0) {
      return res.status(200).json({ success: true, count: 0, children: [] });
    }

    const students = await Student.find({ _id: { $in: parent.students } })
      .populate('user', 'name email phone isActive')
      .populate('department', 'name code');

    const childrenWithStats = await Promise.all(
      students.map(async (st) => {
        const risk = await AcademicRisk.findOne({ student: st._id });
        return {
          ...st.toObject(),
          risk: risk || null,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: childrenWithStats.length,
      children: childrenWithStats,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all parents list
// @route   GET /api/students/parents/list
// @access  Private (Admin, Faculty)
export const getParentsList = async (req, res, next) => {
  try {
    const parents = await Parent.find()
      .populate('user', 'name email phone isActive')
      .populate({
        path: 'students',
        populate: [
          { path: 'user', select: 'name email' },
          { path: 'department', select: 'name code' },
        ],
      });

    res.status(200).json({
      success: true,
      count: parents.length,
      parents: parents.filter((p) => p.user && p.user.isActive),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new parent account and optionally link student
// @route   POST /api/students/parents
// @access  Private (Admin)
export const createParent = async (req, res, next) => {
  try {
    const { name, email, phone, password, relationship, occupation, address, studentId } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Parent name and valid email are required.',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user account with this email address already exists.',
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password || 'Password@123',
      role: 'parent',
      phone: phone || '',
    });

    const parent = await Parent.create({
      user: user._id,
      relationship: relationship || 'Guardian',
      occupation: occupation || '',
      address: address || '',
      students: studentId ? [studentId] : [],
    });

    if (studentId) {
      await Student.findByIdAndUpdate(studentId, {
        $addToSet: { parents: parent._id },
      });
    }

    const populatedParent = await Parent.findById(parent._id)
      .populate('user', 'name email phone isActive')
      .populate({
        path: 'students',
        populate: [
          { path: 'user', select: 'name email' },
          { path: 'department', select: 'name code' },
        ],
      });

    res.status(201).json({
      success: true,
      message: 'Parent account created successfully.',
      parent: populatedParent,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Link an existing student to a parent
// @route   POST /api/students/parents/link
// @access  Private (Admin)
export const linkStudentToParent = async (req, res, next) => {
  try {
    const { parentId, studentId } = req.body;

    if (!parentId || !studentId) {
      return res.status(400).json({
        success: false,
        message: 'Parent ID and Student ID are both required.',
      });
    }

    const parent = await Parent.findById(parentId);
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent record not found.' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    await Parent.findByIdAndUpdate(parentId, {
      $addToSet: { students: student._id },
    });

    await Student.findByIdAndUpdate(studentId, {
      $addToSet: { parents: parent._id },
    });

    const updatedParent = await Parent.findById(parentId)
      .populate('user', 'name email phone isActive')
      .populate({
        path: 'students',
        populate: [
          { path: 'user', select: 'name email' },
          { path: 'department', select: 'name code' },
        ],
      });

    res.status(200).json({
      success: true,
      message: 'Student ward linked to parent successfully.',
      parent: updatedParent,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Unlink a student from a parent
// @route   POST /api/students/parents/unlink
// @access  Private (Admin)
export const unlinkStudentFromParent = async (req, res, next) => {
  try {
    const { parentId, studentId } = req.body;

    await Parent.findByIdAndUpdate(parentId, {
      $pull: { students: studentId },
    });

    await Student.findByIdAndUpdate(studentId, {
      $pull: { parents: parentId },
    });

    res.status(200).json({
      success: true,
      message: 'Student ward unlinked from parent successfully.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Deactivate parent account
// @route   DELETE /api/students/parents/:id
// @access  Private (Admin)
export const deleteParent = async (req, res, next) => {
  try {
    const parent = await Parent.findById(req.params.id);
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent record not found.' });
    }

    await User.findByIdAndUpdate(parent.user, { isActive: false });

    res.status(200).json({
      success: true,
      message: 'Parent profile deactivated successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Validate phone number with country code (e.g., +91 9876543210, +1-555-0202)
 */
export const validatePhoneWithCountryCode = (phone) => {
  if (!phone || typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  if (!trimmed.startsWith('+')) return false;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return false;
  return /^\+[1-9][0-9\s-]{6,16}$/.test(trimmed);
};

/**
 * Validate email format if provided (optional field)
 */
export const validateOptionalEmail = (email) => {
  if (!email || !email.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

// @desc    Get parent contact details for student
// @route   GET /api/students/:id/parent-contact
// @access  Private (Faculty, Admin)
export const getStudentParentContact = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('user', 'name email phone')
      .populate('department', 'name code')
      .populate({
        path: 'parents',
        populate: { path: 'user', select: 'name email phone' },
      });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    // Default or populate parent contact details
    let contactInfo = student.parentContact || {};
    if (!contactInfo.name && student.parents && student.parents.length > 0) {
      const p = student.parents[0];
      contactInfo = {
        name: p.user?.name || '',
        relationship: p.relationship || 'Parent / Guardian',
        phone: p.user?.phone || p.alternatePhone || '',
        email: p.user?.email || '',
        preferredLanguage: p.notificationLanguagePreference || 'en',
        preferredMethod: p.preferredNotificationMethod || 'Automatic',
        consentStatus: p.consentStatus || 'Consented',
        consentDate: p.consentDate || new Date(),
        notes: '',
        lastNotifiedAt: student.parentContact?.lastNotifiedAt || null,
      };
    }

    res.status(200).json({
      success: true,
      student: {
        _id: student._id,
        name: student.user?.name || '',
        rollNumber: student.rollNumber,
        department: student.department,
        semester: student.semester,
        section: student.section,
        parentContact: contactInfo,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update parent contact and communication preferences for student
// @route   PUT /api/students/:id/parent-contact
// @access  Private (Faculty, Admin)
export const updateStudentParentContact = async (req, res, next) => {
  try {
    const {
      name,
      relationship = 'Parent / Guardian',
      phone,
      email,
      preferredLanguage = 'en',
      preferredMethod = 'Automatic',
      consentStatus = 'Consented',
      notes = '',
    } = req.body;

    // 1. Validation: Phone number is required and must include country code
    if (!phone || !phone.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Parent mobile number with country code is required (e.g., +91 9876543210).',
      });
    }

    if (!validatePhoneWithCountryCode(phone)) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid mobile number format. Please provide a valid phone number with country code (e.g., +91 9876543210, +1 555-0199).',
      });
    }

    // 2. Validation: Email is optional, but if provided must be valid
    if (email && email.trim() && !validateOptionalEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format. Please enter a valid email or leave the field blank.',
      });
    }

    // 3. Validation: Enums
    const allowedLangs = ['en', 'ta', 'hi'];
    if (!allowedLangs.includes(preferredLanguage)) {
      return res.status(400).json({
        success: false,
        message: 'Preferred language must be English (en), Tamil (ta), or Hindi (hi).',
      });
    }

    const allowedMethods = ['Automatic', 'SMS', 'Email', 'Voice Call'];
    if (!allowedMethods.includes(preferredMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Preferred notification method must be Automatic, SMS, Email, or Voice Call.',
      });
    }

    const allowedConsents = ['Consented', 'Opted Out', 'Pending'];
    if (!allowedConsents.includes(consentStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Consent status must be Consented, Opted Out, or Pending.',
      });
    }

    const student = await Student.findById(req.params.id)
      .populate('user', 'name email rollNumber')
      .populate('department', 'name code')
      .populate({
        path: 'parents',
        populate: { path: 'user' },
      });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    // 4. Update parentContact on Student model
    const cleanedPhone = phone.trim();
    const cleanedEmail = email ? email.toLowerCase().trim() : '';
    const cleanedName = name ? name.trim() : student.parentContact?.name || 'Parent / Guardian';

    student.parentContact = {
      name: cleanedName,
      relationship,
      phone: cleanedPhone,
      email: cleanedEmail,
      preferredLanguage,
      preferredMethod,
      consentStatus,
      consentDate: new Date(),
      notes: notes ? notes.trim() : '',
      lastNotifiedAt: student.parentContact?.lastNotifiedAt || null,
    };

    await student.save();

    // 5. If a linked Parent document exists, synchronize contact and preferences
    if (student.parents && student.parents.length > 0) {
      const parentDoc = await Parent.findById(student.parents[0]);
      if (parentDoc) {
        parentDoc.relationship = relationship;
        parentDoc.notificationLanguagePreference = preferredLanguage;
        parentDoc.preferredNotificationMethod = preferredMethod;
        parentDoc.consentStatus = consentStatus;
        parentDoc.consentDate = new Date();
        await parentDoc.save();

        if (parentDoc.user) {
          const userUpdate = {
            phone: cleanedPhone,
            notificationLanguagePreference: preferredLanguage,
          };
          if (cleanedName) userUpdate.name = cleanedName;
          if (cleanedEmail) userUpdate.email = cleanedEmail;
          await User.findByIdAndUpdate(parentDoc.user, userUpdate);
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Parent contact details updated successfully for ${student.user?.name || student.rollNumber}.`,
      student: {
        _id: student._id,
        name: student.user?.name || '',
        rollNumber: student.rollNumber,
        department: student.department,
        parentContact: student.parentContact,
      },
    });
  } catch (error) {
    next(error);
  }
};

