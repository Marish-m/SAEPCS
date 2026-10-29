import User from '../models/User.js';
import Faculty from '../models/Faculty.js';
import Department from '../models/Department.js';
import Subject from '../models/Subject.js';

// @desc    Get all faculty members
// @route   GET /api/faculty
// @access  Private (Admin, Faculty)
export const getFaculty = async (req, res, next) => {
  try {
    const { department, search } = req.query;
    const query = {};

    if (department) {
      if (department.match(/^[0-9a-fA-F]{24}$/)) {
        query.department = department;
      } else {
        const d = await Department.findOne({
          $or: [{ code: department.toUpperCase() }, { name: department }],
        });
        if (d) query.department = d._id;
      }
    }

    let facultyList = await Faculty.find(query)
      .populate('user', 'name email phone role isActive')
      .populate('department', 'name code')
      .populate('subjectsTaught', 'name code semester credits');

    // Filter active users
    facultyList = facultyList.filter((f) => f.user && f.user.isActive);

    if (search) {
      const sLower = search.toLowerCase();
      facultyList = facultyList.filter(
        (f) =>
          f.user?.name?.toLowerCase().includes(sLower) ||
          f.user?.email?.toLowerCase().includes(sLower) ||
          f.employeeId?.toLowerCase().includes(sLower)
      );
    }

    // Format for frontend presentation
    const formatted = facultyList.map((f) => ({
      _id: f._id,
      name: f.user?.name || 'Faculty Member',
      email: f.user?.email || '',
      phone: f.user?.phone || '',
      employeeId: f.employeeId,
      department: f.department?.name || 'Computer Science & Engineering',
      departmentCode: f.department?.code || 'CSE',
      departmentId: f.department?._id,
      designation: f.designation || 'Assistant Professor',
      qualification: f.qualification || 'M.Tech / Ph.D.',
      subjects: f.subjectsTaught?.map((s) => s.name) || [],
      classesAssigned: f.subjectsTaught?.length || 2,
      createdAt: f.createdAt,
    }));

    res.status(200).json({
      success: true,
      count: formatted.length,
      faculty: formatted,
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get faculty details by ID
// @route   GET /api/faculty/:id
// @access  Private
export const getFacultyById = async (req, res, next) => {
  try {
    const faculty = await Faculty.findById(req.params.id)
      .populate('user', 'name email phone role isActive')
      .populate('department', 'name code')
      .populate('subjectsTaught', 'name code semester credits');

    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty record not found.' });
    }

    res.status(200).json({
      success: true,
      faculty,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new faculty member
// @route   POST /api/faculty
// @access  Private (Admin)
export const createFaculty = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      employeeId,
      department,
      designation,
      qualification,
      subjects,
    } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'Name and email are required fields.',
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user account with this email already exists.',
      });
    }

    // Auto-generate employeeId if not given
    let empId = employeeId || req.body.facultyId;
    if (!empId) {
      empId = `FAC-${Math.floor(100 + Math.random() * 900)}`;
    }
    const existingEmp = await Faculty.findOne({ employeeId: empId.toUpperCase().trim() });
    if (existingEmp) {
      empId = `FAC-${Date.now().toString().slice(-4)}`;
    }

    // Resolve Department
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

    // Resolve Subjects taught
    let subjectIds = [];
    if (subjects) {
      if (Array.isArray(subjects)) {
        for (const s of subjects) {
          if (s.match(/^[0-9a-fA-F]{24}$/)) {
            subjectIds.push(s);
          } else {
            const subDoc = await Subject.findOne({ name: s.trim() });
            if (subDoc) subjectIds.push(subDoc._id);
          }
        }
      } else if (typeof subjects === 'string') {
        const subNames = subjects.split(',').map((s) => s.trim());
        for (const sName of subNames) {
          const subDoc = await Subject.findOne({ name: sName });
          if (subDoc) subjectIds.push(subDoc._id);
        }
      }
    }

    // If still empty, assign subjects from department
    if (subjectIds.length === 0 && deptId) {
      const defaultSubs = await Subject.find({ department: deptId }).limit(2);
      subjectIds = defaultSubs.map((s) => s._id);
    }

    // Create User account
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password || 'Password@123',
      role: 'faculty',
      phone: phone || '+1-555-0100',
    });

    // Create Faculty profile
    const faculty = await Faculty.create({
      user: user._id,
      employeeId: empId.toUpperCase().trim(),
      department: deptId,
      designation: designation || 'Assistant Professor',
      qualification: qualification || 'M.Tech / Ph.D.',
      subjectsTaught: subjectIds,
    });

    const populated = await Faculty.findById(faculty._id)
      .populate('user', 'name email phone role isActive')
      .populate('department', 'name code')
      .populate('subjectsTaught', 'name code semester');

    const formatted = {
      _id: populated._id,
      name: populated.user.name,
      email: populated.user.email,
      phone: populated.user.phone,
      employeeId: populated.employeeId,
      facultyId: populated.employeeId,
      department: populated.department?.name || 'Computer Science & Engineering',
      departmentCode: populated.department?.code || 'CSE',
      designation: populated.designation,
      qualification: populated.qualification,
      subjects: populated.subjectsTaught?.map((s) => s.name) || [],
      classesAssigned: populated.subjectsTaught?.length || 2,
    };

    res.status(201).json({
      success: true,
      message: 'Faculty member registered successfully.',
      faculty: formatted,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update faculty details
// @route   PUT /api/faculty/:id
// @access  Private (Admin)
export const updateFaculty = async (req, res, next) => {
  try {
    const { name, phone, designation, qualification, department } = req.body;
    const faculty = await Faculty.findById(req.params.id);

    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty record not found.' });
    }

    if (name || phone !== undefined) {
      await User.findByIdAndUpdate(faculty.user, {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
      });
    }

    if (designation) faculty.designation = designation;
    if (qualification) faculty.qualification = qualification;
    if (department && department.match(/^[0-9a-fA-F]{24}$/)) faculty.department = department;

    await faculty.save();

    res.status(200).json({
      success: true,
      message: 'Faculty profile updated successfully.',
      faculty,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete faculty (Soft deactivate)
// @route   DELETE /api/faculty/:id
// @access  Private (Admin)
export const deleteFaculty = async (req, res, next) => {
  try {
    const faculty = await Faculty.findById(req.params.id);
    if (!faculty) {
      return res.status(404).json({ success: false, message: 'Faculty not found.' });
    }

    await User.findByIdAndUpdate(faculty.user, { isActive: false });

    res.status(200).json({
      success: true,
      message: 'Faculty account deactivated successfully.',
    });
  } catch (error) {
    next(error);
  }
};
