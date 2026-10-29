import User from '../models/User.js';
import Department from '../models/Department.js';
import Subject from '../models/Subject.js';
import Faculty from '../models/Faculty.js';
import Student from '../models/Student.js';
import Parent from '../models/Parent.js';
import Attendance from '../models/Attendance.js';
import Assessment from '../models/Assessment.js';
import InternalMark from '../models/InternalMark.js';
import Assignment from '../models/Assignment.js';
import AssignmentSubmission from '../models/AssignmentSubmission.js';
import LeaveRequest from '../models/LeaveRequest.js';
import AcademicRisk from '../models/AcademicRisk.js';
import Notification from '../models/Notification.js';
import SystemConfig from '../models/SystemConfig.js';
import { calculateStudentRisk } from '../services/riskAnalysisService.js';

export const seedDatabase = async () => {
  try {
    const existingUsers = await User.countDocuments();
    if (existingUsers > 0) {
      console.log(`[Seed Service] Database contains ${existingUsers} users. Skipping auto-seed.`);
      return;
    }

    console.log('[Seed Service] Seeding development database...');

    // 0. Create System Risk Configuration
    await SystemConfig.create({
      key: 'risk_policy',
      attendanceThreshold: 75,
      marksThreshold: 50,
      description: 'University Academic Risk Policy: Minimum 75% attendance and 50% internal marks benchmark.',
    });

    // 1. Create Departments
    const cseDept = await Department.create({
      name: 'Computer Science & Engineering',
      code: 'CSE',
      description: 'Department of Computer Science and Engineering',
    });

    const itDept = await Department.create({
      name: 'Information Technology',
      code: 'IT',
      description: 'Department of Information Technology',
    });

    // 2. Create Subjects
    const subjDSA = await Subject.create({
      name: 'Data Structures & Algorithms',
      code: 'CS401',
      department: cseDept._id,
      semester: 4,
      credits: 4,
    });

    const subjML = await Subject.create({
      name: 'Machine Learning',
      code: 'CS402',
      department: cseDept._id,
      semester: 4,
      credits: 4,
    });

    const subjOS = await Subject.create({
      name: 'Operating Systems',
      code: 'CS403',
      department: cseDept._id,
      semester: 4,
      credits: 3,
    });

    const subjDBMS = await Subject.create({
      name: 'Database Systems',
      code: 'CS404',
      department: cseDept._id,
      semester: 4,
      credits: 3,
    });

    // 3. Create Admin User
    const adminUser = await User.create({
      name: 'System Administrator',
      email: 'admin@saepcs.edu',
      password: 'Password@123',
      role: 'admin',
      phone: '+1-800-555-0199',
    });

    // 4. Create Faculty User & Profile
    const facultyUser1 = await User.create({
      name: 'Dr. Alan Turing',
      email: 'faculty@saepcs.edu',
      password: 'Password@123',
      role: 'faculty',
      phone: '+1-555-0101',
    });

    const facultyProfile1 = await Faculty.create({
      user: facultyUser1._id,
      employeeId: 'FAC-CSE-001',
      department: cseDept._id,
      designation: 'Professor & HOD',
      qualification: 'Ph.D. Computer Science',
      subjectsTaught: [subjDSA._id, subjML._id, subjOS._id, subjDBMS._id],
    });

    // Assign HOD to CSE Department
    cseDept.hod = facultyProfile1._id;
    await cseDept.save();

    // 5. Create Parent User & Profile
    const parentUser1 = await User.create({
      name: 'Robert Sharma',
      email: 'parent@saepcs.edu',
      password: 'Password@123',
      role: 'parent',
      phone: '+1-555-0201',
    });

    const parentProfile1 = await Parent.create({
      user: parentUser1._id,
      relationship: 'Father',
      occupation: 'Software Engineer',
      address: '42 Academic Boulevard, Tech Park',
      students: [],
    });

    const parentUser2 = await User.create({
      name: 'Meera Patel',
      email: 'meera.patel@saepcs.edu',
      password: 'Password@123',
      role: 'parent',
      phone: '+1-555-0202',
    });

    const parentProfile2 = await Parent.create({
      user: parentUser2._id,
      relationship: 'Mother',
      occupation: 'Chartered Accountant',
      address: '18 Metro Crescent',
      students: [],
    });

    // 6. Create Student Users & Profiles
    // Student 1: Aarav Sharma (Good standing, high attendance)
    const studentUser1 = await User.create({
      name: 'Aarav Sharma',
      email: 'student@saepcs.edu',
      password: 'Password@123',
      role: 'student',
      phone: '+1-555-0301',
    });

    const studentProfile1 = await Student.create({
      user: studentUser1._id,
      rollNumber: 'CS2026-001',
      department: cseDept._id,
      semester: 4,
      section: 'A',
      admissionYear: 2024,
      parents: [parentProfile1._id],
      facultyAdvisor: facultyProfile1._id,
      parentContact: {
        name: 'Rajesh Sharma',
        relationship: 'Father',
        phone: '+91 98765 43210',
        email: 'parent@saepcs.edu',
        preferredLanguage: 'en',
        preferredMethod: 'Automatic',
        consentStatus: 'Consented',
        consentDate: new Date(),
        notes: 'Primary contact for academic notifications.',
      },
    });

    // Student 2: Rohan Patel (Critical Risk: low attendance & marks)
    const studentUser2 = await User.create({
      name: 'Rohan Patel',
      email: 'rohan.patel@saepcs.edu',
      password: 'Password@123',
      role: 'student',
      phone: '+1-555-0302',
    });

    const studentProfile2 = await Student.create({
      user: studentUser2._id,
      rollNumber: 'CS2026-002',
      department: cseDept._id,
      semester: 4,
      section: 'A',
      admissionYear: 2024,
      parents: [parentProfile2._id],
      facultyAdvisor: facultyProfile1._id,
      parentContact: {
        name: 'Meera Patel',
        relationship: 'Mother',
        phone: '+91 98401 23456',
        email: 'meera.patel@saepcs.edu',
        preferredLanguage: 'ta',
        preferredMethod: 'Voice Call',
        consentStatus: 'Consented',
        consentDate: new Date(),
        notes: 'Prefers spoken Tamil voice alerts for critical academic notices.',
      },
    });

    // Student 3: Priya Nair (Boundary Case: near 75% threshold ~76%)
    const studentUser3 = await User.create({
      name: 'Priya Nair',
      email: 'priya.nair@saepcs.edu',
      password: 'Password@123',
      role: 'student',
      phone: '+1-555-0303',
    });

    const studentProfile3 = await Student.create({
      user: studentUser3._id,
      rollNumber: 'CS2026-003',
      department: cseDept._id,
      semester: 4,
      section: 'A',
      admissionYear: 2024,
      parents: [parentProfile1._id],
      facultyAdvisor: facultyProfile1._id,
      parentContact: {
        name: 'Suresh Nair',
        relationship: 'Guardian',
        phone: '+91 94440 98765',
        email: '',
        preferredLanguage: 'ta',
        preferredMethod: 'SMS',
        consentStatus: 'Consented',
        consentDate: new Date(),
        notes: 'Mobile only; no email address. Needs high-accessibility SMS/Voice alerts.',
      },
    });

    // Link students to parents
    parentProfile1.students.push(studentProfile1._id, studentProfile3._id);
    await parentProfile1.save();

    parentProfile2.students.push(studentProfile2._id);
    await parentProfile2.save();

    // 7. Seed Attendance Records with normalized dateStr and unique compound keys
    const attendanceRecords = [];
    const now = new Date();
    const subjects = [subjDSA, subjML, subjOS, subjDBMS];

    for (let day = 1; day <= 20; day++) {
      const d = new Date(now);
      d.setDate(d.getDate() - (20 - day));
      if (d.getDay() === 0 || d.getDay() === 6) continue;

      const dateStr = d.toISOString().split('T')[0];

      subjects.forEach((subj) => {
        // Student 1: 95% attendance (1 unexcused absence, 1 on duty)
        let s1Status = 'Present';
        if (day === 15) s1Status = 'Absent';
        if (day === 10) s1Status = 'On Duty';

        attendanceRecords.push({
          student: studentProfile1._id,
          subject: subj._id,
          faculty: facultyProfile1._id,
          date: d,
          dateStr,
          status: s1Status,
          semester: 4,
          section: 'A',
        });

        // Student 2: 55% attendance (Critical Shortage)
        let s2Status = 'Present';
        if (day % 2 === 0) s2Status = 'Absent';
        if (day === 7) s2Status = 'Late';

        attendanceRecords.push({
          student: studentProfile2._id,
          subject: subj._id,
          faculty: facultyProfile1._id,
          date: d,
          dateStr,
          status: s2Status,
          semester: 4,
          section: 'A',
          remarks: s2Status === 'Absent' ? 'Unexcused Absence' : '',
        });

        // Student 3: Boundary Case (~73-76% attendance)
        let s3Status = 'Present';
        if (day % 4 === 0) s3Status = 'Absent';
        attendanceRecords.push({
          student: studentProfile3._id,
          subject: subj._id,
          faculty: facultyProfile1._id,
          date: d,
          dateStr,
          status: s3Status,
          semester: 4,
          section: 'A',
        });
      });
    }

    // Include an audit trail entry on one of Student 1's records for demonstration
    if (attendanceRecords.length > 0) {
      attendanceRecords[0].auditTrail = [
        {
          previousStatus: 'Absent',
          newStatus: 'Present',
          previousRemarks: 'Marked absent by clerical oversight',
          newRemarks: 'Corrected: Verified student attendance slip',
          correctedBy: facultyUser1._id,
          correctedByName: 'Dr. Alan Turing',
          reason: 'Student present in lab session; corrected upon verification of attendance log.',
          correctedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
      ];
    }

    await Attendance.insertMany(attendanceRecords);

    // 8. Seed Assessments & Internal Marks
    const assessmentRecords = [];
    const assessmentTypes = ['Internal 1', 'Internal 2'];

    subjects.forEach((subj) => {
      assessmentTypes.forEach((type, idx) => {
        assessmentRecords.push({
          title: `${subj.code} ${type}`,
          subject: subj._id,
          faculty: facultyProfile1._id,
          assessmentType: type,
          maxMarks: 50,
          date: new Date(Date.now() - (15 - idx * 7) * 24 * 60 * 60 * 1000),
          semester: 4,
          academicYear: '2025-2026',
          description: `Continuous internal assessment evaluation for ${subj.name}`,
        });
      });
    });

    const createdAssessments = await Assessment.insertMany(assessmentRecords);

    const marksRecords = [];
    createdAssessments.forEach((ass) => {
      // Student 1 (High marks: 44-48 / 50 -> 88% - 96%)
      marksRecords.push({
        assessment: ass._id,
        student: studentProfile1._id,
        subject: ass.subject,
        faculty: facultyProfile1._id,
        assessmentType: ass.assessmentType,
        maxMarks: ass.maxMarks,
        obtainedMarks: 46,
        percentage: 92,
        semester: 4,
        academicYear: '2025-2026',
        remarks: 'Excellent analytical problem solving',
      });

      // Student 2 (Low marks: 21 / 50 -> 42% -> Remedial Required)
      marksRecords.push({
        assessment: ass._id,
        student: studentProfile2._id,
        subject: ass.subject,
        faculty: facultyProfile1._id,
        assessmentType: ass.assessmentType,
        maxMarks: ass.maxMarks,
        obtainedMarks: 21,
        percentage: 42,
        semester: 4,
        academicYear: '2025-2026',
        remarks: 'Struggling with fundamentals; remedial coaching advised',
      });

      // Student 3 (Average marks: 32 / 50 -> 64%)
      marksRecords.push({
        assessment: ass._id,
        student: studentProfile3._id,
        subject: ass.subject,
        faculty: facultyProfile1._id,
        assessmentType: ass.assessmentType,
        maxMarks: ass.maxMarks,
        obtainedMarks: 32,
        percentage: 64,
        semester: 4,
        academicYear: '2025-2026',
        remarks: 'Satisfactory performance',
      });
    });

    await InternalMark.insertMany(marksRecords);

    // 9. Seed Assignment & Submissions
    const assignment1 = await Assignment.create({
      faculty: facultyProfile1._id,
      subject: subjDSA._id,
      department: cseDept._id,
      semester: 4,
      title: 'Graph Traversal & Dijkstra Implementation',
      description: 'Implement shortest path algorithms with complete edge cost analysis and test suite.',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      maxMarks: 50,
    });

    await AssignmentSubmission.create({
      assignment: assignment1._id,
      student: studentProfile1._id,
      submissionText: 'GitHub link: https://github.com/aarav/dijkstra-algo. Complete test suite included.',
      status: 'Graded',
      obtainedMarks: 48,
      feedback: 'Outstanding implementation and thorough test cases.',
      gradedBy: facultyProfile1._id,
      gradedAt: new Date(),
    });

    // 10. Seed Leave Requests
    await LeaveRequest.create({
      student: studentProfile1._id,
      appliedBy: 'student',
      leaveType: 'Academic/Duty',
      startDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      reason: 'Representing institution at State Level ACM Inter-College Hackathon.',
      status: 'Approved',
      facultyRemarks: 'Verified and approved with on-duty attendance credit.',
      reviewedBy: facultyProfile1._id,
      reviewedAt: new Date(),
    });

    await LeaveRequest.create({
      student: studentProfile2._id,
      appliedBy: 'parent',
      leaveType: 'Medical',
      startDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      reason: 'Viral fever and respiratory illness. Medical certificate submitted.',
      status: 'Pending',
    });

    // 11. Calculate & Seed Real Academic Risk Records from actual attendance & marks
    await calculateStudentRisk(studentProfile1._id);
    await calculateStudentRisk(studentProfile2._id);
    await calculateStudentRisk(studentProfile3._id);

    // 12. Seed Notifications
    await Notification.create({
      recipient: parentUser2._id,
      sender: facultyUser1._id,
      title: 'Urgent Academic Alert: Low Attendance Notice',
      message: 'Dear Parent, Rohan Patel has fallen below the mandatory 75% attendance threshold. Please review the student dashboard and attend the scheduled counselling session.',
      type: 'attendance_alert',
      channel: 'all',
      deliveryStatus: { emailSent: true, smsSent: true },
      isRead: false,
    });

    console.log('[Seed Service] Seed data created successfully for all collections!');
  } catch (err) {
    console.error('[Seed Service Error]:', err);
  }
};

export default seedDatabase;
