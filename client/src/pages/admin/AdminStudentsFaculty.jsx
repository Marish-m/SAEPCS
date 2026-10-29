import React, { useState, useEffect } from 'react';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import RiskBadge from '../../components/common/RiskBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import AlertBanner from '../../components/common/AlertBanner';
import { SAMPLE_STUDENTS, SAMPLE_FACULTY } from '../../data/mockData';
import {
  UserPlus,
  UserCheck,
  Trash2,
  Edit3,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Users,
  GraduationCap,
  Briefcase,
} from 'lucide-react';
import apiService from '../../api/apiService';

const AdminStudentsFaculty = () => {
  const [activeTab, setActiveTab] = useState('students');
  const [students, setStudents] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingFaculty, setLoadingFaculty] = useState(true);

  // Modal States
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isAddFacultyOpen, setIsAddFacultyOpen] = useState(false);
  const [formSuccess, setFormSuccess] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [newStudent, setNewStudent] = useState({
    name: '',
    email: '',
    rollNumber: '',
    department: 'Computer Science & Engineering',
    semester: 4,
    section: 'A',
    parentName: '',
    parentPhone: '',
  });

  const [newFaculty, setNewFaculty] = useState({
    name: '',
    email: '',
    department: 'Computer Science & Engineering',
    designation: 'Assistant Professor',
    qualification: 'M.Tech / Ph.D.',
    subjects: 'Data Structures & Algorithms',
  });

  // Fetch Live Students
  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const res = await apiService.getStudents();
      const list = res.data?.students || res.data?.data || [];
      if (list.length > 0) {
        // Normalize student list for DataTable
        const formatted = list.map((st) => ({
          _id: st._id,
          name: st.user?.name || st.name,
          email: st.user?.email || st.email,
          rollNumber: st.rollNumber,
          department: st.department?.name || st.department || 'CSE',
          semester: st.semester || 4,
          section: st.section || 'A',
          attendance: st.risk?.attendancePercentage ?? st.attendance ?? 85,
          internalMarksAvg: st.risk?.marksAveragePercentage ?? st.internalMarksAvg ?? 75,
          riskLevel: st.risk?.riskLevel || st.riskLevel || 'Low Risk',
          status: st.user?.isActive !== false ? 'Active' : 'Inactive',
        }));
        setStudents(formatted);
      } else {
        setStudents(SAMPLE_STUDENTS);
      }
    } catch (err) {
      console.warn('Using sample students fallback:', err.message);
      setStudents(SAMPLE_STUDENTS);
    } finally {
      setLoadingStudents(false);
    }
  };

  // Fetch Live Faculty
  const fetchFaculty = async () => {
    setLoadingFaculty(true);
    try {
      const res = await apiService.getFaculty();
      const list = res.data?.faculty || res.data?.data || [];
      if (list.length > 0) {
        setFaculty(list);
      } else {
        setFaculty(SAMPLE_FACULTY);
      }
    } catch (err) {
      console.warn('Using sample faculty fallback:', err.message);
      setFaculty(SAMPLE_FACULTY);
    } finally {
      setLoadingFaculty(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    fetchFaculty();
  }, []);

  // 1. Submit Add Student
  const handleAddStudent = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      const res = await apiService.createStudent(newStudent);
      const createdStudent = res.data?.student;

      setFormSuccess('Student enrolled successfully in database!');

      // Add to table
      const formatted = {
        _id: createdStudent?._id || 'std-' + Date.now(),
        name: createdStudent?.user?.name || newStudent.name,
        email: createdStudent?.user?.email || newStudent.email,
        rollNumber: createdStudent?.rollNumber || newStudent.rollNumber,
        department: createdStudent?.department?.name || newStudent.department,
        semester: createdStudent?.semester || newStudent.semester,
        section: createdStudent?.section || newStudent.section,
        attendance: 100,
        internalMarksAvg: 0,
        riskLevel: 'Low Risk',
        status: 'Active',
      };
      setStudents((prev) => [formatted, ...prev]);

      setTimeout(() => {
        setFormSuccess('');
        setIsAddStudentOpen(false);
        setNewStudent({
          name: '',
          email: '',
          rollNumber: '',
          department: 'Computer Science & Engineering',
          semester: 4,
          section: 'A',
          parentName: '',
          parentPhone: '',
        });
      }, 1200);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to add student. Please verify fields.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Submit Add Faculty
  const handleAddFaculty = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');
    setSubmitting(true);

    try {
      const res = await apiService.createFaculty(newFaculty);
      const created = res.data?.faculty || {
        _id: 'fac-' + Date.now(),
        name: newFaculty.name,
        email: newFaculty.email,
        department: newFaculty.department,
        designation: newFaculty.designation,
        subjects: newFaculty.subjects.split(',').map((s) => s.trim()),
        classesAssigned: 2,
      };

      setFormSuccess('Faculty registered successfully in database!');
      setFaculty((prev) => [created, ...prev]);

      setTimeout(() => {
        setFormSuccess('');
        setIsAddFacultyOpen(false);
        setNewFaculty({
          name: '',
          email: '',
          department: 'Computer Science & Engineering',
          designation: 'Assistant Professor',
          qualification: 'M.Tech / Ph.D.',
          subjects: 'Data Structures & Algorithms',
        });
      }, 1200);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to register faculty member.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Student
  const handleDeleteStudent = async (studentId) => {
    if (!window.confirm('Are you sure you want to delete / deactivate this student?')) return;
    try {
      await apiService.deleteStudent(studentId);
    } catch {
      // preview mode
    }
    setStudents((prev) => prev.filter((s) => s._id !== studentId));
  };

  // Delete Faculty
  const handleDeleteFaculty = async (facultyId) => {
    if (!window.confirm('Are you sure you want to deactivate this faculty member?')) return;
    try {
      await apiService.deleteFaculty(facultyId);
    } catch {
      // preview mode
    }
    setFaculty((prev) => prev.filter((f) => f._id !== facultyId));
  };

  // Student Columns
  const studentColumns = [
    {
      key: 'name',
      label: 'Student',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-white">{row.name}</div>
          <div className="text-[11px] text-slate-400">{row.email}</div>
        </div>
      ),
    },
    { key: 'rollNumber', label: 'Roll Number', sortable: true, className: 'font-mono' },
    { key: 'department', label: 'Department', sortable: true },
    {
      key: 'semester',
      label: 'Sem / Sec',
      render: (row) => `Sem ${row.semester} (${row.section || 'A'})`,
    },
    {
      key: 'attendance',
      label: 'Attendance',
      sortable: true,
      render: (row) => (
        <span
          className={`font-bold ${
            (row.attendance || 0) < 75 ? 'text-rose-400' : 'text-emerald-400'
          }`}
        >
          {row.attendance || 0}%
        </span>
      ),
    },
    {
      key: 'riskLevel',
      label: 'Academic Risk',
      render: (row) => <RiskBadge level={row.riskLevel} size="sm" />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDeleteStudent(row._id)}
            className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
            title="Delete Student"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  // Faculty Columns
  const facultyColumns = [
    {
      key: 'name',
      label: 'Faculty Member',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-white">{row.name}</div>
          <div className="text-[11px] text-slate-400">{row.email}</div>
        </div>
      ),
    },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'designation', label: 'Designation', sortable: true },
    {
      key: 'subjects',
      label: 'Courses Assigned',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {Array.isArray(row.subjects) ? (
            row.subjects.map((sub, i) => (
              <span key={i} className="px-2 py-0.5 text-[10px] bg-slate-800 text-slate-300 rounded">
                {sub}
              </span>
            ))
          ) : (
            <span className="text-slate-400 text-xs">{row.subjects}</span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDeleteFaculty(row._id)}
            className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
            title="Deactivate Faculty"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Action Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">
            Institutional Roster Management
          </h2>
          <p className="text-xs text-slate-400">
            Maintain authorized enrollment records for student cohorts and faculty instructors.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'students' ? (
            <button
              onClick={() => {
                setFormError('');
                setFormSuccess('');
                setIsAddStudentOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 active:scale-95 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Enroll New Student</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setFormError('');
                setFormSuccess('');
                setIsAddFacultyOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 active:scale-95 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register New Faculty</span>
            </button>
          )}

          <button
            onClick={() => {
              fetchStudents();
              fetchFaculty();
            }}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Refresh Directory"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 p-1 rounded-2xl bg-slate-900 border border-slate-800 w-fit">
        <button
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'students'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Enrolled Students ({students.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('faculty')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${
            activeTab === 'faculty'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Faculty Directory ({faculty.length})</span>
        </button>
      </div>

      {/* Directory Table */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
        {activeTab === 'students' ? (
          loadingStudents ? (
            <LoadingSpinner text="Loading enrolled student records from database..." />
          ) : (
            <DataTable
              columns={studentColumns}
              data={students}
              searchPlaceholder="Search student by name, roll number, or email..."
            />
          )
        ) : loadingFaculty ? (
          <LoadingSpinner text="Loading faculty members directory..." />
        ) : (
          <DataTable
            columns={facultyColumns}
            data={faculty}
            searchPlaceholder="Search faculty by name, department, or subject..."
          />
        )}
      </div>

      {/* Modal: Add Student */}
      <Modal
        isOpen={isAddStudentOpen}
        onClose={() => setIsAddStudentOpen(false)}
        title="Enroll New Student"
        subtitle="Add a student profile, roll number, and linked parent details"
      >
        <form onSubmit={handleAddStudent} className="space-y-4">
          {formSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={newStudent.name}
                onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                placeholder="Vikram Malhotra"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={newStudent.email}
                onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                placeholder="vikram@student.edu"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Roll Number</label>
              <input
                type="text"
                required
                value={newStudent.rollNumber}
                onChange={(e) => setNewStudent({ ...newStudent, rollNumber: e.target.value })}
                placeholder="CS2026-009"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
              <select
                value={newStudent.department}
                onChange={(e) => setNewStudent({ ...newStudent, department: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Electronics & Communication">Electronics & Communication</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Semester</label>
              <input
                type="number"
                min="1"
                max="8"
                value={newStudent.semester}
                onChange={(e) => setNewStudent({ ...newStudent, semester: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Section</label>
              <input
                type="text"
                value={newStudent.section}
                onChange={(e) => setNewStudent({ ...newStudent, section: e.target.value })}
                placeholder="A"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Parent / Guardian Name</label>
              <input
                type="text"
                value={newStudent.parentName}
                onChange={(e) => setNewStudent({ ...newStudent, parentName: e.target.value })}
                placeholder="Rajesh Malhotra"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Parent Phone</label>
              <input
                type="text"
                value={newStudent.parentPhone}
                onChange={(e) => setNewStudent({ ...newStudent, parentPhone: e.target.value })}
                placeholder="+1-555-0999"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddStudentOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md disabled:opacity-50"
            >
              {submitting ? 'Enrolling...' : 'Enroll Student'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Faculty */}
      <Modal
        isOpen={isAddFacultyOpen}
        onClose={() => setIsAddFacultyOpen(false)}
        title="Register Faculty Member"
        subtitle="Add teaching faculty with department and course specializations"
      >
        <form onSubmit={handleAddFaculty} className="space-y-4">
          {formSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Faculty Name</label>
              <input
                type="text"
                required
                value={newFaculty.name}
                onChange={(e) => setNewFaculty({ ...newFaculty, name: e.target.value })}
                placeholder="Dr. Katherine Johnson"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
              <input
                type="email"
                required
                value={newFaculty.email}
                onChange={(e) => setNewFaculty({ ...newFaculty, email: e.target.value })}
                placeholder="kjohnson@saepcs.edu"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Department</label>
              <select
                value={newFaculty.department}
                onChange={(e) => setNewFaculty({ ...newFaculty, department: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Computer Science & Engineering">Computer Science & Engineering</option>
                <option value="Information Technology">Information Technology</option>
                <option value="Electronics & Communication">Electronics & Communication</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Designation</label>
              <select
                value={newFaculty.designation}
                onChange={(e) => setNewFaculty({ ...newFaculty, designation: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Professor & HOD">Professor & HOD</option>
                <option value="Professor">Professor</option>
                <option value="Associate Professor">Associate Professor</option>
                <option value="Assistant Professor">Assistant Professor</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Courses / Subjects (Comma-separated)
              </label>
              <input
                type="text"
                value={newFaculty.subjects}
                onChange={(e) => setNewFaculty({ ...newFaculty, subjects: e.target.value })}
                placeholder="Operating Systems, Cloud Computing"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddFacultyOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md disabled:opacity-50"
            >
              {submitting ? 'Registering...' : 'Register Faculty'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminStudentsFaculty;
