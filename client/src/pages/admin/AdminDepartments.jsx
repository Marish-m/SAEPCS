import React, { useState, useEffect } from 'react';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AlertBanner from '../../components/common/AlertBanner';
import {
  Building2,
  BookOpen,
  Users,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  GraduationCap,
} from 'lucide-react';
import apiService from '../../api/apiService';

const AdminDepartments = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Add Course Modal
  const [isAddCourseModalOpen, setIsAddCourseModalOpen] = useState(false);
  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [submittingCourse, setSubmittingCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({
    code: '',
    name: '',
    semester: 1,
    credits: 3,
    syllabusSummary: '',
  });

  // Add Department Modal
  const [isAddDeptModalOpen, setIsAddDeptModalOpen] = useState(false);
  const [submittingDept, setSubmittingDept] = useState(false);
  const [newDept, setNewDept] = useState({
    name: '',
    code: '',
    description: '',
  });

  const fetchDepartments = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiService.getDepartments();
      const deptList = res.data?.departments || [];
      setDepartments(deptList);
      if (deptList.length > 0 && !selectedDeptId) {
        setSelectedDeptId(deptList[0]._id || deptList[0].id);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to fetch departments from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleAddCourse = async (e) => {
    e.preventDefault();
    if (!selectedDeptId) return;

    setSubmittingCourse(true);
    setErrorMsg('');
    try {
      await apiService.createSubject({
        ...newCourse,
        department: selectedDeptId,
      });

      setSuccessMsg(`Course ${newCourse.code} added to curriculum successfully!`);
      setIsAddCourseModalOpen(false);
      setNewCourse({
        code: '',
        name: '',
        semester: 1,
        credits: 3,
        syllabusSummary: '',
      });
      fetchDepartments();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to add course.');
    } finally {
      setSubmittingCourse(false);
    }
  };

  const handleAddDepartment = async (e) => {
    e.preventDefault();
    setSubmittingDept(true);
    setErrorMsg('');

    try {
      await apiService.createDepartment(newDept);
      setSuccessMsg(`Department ${newDept.name} (${newDept.code}) created successfully!`);
      setIsAddDeptModalOpen(false);
      setNewDept({ name: '', code: '', description: '' });
      fetchDepartments();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to create department.');
    } finally {
      setSubmittingDept(false);
    }
  };

  const handleDeleteSubject = async (subjectId, subjectName) => {
    if (!window.confirm(`Are you sure you want to remove "${subjectName}" from the curriculum?`)) {
      return;
    }

    try {
      await apiService.deleteSubject(subjectId);
      setSuccessMsg(`Subject removed successfully.`);
      fetchDepartments();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to delete subject.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner and Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Academic Departments & Curricula</h2>
          <p className="text-xs text-slate-400">
            Structure departmental curricula, course credit schemas, and faculty allocations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDepartments}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-all"
            title="Refresh departments"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button
            onClick={() => setIsAddDeptModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Department</span>
          </button>
          <button
            onClick={() => setIsAddCourseModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Course / Subject</span>
          </button>
        </div>
      </div>

      {errorMsg && <AlertBanner type="error" message={errorMsg} onClose={() => setErrorMsg('')} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg('')} />}

      {loading ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner size="lg" message="Loading institutional departments..." />
        </div>
      ) : departments.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-slate-800 bg-slate-900/40">
          <Building2 className="w-10 h-10 text-slate-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">No departments found</p>
          <p className="text-xs text-slate-500 mt-1">Create your first department to configure curricula.</p>
        </div>
      ) : (
        /* Departments Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept) => {
            const deptId = dept._id || dept.id;
            const subjects = dept.subjects || [];

            return (
              <div
                key={deptId}
                className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                      {dept.code}
                    </span>
                    <span className="text-xs text-slate-400">{subjects.length} Courses</span>
                  </div>

                  <h3 className="text-base font-bold text-white mb-1">{dept.name}</h3>
                  <p className="text-xs text-slate-400 mb-4 truncate">
                    {dept.description || `Head of Dept: ${dept.hod}`}
                  </p>

                  <div className="grid grid-cols-2 gap-2 mb-4 p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Students</span>
                      <span className="text-sm font-bold text-slate-200">{dept.totalStudents || 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Faculty</span>
                      <span className="text-sm font-bold text-slate-200">{dept.totalFaculty || 0}</span>
                    </div>
                  </div>

                  {/* Course List Preview */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Curriculum Courses:
                      </span>
                      <button
                        onClick={() => {
                          setSelectedDeptId(deptId);
                          setIsAddCourseModalOpen(true);
                        }}
                        className="text-[10px] font-semibold text-indigo-400 hover:text-indigo-300"
                      >
                        + Add Course
                      </button>
                    </div>

                    {subjects.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">No subjects configured yet</p>
                    ) : (
                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {subjects.map((sub) => (
                          <div
                            key={sub._id || sub.id}
                            className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs flex items-center justify-between group"
                          >
                            <div className="min-w-0 pr-2">
                              <span className="font-semibold text-slate-200 truncate block">
                                {sub.name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 block">
                                {sub.code} • Sem {sub.semester}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[10px] font-bold text-indigo-400 px-2 py-0.5 rounded bg-indigo-500/10">
                                {sub.credits} Credits
                              </span>
                              <button
                                onClick={() => handleDeleteSubject(sub._id || sub.id, sub.name)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                                title="Remove course"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add Department */}
      <Modal
        isOpen={isAddDeptModalOpen}
        onClose={() => setIsAddDeptModalOpen(false)}
        title="Add Academic Department"
        subtitle="Introduce an institutional department and code prefix"
      >
        <form onSubmit={handleAddDepartment} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Department Name *
              </label>
              <input
                type="text"
                required
                value={newDept.name}
                onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                placeholder="e.g. Mechanical Engineering"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Code Prefix *
              </label>
              <input
                type="text"
                required
                value={newDept.code}
                onChange={(e) => setNewDept({ ...newDept, code: e.target.value.toUpperCase() })}
                placeholder="e.g. MECH"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={newDept.description}
              onChange={(e) => setNewDept({ ...newDept, description: e.target.value })}
              placeholder="Brief summary of department operations..."
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddDeptModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingDept}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md disabled:opacity-50"
            >
              {submittingDept ? 'Creating...' : 'Create Department'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Course */}
      <Modal
        isOpen={isAddCourseModalOpen}
        onClose={() => setIsAddCourseModalOpen(false)}
        title="Add Curriculum Course"
        subtitle="Introduce a subject code, semester, and credit allocation"
      >
        <form onSubmit={handleAddCourse} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Target Department *</label>
            <select
              value={selectedDeptId}
              onChange={(e) => setSelectedDeptId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            >
              {departments.map((d) => (
                <option key={d._id || d.id} value={d._id || d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Course Code *</label>
              <input
                type="text"
                required
                value={newCourse.code}
                onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value.toUpperCase() })}
                placeholder="e.g. CS405"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Semester (1-8) *</label>
              <input
                type="number"
                min="1"
                max="8"
                required
                value={newCourse.semester}
                onChange={(e) => setNewCourse({ ...newCourse, semester: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Credits *</label>
              <input
                type="number"
                min="1"
                max="6"
                required
                value={newCourse.credits}
                onChange={(e) => setNewCourse({ ...newCourse, credits: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Course Title *</label>
              <input
                type="text"
                required
                value={newCourse.name}
                onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                placeholder="e.g. Distributed Cloud Computing"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddCourseModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submittingCourse}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md disabled:opacity-50"
            >
              {submittingCourse ? 'Saving Course...' : 'Save Course'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminDepartments;
