import Department from '../models/Department.js';
import Subject from '../models/Subject.js';
import Student from '../models/Student.js';
import Faculty from '../models/Faculty.js';

// @desc    Get all departments with subjects and stats
// @route   GET /api/departments
// @access  Private
export const getDepartments = async (req, res, next) => {
  try {
    const departments = await Department.find()
      .populate({
        path: 'hod',
        populate: { path: 'user', select: 'name email phone' },
      })
      .sort({ code: 1 });

    const departmentsWithDetails = await Promise.all(
      departments.map(async (dept) => {
        const [subjects, totalStudents, totalFaculty] = await Promise.all([
          Subject.find({ department: dept._id }).sort({ semester: 1, code: 1 }),
          Student.countDocuments({ department: dept._id }),
          Faculty.countDocuments({ department: dept._id }),
        ]);

        return {
          _id: dept._id,
          id: dept._id,
          name: dept.name,
          code: dept.code,
          description: dept.description,
          hod: dept.hod?.user?.name || 'Assigned Faculty HOD',
          hodDetails: dept.hod,
          totalStudents,
          totalFaculty,
          subjects: subjects.map((sub) => ({
            _id: sub._id,
            id: sub._id,
            name: sub.name,
            code: sub.code,
            semester: sub.semester,
            credits: sub.credits,
            syllabusSummary: sub.syllabusSummary,
            department: dept._id,
          })),
        };
      })
    );

    res.status(200).json({
      success: true,
      count: departmentsWithDetails.length,
      departments: departmentsWithDetails,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new department
// @route   POST /api/departments
// @access  Private (Admin)
export const createDepartment = async (req, res, next) => {
  try {
    const { name, code, description, hod } = req.body;

    if (!name || !code) {
      return res.status(400).json({
        success: false,
        message: 'Department name and unique code are required.',
      });
    }

    const existingCode = await Department.findOne({ code: code.toUpperCase().trim() });
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: `Department code ${code.toUpperCase()} is already in use.`,
      });
    }

    const dept = await Department.create({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      description: description || '',
      hod: hod || null,
    });

    res.status(201).json({
      success: true,
      message: 'Department created successfully.',
      department: dept,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new subject / course in a department
// @route   POST /api/departments/subjects
// @access  Private (Admin, Faculty)
export const createSubject = async (req, res, next) => {
  try {
    const { name, code, department, semester, credits, syllabusSummary } = req.body;

    if (!name || !code || !department) {
      return res.status(400).json({
        success: false,
        message: 'Course title, course code, and department reference are mandatory.',
      });
    }

    const existingSubject = await Subject.findOne({ code: code.toUpperCase().trim() });
    if (existingSubject) {
      return res.status(400).json({
        success: false,
        message: `Subject code ${code.toUpperCase()} already exists.`,
      });
    }

    // Resolve department ID if passed as code
    let deptId = department;
    if (!department.toString().match(/^[0-9a-fA-F]{24}$/)) {
      const d = await Department.findOne({
        $or: [{ code: department.toUpperCase() }, { name: department }],
      });
      if (!d) {
        return res.status(404).json({ success: false, message: 'Referenced department not found.' });
      }
      deptId = d._id;
    }

    const newSub = await Subject.create({
      name: name.trim(),
      code: code.toUpperCase().trim(),
      department: deptId,
      semester: semester ? Number(semester) : 1,
      credits: credits ? Number(credits) : 3,
      syllabusSummary: syllabusSummary || '',
    });

    const populated = await Subject.findById(newSub._id).populate('department', 'name code');

    res.status(201).json({
      success: true,
      message: 'Course registered to curriculum successfully.',
      subject: populated,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a subject / course
// @route   DELETE /api/departments/subjects/:id
// @access  Private (Admin)
export const deleteSubject = async (req, res, next) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) {
      return res.status(404).json({ success: false, message: 'Subject not found.' });
    }
    res.status(200).json({
      success: true,
      message: 'Subject removed from curriculum.',
    });
  } catch (error) {
    next(error);
  }
};
