import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from './src/models/User.js';
import Department from './src/models/Department.js';
import Subject from './src/models/Subject.js';
import Faculty from './src/models/Faculty.js';
import Student from './src/models/Student.js';
import Parent from './src/models/Parent.js';
import AcademicRisk from './src/models/AcademicRisk.js';
import {
  createStudent,
  getStudents,
  getSubjectsList,
  createParent,
  linkStudentToParent,
  unlinkStudentFromParent,
  getParentsList,
  deleteStudent,
  deleteParent,
} from './src/controllers/studentController.js';
import {
  createFaculty,
  getFaculty,
  deleteFaculty,
} from './src/controllers/facultyController.js';
import {
  getDepartments,
  createDepartment,
  createSubject,
  deleteSubject,
} from './src/controllers/departmentController.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

// Mock Express response helper
function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING STUDENT, FACULTY, PARENT & DEPARTMENT TESTS');
  console.log('======================================================\n');

  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);

  try {
    // 1. Create Department
    console.log('--- 1. Department & Curriculum API ---');
    const reqCreateDept = {
      body: {
        name: 'Computer Science & Engineering',
        code: 'CSE',
        description: 'Department of Computer Science',
      },
    };
    const resCreateDept = mockRes();
    await createDepartment(reqCreateDept, resCreateDept, (err) => { throw err; });
    assert(resCreateDept.statusCode === 201, 'Department created with HTTP 201');
    assert(resCreateDept.body.department.code === 'CSE', 'Department code is CSE');
    const deptId = resCreateDept.body.department._id;

    // 2. Create Subject in Department
    const reqCreateSub = {
      body: {
        name: 'Data Structures and Algorithms',
        code: 'CS201',
        department: deptId,
        semester: 3,
        credits: 4,
      },
    };
    const resCreateSub = mockRes();
    await createSubject(reqCreateSub, resCreateSub, (err) => { throw err; });
    assert(resCreateSub.statusCode === 201, 'Subject created with HTTP 201');
    assert(resCreateSub.body.subject.code === 'CS201', 'Subject code matches CS201');
    const subId = resCreateSub.body.subject._id;

    // 3. Get Departments with stats
    const resGetDepts = mockRes();
    await getDepartments({ query: {} }, resGetDepts, (err) => { throw err; });
    assert(resGetDepts.statusCode === 200, 'getDepartments returns HTTP 200');
    assert(resGetDepts.body.departments.length === 1, 'Contains 1 department');
    assert(resGetDepts.body.departments[0].subjects.length === 1, 'Department contains 1 curriculum course');

    // 4. Create Student
    console.log('\n--- 2. Student Enrollment & Academic Risk API ---');
    const reqCreateStudent = {
      body: {
        name: 'Aarav Sharma',
        email: 'aarav.sharma@saepcs.edu',
        rollNumber: 'CS2026-001',
        department: deptId,
        semester: 3,
        section: 'A',
        parentName: 'Robert Sharma',
        parentEmail: 'robert.sharma@family.edu',
        parentPhone: '+91 98765 43210',
      },
    };
    const resCreateStudent = mockRes();
    await createStudent(reqCreateStudent, resCreateStudent, (err) => { throw err; });
    assert(resCreateStudent.statusCode === 201, 'Student created with HTTP 201');
    assert(resCreateStudent.body.student.rollNumber === 'CS2026-001', 'Student roll number matches CS2026-001');
    assert(resCreateStudent.body.student.risk !== null, 'Initial AcademicRisk initialized without error');
    assert(resCreateStudent.body.student.risk.severity === 'Low', 'Initial risk severity is Low');
    const studentId = resCreateStudent.body.student._id;

    // 5. Get Students List
    const resGetStudents = mockRes();
    await getStudents({ query: {} }, resGetStudents, (err) => { throw err; });
    assert(resGetStudents.statusCode === 200, 'getStudents returns HTTP 200');
    assert(resGetStudents.body.students.length === 1, 'Students count is 1');
    assert(resGetStudents.body.data.length === 1, 'Provides backward-compatible data array');

    // 6. Create Faculty
    console.log('\n--- 3. Faculty Management API ---');
    const reqCreateFaculty = {
      body: {
        name: 'Dr. Alan Turing',
        email: 'alan.turing@saepcs.edu',
        facultyId: 'FAC-CSE-001',
        department: deptId,
        designation: 'Professor',
        specialization: 'Theoretical Computer Science',
      },
    };
    const resCreateFaculty = mockRes();
    await createFaculty(reqCreateFaculty, resCreateFaculty, (err) => { throw err; });
    assert(resCreateFaculty.statusCode === 201, 'Faculty created with HTTP 201');
    assert(resCreateFaculty.body.faculty.facultyId === 'FAC-CSE-001', 'Faculty ID matches FAC-CSE-001');
    const facultyDocId = resCreateFaculty.body.faculty._id;

    // 7. Get Faculty List
    const resGetFaculty = mockRes();
    await getFaculty({ query: {} }, resGetFaculty, (err) => { throw err; });
    assert(resGetFaculty.statusCode === 200, 'getFaculty returns HTTP 200');
    assert(resGetFaculty.body.faculty.length === 1, 'Faculty count is 1');
    assert(resGetFaculty.body.faculty[0].designation === 'Professor', 'Designation is Professor');

    // 8. Parent Management & Linking
    console.log('\n--- 4. Parent Management & Ward Linking API ---');
    const reqCreateParent = {
      body: {
        name: 'Meera Patel',
        email: 'meera.patel@saepcs.edu',
        phone: '+91 98765 11223',
        relationship: 'Mother',
        studentId: studentId,
      },
    };
    const resCreateParent = mockRes();
    await createParent(reqCreateParent, resCreateParent, (err) => { throw err; });
    assert(resCreateParent.statusCode === 201, 'Parent created with HTTP 201');
    assert(resCreateParent.body.parent.relationship === 'Mother', 'Relationship is Mother');
    assert(resCreateParent.body.parent.students.length === 1, 'Initial ward linked at creation');
    const parentId = resCreateParent.body.parent._id;

    // 9. Get Parents List
    const resGetParents = mockRes();
    await getParentsList({}, resGetParents, (err) => { throw err; });
    assert(resGetParents.statusCode === 200, 'getParentsList returns HTTP 200');
    assert(resGetParents.body.parents.length >= 1, 'Parent records found');

    // 10. Unlink and Link Ward
    const reqUnlink = { body: { parentId, studentId } };
    const resUnlink = mockRes();
    await unlinkStudentFromParent(reqUnlink, resUnlink, (err) => { throw err; });
    assert(resUnlink.statusCode === 200, 'Student unlinked with HTTP 200');

    const reqLink = { body: { parentId, studentId } };
    const resLink = mockRes();
    await linkStudentToParent(reqLink, resLink, (err) => { throw err; });
    assert(resLink.statusCode === 200, 'Student re-linked with HTTP 200');
    assert(resLink.body.parent.students.length === 1, 'Ward listed in updated parent');

    // 11. Subjects List query
    console.log('\n--- 5. Subjects List API ---');
    const resGetSubs = mockRes();
    await getSubjectsList({ query: {} }, resGetSubs, (err) => { throw err; });
    assert(resGetSubs.statusCode === 200, 'getSubjectsList returns HTTP 200');
    assert(resGetSubs.body.subjects.length === 1, 'Subjects list contains created course');

    console.log(`\n======================================================`);
    console.log(`📊 INTEGRATION TEST RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log(`======================================================\n`);

  } finally {
    await mongoose.disconnect();
    await mongod.stop();
  }

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
