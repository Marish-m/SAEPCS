import React, { useState, useEffect } from 'react';
import Modal from '../../components/common/Modal';
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  Clock,
  Award,
  FileText,
  AlertTriangle,
  Download,
  Trash2,
  ExternalLink,
  Users,
  Search,
  Check,
  X,
  FileCheck,
  AlertCircle
} from 'lucide-react';
import apiService from '../../api/apiService';
import { SAMPLE_ASSIGNMENTS } from '../../data/mockData';

const FacultyAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Create Assignment Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    title: '',
    subject: '',
    semester: 4,
    dueDate: '',
    maxMarks: 50,
    description: '',
  });

  // Review & Grading Console State
  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissionsData, setSubmissionsData] = useState({
    submissions: [],
    missingStudents: [],
    stats: {},
  });
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionFilter, setSubmissionFilter] = useState('all'); // all, pending_grade, graded, missing

  // Active student grading state
  const [gradingStudentId, setGradingStudentId] = useState(null);
  const [gradeInput, setGradeInput] = useState({
    obtainedMarks: '',
    feedback: '',
  });
  const [gradingSaving, setGradingSaving] = useState(false);

  // Notifications
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const [assignRes, subRes] = await Promise.allSettled([
        apiService.getAssignments(),
        apiService.getSubjects(),
      ]);

      if (assignRes.status === 'fulfilled' && assignRes.value.data?.assignments) {
        setAssignments(assignRes.value.data.assignments);
      } else {
        setAssignments(SAMPLE_ASSIGNMENTS);
      }

      if (subRes.status === 'fulfilled' && subRes.value.data?.subjects) {
        setSubjects(subRes.value.data.subjects);
        if (subRes.value.data.subjects.length > 0 && !newAssignment.subject) {
          setNewAssignment((prev) => ({
            ...prev,
            subject: subRes.value.data.subjects[0]._id,
          }));
        }
      }
    } catch (err) {
      console.warn('Error fetching faculty assignments:', err);
      setAssignments(SAMPLE_ASSIGNMENTS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleOpenCreateModal = () => {
    setErrorMsg('');
    setFeedbackMsg('');
    // Default deadline to 7 days from now
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    setNewAssignment({
      title: '',
      subject: subjects.length > 0 ? subjects[0]._id : '',
      semester: 4,
      dueDate: dateStr,
      maxMarks: 50,
      description: '',
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!newAssignment.title || !newAssignment.dueDate || !newAssignment.description) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    setCreating(true);
    setErrorMsg('');

    try {
      await apiService.createAssignment(newAssignment);
      setFeedbackMsg('Assignment published successfully and students notified!');
      setTimeout(() => {
        setFeedbackMsg('');
        setIsCreateModalOpen(false);
        fetchAssignments();
      }, 1300);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to publish assignment.';
      setErrorMsg(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenReview = async (assignment) => {
    setSelectedAssignment(assignment);
    setIsGradingModalOpen(true);
    setSubmissionsLoading(true);
    setGradingStudentId(null);
    setSubmissionFilter('all');
    setErrorMsg('');
    setFeedbackMsg('');

    try {
      const res = await apiService.getAssignmentSubmissions(assignment._id);
      if (res.data) {
        setSubmissionsData({
          submissions: res.data.submissions || [],
          missingStudents: res.data.missingStudents || [],
          stats: res.data.stats || {},
        });
      }
    } catch (err) {
      console.warn('Failed to load submissions:', err);
      // Fallback display
      setSubmissionsData({
        submissions: [],
        missingStudents: [],
        stats: { totalEligible: 0, submittedCount: 0, missingCount: 0, gradedCount: 0 },
      });
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const handleStartGrading = (sub) => {
    setGradingStudentId(sub.student?._id || sub.student);
    setGradeInput({
      obtainedMarks: sub.obtainedMarks !== null && sub.obtainedMarks !== undefined ? sub.obtainedMarks : '',
      feedback: sub.feedback || '',
    });
  };

  const handleSaveGrade = async (sub) => {
    const marksNum = Number(gradeInput.obtainedMarks);
    const maxMarks = selectedAssignment?.maxMarks || 50;

    if (isNaN(marksNum) || marksNum < 0 || marksNum > maxMarks) {
      setErrorMsg(`Marks must be a valid number between 0 and ${maxMarks}.`);
      return;
    }

    setGradingSaving(true);
    setErrorMsg('');

    try {
      await apiService.gradeSubmission(selectedAssignment._id, {
        submissionId: sub._id,
        studentId: sub.student?._id || sub.student,
        obtainedMarks: marksNum,
        feedback: gradeInput.feedback.trim(),
      });

      // Update state locally
      setSubmissionsData((prev) => ({
        ...prev,
        submissions: prev.submissions.map((s) =>
          s._id === sub._id
            ? {
                ...s,
                status: 'Graded',
                obtainedMarks: marksNum,
                feedback: gradeInput.feedback.trim(),
                gradedAt: new Date(),
              }
            : s
        ),
        stats: {
          ...prev.stats,
          gradedCount: (prev.stats.gradedCount || 0) + (sub.status !== 'Graded' ? 1 : 0),
        },
      }));

      setFeedbackMsg('Grade and feedback saved successfully! Student notified.');
      setGradingStudentId(null);
      setTimeout(() => setFeedbackMsg(''), 2500);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to save grade.';
      setErrorMsg(msg);
    } finally {
      setGradingSaving(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!window.confirm('Are you sure you want to delete this assignment? All submissions and student risk states will be updated.')) {
      return;
    }

    try {
      await apiService.deleteAssignment(assignmentId);
      setAssignments(assignments.filter((a) => a._id !== assignmentId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete assignment.');
    }
  };

  const filteredAssignments = assignments.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = (item.title || '').toLowerCase();
    const subj = (item.subject?.name || item.subject || '').toLowerCase();
    return title.includes(q) || subj.includes(q);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Assignment Management & Evaluation</h2>
              <p className="text-xs text-slate-400">
                Publish course tasks, review student submissions, award marks with feedback, and track unsubmitted overdue work.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Publish New Assignment</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search assignments or subjects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Assignments Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading course assignments...</p>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
          <ClipboardList className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-300">No Assignments Found</h3>
          <p className="text-xs text-slate-500 mt-1">Click "Publish New Assignment" to post coursework for your students.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssignments.map((item) => {
            const dueDate = new Date(item.dueDate);
            const isOverdue = new Date() > dueDate;
            const maxMarks = item.maxMarks || item.maxPoints || 50;
            const submissionsCount = item.submissionsCount || 0;
            const gradedCount = item.gradedCount || 0;
            const missingCount = item.missingCount || 0;

            return (
              <div
                key={item._id}
                className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 backdrop-blur-md shadow-xl flex flex-col justify-between hover:border-slate-700 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {item.subject?.name || item.subject}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        isOverdue
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {isOverdue ? 'Closed / Overdue' : 'Submissions Active'}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white mb-1.5 leading-snug">{item.title}</h3>
                  <p className="text-xs text-slate-400 mb-4 line-clamp-3 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Submission Statistics Bar */}
                  <div className="p-3 mb-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs grid grid-cols-3 gap-2 text-center">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-bold">Submissions</span>
                      <span className="font-mono font-bold text-slate-200">{submissionsCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-emerald-500 block uppercase font-bold">Graded</span>
                      <span className="font-mono font-bold text-emerald-400">{gradedCount}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-rose-500 block uppercase font-bold">Missing</span>
                      <span className="font-mono font-bold text-rose-400">{missingCount}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-400' : 'text-amber-400'}`} />
                      <span className={isOverdue ? 'text-rose-400 font-semibold' : ''}>
                        Due: {dueDate.toLocaleDateString()}
                      </span>
                    </span>
                    <span className="font-mono text-slate-300 font-bold">{maxMarks} Max Marks</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenReview(item)}
                      className="flex-1 py-2 text-xs font-bold text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 rounded-xl border border-indigo-500/20 transition-all text-center flex items-center justify-center gap-1.5"
                    >
                      <Award className="w-3.5 h-3.5" />
                      <span>Review & Grade Submissions</span>
                    </button>
                    <button
                      onClick={() => handleDeleteAssignment(item._id)}
                      title="Delete Assignment"
                      className="p-2 text-slate-500 hover:text-rose-400 bg-slate-800/80 hover:bg-rose-500/10 rounded-xl border border-slate-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Publish New Assignment */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !creating && setIsCreateModalOpen(false)}
        title="Publish Course Assignment"
        subtitle="Students enrolled in this course will receive automated portal notifications"
      >
        <form onSubmit={handleCreateAssignment} className="space-y-4">
          {feedbackMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Assignment Title <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={newAssignment.title}
              onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
              placeholder="e.g. Graph Traversal & Dijkstra Algorithm Implementation"
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Subject Course <span className="text-rose-400">*</span>
              </label>
              <select
                value={newAssignment.subject}
                onChange={(e) => setNewAssignment({ ...newAssignment, subject: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                {subjects.length > 0 ? (
                  subjects.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.code})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="Data Structures & Algorithms">Data Structures & Algorithms (CS401)</option>
                    <option value="Machine Learning">Machine Learning (CS402)</option>
                    <option value="Operating Systems">Operating Systems (CS403)</option>
                    <option value="Database Systems">Database Systems (CS404)</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Maximum Evaluation Marks <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="5"
                max="100"
                required
                value={newAssignment.maxMarks}
                onChange={(e) =>
                  setNewAssignment({ ...newAssignment, maxMarks: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Submission Deadline <span className="text-rose-400">*</span>
            </label>
            <input
              type="date"
              required
              value={newAssignment.dueDate}
              onChange={(e) => setNewAssignment({ ...newAssignment, dueDate: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Instructions & Evaluation Criteria <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows="3"
              required
              value={newAssignment.description}
              onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
              placeholder="State requirements, submission formats (PDF/code archive), and grading rubric..."
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={creating}
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md disabled:opacity-50"
            >
              {creating ? 'Publishing...' : 'Publish Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Submissions Review & Grading Console */}
      <Modal
        isOpen={isGradingModalOpen}
        onClose={() => setIsGradingModalOpen(false)}
        title={`Evaluation Console: ${selectedAssignment?.title || 'Assignment'}`}
        subtitle={`Max Marks: ${selectedAssignment?.maxMarks || 50} • Deadline: ${
          selectedAssignment?.dueDate ? new Date(selectedAssignment.dueDate).toLocaleDateString() : ''
        }`}
      >
        <div className="space-y-4">
          {feedbackMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Metrics */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Total Eligible</span>
              <span className="font-mono font-bold text-slate-200">{submissionsData.stats.totalEligible || 0}</span>
            </div>
            <div>
              <span className="text-[10px] text-indigo-400 block uppercase font-bold">Submitted</span>
              <span className="font-mono font-bold text-indigo-400">{submissionsData.stats.submittedCount || 0}</span>
            </div>
            <div>
              <span className="text-[10px] text-emerald-400 block uppercase font-bold">Graded</span>
              <span className="font-mono font-bold text-emerald-400">{submissionsData.stats.gradedCount || 0}</span>
            </div>
            <div>
              <span className="text-[10px] text-rose-400 block uppercase font-bold">Missing</span>
              <span className="font-mono font-bold text-rose-400">{submissionsData.stats.missingCount || 0}</span>
            </div>
          </div>

          {/* Tabs Filter */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
            <button
              onClick={() => setSubmissionFilter('all')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                submissionFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Submissions ({submissionsData.submissions.length})
            </button>
            <button
              onClick={() => setSubmissionFilter('pending_grade')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                submissionFilter === 'pending_grade' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pending Grade ({submissionsData.submissions.filter((s) => s.status !== 'Graded').length})
            </button>
            <button
              onClick={() => setSubmissionFilter('missing')}
              className={`px-3 py-1 rounded-lg font-bold transition-all ${
                submissionFilter === 'missing' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Missing Students ({submissionsData.missingStudents.length})
            </button>
          </div>

          {/* Submissions List */}
          {submissionsLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
              Loading student submissions...
            </div>
          ) : submissionFilter === 'missing' ? (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {submissionsData.missingStudents.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">All eligible students have submitted work.</p>
              ) : (
                submissionsData.missingStudents.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950/60 border border-rose-500/30 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">{item.student?.user?.name || item.student?.rollNumber}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Roll: {item.student?.rollNumber} • {item.student?.user?.email}
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>{item.status}</span>
                    </span>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {submissionsData.submissions
                .filter((s) => (submissionFilter === 'pending_grade' ? s.status !== 'Graded' : true))
                .map((sub) => {
                  const student = sub.student;
                  const isGraded = sub.status === 'Graded';
                  const isLate = sub.status === 'Late' || sub.isLate;
                  const isEditingThis = gradingStudentId === (student?._id || student);

                  return (
                    <div
                      key={sub._id}
                      className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white text-xs">{student?.user?.name || 'Student'}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Roll: {student?.rollNumber || 'N/A'} • Submitted:{' '}
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'N/A'}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isGraded
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : isLate
                                ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                                : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                            }`}
                          >
                            {isGraded ? `Graded (${sub.obtainedMarks}/${selectedAssignment?.maxMarks || 50})` : isLate ? 'Submitted Late' : 'Submitted on Time'}
                          </span>
                        </div>
                      </div>

                      {/* Submission text & attachment */}
                      {sub.submissionText && (
                        <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80 text-xs text-slate-300 font-mono">
                          {sub.submissionText}
                        </div>
                      )}

                      {sub.fileUrl && (
                        <div>
                          <a
                            href={sub.fileUrl.startsWith('http') ? sub.fileUrl : `http://localhost:5000${sub.fileUrl}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg border border-indigo-500/20"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Submission ({sub.originalFileName || sub.fileName || 'Document'})</span>
                          </a>
                        </div>
                      )}

                      {/* Grading Section */}
                      {isEditingThis ? (
                        <div className="pt-3 border-t border-slate-800 space-y-3">
                          <div className="grid grid-cols-3 gap-3 items-center">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                Awarded Marks (Max: {selectedAssignment?.maxMarks || 50})
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={selectedAssignment?.maxMarks || 50}
                                value={gradeInput.obtainedMarks}
                                onChange={(e) =>
                                  setGradeInput({ ...gradeInput, obtainedMarks: e.target.value })
                                }
                                placeholder="Marks"
                                className="w-full px-3 py-1.5 text-xs font-mono font-bold bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                Written Faculty Feedback
                              </label>
                              <input
                                type="text"
                                value={gradeInput.feedback}
                                onChange={(e) =>
                                  setGradeInput({ ...gradeInput, feedback: e.target.value })
                                }
                                placeholder="e.g. Excellent modular implementation and unit testing."
                                className="w-full px-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setGradingStudentId(null)}
                              className="px-3 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={gradingSaving}
                              onClick={() => handleSaveGrade(sub)}
                              className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md"
                            >
                              {gradingSaving ? 'Saving...' : 'Save Grade & Send Feedback'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                          {isGraded ? (
                            <div className="text-slate-400">
                              Feedback:{' '}
                              <span className="text-slate-200 italic font-medium">
                                "{sub.feedback || 'Evaluated.'}"
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">Not graded yet</span>
                          )}

                          <button
                            onClick={() => handleStartGrading(sub)}
                            className="px-3 py-1 text-xs font-bold text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 rounded-lg border border-indigo-500/20 transition-all"
                          >
                            {isGraded ? 'Edit Marks / Feedback' : 'Enter Marks & Feedback'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default FacultyAssignments;
