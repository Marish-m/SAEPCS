import React, { useState, useEffect } from 'react';
import Modal from '../../components/common/Modal';
import {
  ClipboardList,
  Clock,
  Upload,
  CheckCircle2,
  Award,
  AlertTriangle,
  FileText,
  ExternalLink,
  Download,
  X,
  FileCheck,
  Search,
  Filter,
  Check,
  AlertCircle
} from 'lucide-react';
import apiService from '../../api/apiService';
import { SAMPLE_ASSIGNMENTS } from '../../data/mockData';

const StudentAssignments = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Submission Modal State
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submissionText, setSubmissionText] = useState('');
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await apiService.getAssignments();
      if (res.data?.assignments && res.data.assignments.length > 0) {
        setAssignments(res.data.assignments);
      } else {
        // Fallback to enhanced mock data with dynamic status
        setAssignments(
          SAMPLE_ASSIGNMENTS.map((a) => {
            const isOverdue = new Date() > new Date(a.dueDate);
            let status = a.status || (isOverdue ? 'Missing' : 'Pending');
            return {
              ...a,
              status,
              isOverdue,
            };
          })
        );
      }
    } catch (err) {
      console.warn('Using mock assignments fallback:', err);
      setAssignments(
        SAMPLE_ASSIGNMENTS.map((a) => {
          const isOverdue = new Date() > new Date(a.dueDate);
          let status = a.status || (isOverdue ? 'Missing' : 'Pending');
          return {
            ...a,
            status,
            isOverdue,
          };
        })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleOpenSubmit = (item) => {
    setSelectedAssignment(item);
    setSubmissionText(item.mySubmission?.submissionText || item.submissionText || '');
    setSubmissionUrl(item.mySubmission?.fileUrl || item.fileUrl || '');
    setSelectedFile(null);
    setFileError('');
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Allowed extensions check
    const allowedExts = ['.pdf', '.doc', '.docx', '.zip', '.txt', '.png', '.jpg', '.jpeg'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedExts.includes(fileExt)) {
      setFileError('Unsupported file type. Please upload PDF, DOC, DOCX, ZIP, TXT, or Image.');
      setSelectedFile(null);
      return;
    }

    // 10MB limit check
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File size exceeds the 10MB limit.');
      setSelectedFile(null);
      return;
    }

    setFileError('');
    setSelectedFile(file);
  };

  const handleSubmitWork = async (e) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    if (!submissionText.trim() && !selectedFile && !submissionUrl.trim()) {
      setErrorMsg('Please provide solution summary text, an external link, or upload a file.');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      if (submissionText.trim()) formData.append('submissionText', submissionText.trim());
      if (submissionUrl.trim()) formData.append('fileUrl', submissionUrl.trim());
      if (selectedFile) formData.append('file', selectedFile);

      const res = await apiService.submitAssignment(selectedAssignment._id, formData);

      setSuccessMsg(res.data?.message || 'Assignment submitted successfully!');
      setTimeout(() => {
        setIsSubmitModalOpen(false);
        fetchAssignments();
      }, 1400);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Submission failed. Please try again.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Status counts for filter pills & stats bar
  const stats = {
    total: assignments.length,
    pending: assignments.filter((a) => a.status === 'Pending').length,
    missing: assignments.filter((a) => a.status === 'Missing').length,
    submitted: assignments.filter((a) => a.status === 'Submitted' || a.status === 'Late').length,
    graded: assignments.filter((a) => a.status === 'Graded').length,
  };

  const filteredAssignments = assignments.filter((item) => {
    // Tab filter
    if (selectedFilter === 'Pending' && item.status !== 'Pending') return false;
    if (selectedFilter === 'Missing' && item.status !== 'Missing') return false;
    if (selectedFilter === 'Submitted' && item.status !== 'Submitted' && item.status !== 'Late') return false;
    if (selectedFilter === 'Graded' && item.status !== 'Graded') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const subjectName = (item.subject?.name || item.subject || '').toLowerCase();
      const title = (item.title || '').toLowerCase();
      return title.includes(q) || subjectName.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Course Assignments & Homework</h2>
              <p className="text-xs text-slate-400">
                Track deadlines, submit coursework securely, and view evaluation scores with faculty feedback.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Overview Stat Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-1">
            <span>Pending Work</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-400 font-mono">{stats.pending}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Due before cutoff date</p>
        </div>

        <div className={`p-4 rounded-2xl backdrop-blur-md border ${stats.missing > 0 ? 'bg-rose-950/20 border-rose-500/30' : 'bg-slate-900/70 border-slate-800/80'}`}>
          <div className="flex items-center justify-between text-xs font-medium mb-1 text-slate-400">
            <span className={stats.missing > 0 ? 'text-rose-400 font-bold' : ''}>Overdue Missing</span>
            <AlertTriangle className={`w-4 h-4 ${stats.missing > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-500'}`} />
          </div>
          <div className={`text-2xl font-black font-mono ${stats.missing > 0 ? 'text-rose-400' : 'text-slate-300'}`}>
            {stats.missing}
          </div>
          <p className="text-[10px] text-slate-500 mt-0.5">Impacts academic risk score</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-1">
            <span>Submitted</span>
            <FileCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-400 font-mono">{stats.submitted}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Awaiting evaluation</p>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-1">
            <span>Graded & Verified</span>
            <Award className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400 font-mono">{stats.graded}</div>
          <p className="text-[10px] text-slate-500 mt-0.5">Marks recorded</p>
        </div>
      </div>

      {/* Urgent Missing Assignments Alert Banner */}
      {stats.missing > 0 && (
        <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-3 shadow-lg shadow-rose-950/20">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-white text-sm mb-0.5">
              Attention Required: {stats.missing} Overdue Assignment{stats.missing > 1 ? 's' : ''} Detected
            </h4>
            <p className="text-rose-300/90 leading-relaxed">
              Assignments past their deadline that remain unsubmitted trigger institutional academic deficit flags.
              Submit your work immediately to clear missing status and restore academic standing.
            </p>
          </div>
        </div>
      )}

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
          {['All', 'Pending', 'Missing', 'Submitted', 'Graded'].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedFilter === tab
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{tab}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedFilter === tab
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tab === 'All'
                  ? stats.total
                  : tab === 'Pending'
                  ? stats.pending
                  : tab === 'Missing'
                  ? stats.missing
                  : tab === 'Submitted'
                  ? stats.submitted
                  : stats.graded}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search assignments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Assignment Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400">
          <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs">Loading course assignments...</p>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
          <ClipboardList className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-300">No Assignments Found</h3>
          <p className="text-xs text-slate-500 mt-1">
            {selectedFilter !== 'All'
              ? `There are no assignments matching status "${selectedFilter}".`
              : 'No coursework has been assigned for this semester yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssignments.map((item) => {
            const isGraded = item.status === 'Graded';
            const isSubmitted = item.status === 'Submitted';
            const isLate = item.status === 'Late';
            const isMissing = item.status === 'Missing';
            const isPending = item.status === 'Pending';
            const dueDate = new Date(item.dueDate);
            const isOverdue = new Date() > dueDate;

            // Score and max marks
            const obtainedMarks = item.mySubmission?.obtainedMarks !== undefined
              ? item.mySubmission.obtainedMarks
              : item.obtainedMarks;
            const maxMarks = item.maxMarks || item.maxPoints || 50;

            const feedback = item.mySubmission?.feedback || item.feedback;
            const submissionTextVal = item.mySubmission?.submissionText || item.submissionText;
            const fileUrlVal = item.mySubmission?.fileUrl || item.fileUrl;
            const submittedAtVal = item.mySubmission?.submittedAt || item.submittedAt;

            return (
              <div
                key={item._id}
                className={`rounded-2xl border p-5 backdrop-blur-md shadow-xl flex flex-col justify-between transition-all hover:border-slate-700 ${
                  isMissing
                    ? 'border-rose-500/40 bg-gradient-to-b from-rose-950/20 via-slate-900/80 to-slate-900/90'
                    : isGraded
                    ? 'border-emerald-500/30 bg-gradient-to-b from-emerald-950/15 via-slate-900/80 to-slate-900/90'
                    : isLate
                    ? 'border-amber-500/30 bg-gradient-to-b from-amber-950/15 via-slate-900/80 to-slate-900/90'
                    : 'border-slate-800 bg-slate-900/70'
                }`}
              >
                <div>
                  {/* Subject Tag & Status Badge */}
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {item.subject?.name || item.subject}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        isGraded
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : isSubmitted
                          ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                          : isLate
                          ? 'bg-orange-500/15 text-orange-400 border border-orange-500/30'
                          : isMissing
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {isGraded ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : isMissing ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : isLate ? (
                        <Clock className="w-3 h-3" />
                      ) : isSubmitted ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      <span>{item.status}</span>
                    </span>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-sm font-bold text-white mb-1.5 leading-snug">{item.title}</h3>
                  <p className="text-xs text-slate-400 mb-4 line-clamp-3 leading-relaxed">
                    {item.description}
                  </p>

                  {/* If Graded: Show Score & Feedback Box */}
                  {isGraded && obtainedMarks !== null && (
                    <div className="p-3 mb-4 rounded-xl bg-slate-950/80 border border-emerald-500/30 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                        <span className="flex items-center gap-1">
                          <Award className="w-3.5 h-3.5" />
                          <span>Evaluation Score</span>
                        </span>
                        <span className="font-mono text-sm">
                          {obtainedMarks} / {maxMarks}{' '}
                          <span className="text-[11px] text-slate-400 font-normal">
                            ({Math.round((obtainedMarks / maxMarks) * 100)}%)
                          </span>
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.round((obtainedMarks / maxMarks) * 100))}%` }}
                        />
                      </div>
                      {feedback && (
                        <p className="text-[11px] text-slate-300 italic pt-1 border-t border-slate-900">
                          "{feedback}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* If Submitted or Late: Show Submitted Summary */}
                  {(isSubmitted || isLate) && !isGraded && (
                    <div className="p-3 mb-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Submitted on:</span>
                        <span className="font-mono text-slate-300">
                          {submittedAtVal ? new Date(submittedAtVal).toLocaleDateString() : 'Recorded'}
                        </span>
                      </div>
                      {submissionTextVal && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 italic font-mono">
                          {submissionTextVal}
                        </p>
                      )}
                      {fileUrlVal && (
                        <a
                          href={fileUrlVal.startsWith('http') ? fileUrlVal : `http://localhost:5000${fileUrlVal}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:underline pt-0.5"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download Solution File</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Overdue Banner for Missing Assignment */}
                  {isMissing && (
                    <div className="p-2.5 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      <span>Past deadline: Overdue & unsubmitted.</span>
                    </div>
                  )}
                </div>

                {/* Footer Strip */}
                <div className="pt-4 border-t border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-400' : 'text-amber-400'}`} />
                      <span className={isOverdue ? 'text-rose-400 font-semibold' : ''}>
                        Due: {dueDate.toLocaleDateString()}
                      </span>
                    </span>
                    <span className="font-mono text-slate-300 font-bold">{maxMarks} Marks</span>
                  </div>

                  <button
                    onClick={() => handleOpenSubmit(item)}
                    className={`w-full py-2.5 text-xs font-bold rounded-xl transition-all text-center flex items-center justify-center gap-1.5 active:scale-95 ${
                      isGraded
                        ? 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700'
                        : isMissing
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30'
                        : isSubmitted || isLate
                        ? 'bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/30'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {isGraded
                        ? 'View Evaluation & Feedback'
                        : isMissing
                        ? 'Submit Overdue Work Now'
                        : isSubmitted || isLate
                        ? 'Update Submission'
                        : 'Submit Assignment'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Submit Assignment */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => !submitting && setIsSubmitModalOpen(false)}
        title={`Submit: ${selectedAssignment?.title || 'Assignment'}`}
        subtitle={`Course: ${selectedAssignment?.subject?.name || selectedAssignment?.subject || ''} • Deadline: ${
          selectedAssignment?.dueDate ? new Date(selectedAssignment.dueDate).toLocaleString() : ''
        }`}
      >
        <form onSubmit={handleSubmitWork} className="space-y-4">
          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Overdue Warning */}
          {selectedAssignment && new Date() > new Date(selectedAssignment.dueDate) && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
              <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Late Submission Notice:</span>
                The deadline for this assignment elapsed on {new Date(selectedAssignment.dueDate).toLocaleDateString()}.
                Your submission will be recorded with timestamp and marked as <strong>Late</strong>.
              </div>
            </div>
          )}

          {/* Solution Textarea */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Solution Summary / Written Response <span className="text-slate-500 font-normal">(Optional if uploading file)</span>
            </label>
            <textarea
              rows="4"
              value={submissionText}
              onChange={(e) => setSubmissionText(e.target.value)}
              placeholder="Paste algorithm explanations, theoretical derivation, or summary of your work..."
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Secure File Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Upload Document / Code Archive <span className="text-slate-500 font-normal">(Max 10MB)</span>
            </label>
            <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 hover:border-indigo-500/50 transition-colors text-center relative">
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.zip,.txt,.png,.jpg,.jpeg"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
              <p className="text-xs text-slate-300 font-medium">
                {selectedFile ? selectedFile.name : 'Click to browse or drag file here'}
              </p>
              <p className="text-[10px] text-slate-500 mt-1">
                Supported formats: PDF, DOCX, ZIP, TXT, PNG, JPG (up to 10MB)
              </p>
            </div>
            {selectedFile && (
              <div className="mt-2 flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <span className="truncate max-w-xs font-mono">{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-slate-400 hover:text-rose-400 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {fileError && (
              <p className="text-[11px] text-rose-400 mt-1">{fileError}</p>
            )}
          </div>

          {/* External Repository or Cloud URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              External Repository / Cloud Link <span className="text-slate-500 font-normal">(GitHub, Drive, GitLab)</span>
            </label>
            <input
              type="url"
              value={submissionUrl}
              onChange={(e) => setSubmissionUrl(e.target.value)}
              placeholder="https://github.com/username/assignment-solution"
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setIsSubmitModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting Work...' : 'Confirm Submission'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StudentAssignments;
