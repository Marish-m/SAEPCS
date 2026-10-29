import React, { useState, useEffect } from 'react';
import apiService from '../../api/apiService';
import {
  Award,
  Save,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Plus,
  BookOpen,
  Calendar,
  Layers,
  Search,
  Filter,
  BarChart3,
  Check,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

const ASSESSMENT_TYPES = [
  'Internal 1',
  'Internal 2',
  'Model Exam',
  'Assignment',
  'Quiz',
  'Final Internal',
];

const FacultyMarks = () => {
  // Tabs: 'entry' | 'assessments'
  const [activeTab, setActiveTab] = useState('entry');

  // Subjects & Assessments
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [currentAssessment, setCurrentAssessment] = useState(null);

  // Manual fallback configuration when no assessment is pre-selected
  const [assessmentType, setAssessmentType] = useState('Internal 1');
  const [maxMarks, setMaxMarks] = useState(50);
  const [semester, setSemester] = useState(4);

  // Students & Marks Map
  const [students, setStudents] = useState([]);
  const [marksMap, setMarksMap] = useState({});
  const [remarksMap, setRemarksMap] = useState({});
  const [validationErrors, setValidationErrors] = useState({});

  // Loading & Feedback
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Create Assessment Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newAssessment, setNewAssessment] = useState({
    title: '',
    subject: '',
    assessmentType: 'Internal 1',
    maxMarks: 50,
    date: new Date().toISOString().split('T')[0],
    semester: 4,
    description: '',
  });
  const [creatingAssessment, setCreatingAssessment] = useState(false);

  // 1. Load Initial Subjects & Assessments
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [subRes, assRes] = await Promise.all([
          apiService.getSubjects(),
          apiService.getAssessments(),
        ]);

        if (subRes.data?.subjects) {
          const list = subRes.data.subjects;
          setSubjects(list);
          if (list.length > 0) {
            setSelectedSubject(list[0]._id);
            setNewAssessment((prev) => ({ ...prev, subject: list[0]._id }));
          }
        }

        if (assRes.data?.assessments) {
          const assList = assRes.data.assessments;
          setAssessments(assList);
          if (assList.length > 0) {
            setSelectedAssessmentId(assList[0]._id);
            setCurrentAssessment(assList[0]);
            setMaxMarks(assList[0].maxMarks);
            setAssessmentType(assList[0].assessmentType);
            if (assList[0].subject?._id) {
              setSelectedSubject(assList[0].subject._id);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching subjects/assessments:', err);
      }
    };

    fetchInitial();
  }, []);

  // 2. Fetch Students for Selected Semester
  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const res = await apiService.getStudents({ semester });
        const list = res.data?.students || [];
        setStudents(list);
      } catch (err) {
        console.error('Error loading students:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [semester]);

  // 3. Load Existing Marks for Selected Assessment or Subject
  useEffect(() => {
    const fetchExistingMarks = async () => {
      if (!selectedSubject) return;
      try {
        const params = { subject: selectedSubject, assessmentType };
        if (selectedAssessmentId) params.assessmentId = selectedAssessmentId;

        const res = await apiService.getMarks(params);
        const marksList = res.data?.marks || [];

        const newMarksMap = {};
        const newRemarksMap = {};
        marksList.forEach((m) => {
          const sId = m.student?._id || m.student;
          newMarksMap[sId] = m.obtainedMarks;
          newRemarksMap[sId] = m.remarks || '';
        });

        setMarksMap(newMarksMap);
        setRemarksMap(newRemarksMap);
        setValidationErrors({});
      } catch (err) {
        console.error('Error fetching existing marks:', err);
      }
    };

    fetchExistingMarks();
  }, [selectedAssessmentId, selectedSubject, assessmentType]);

  // Handle Assessment Selection Change
  const handleAssessmentSelect = (assId) => {
    setSelectedAssessmentId(assId);
    if (!assId) {
      setCurrentAssessment(null);
      return;
    }
    const found = assessments.find((a) => a._id === assId);
    if (found) {
      setCurrentAssessment(found);
      setMaxMarks(found.maxMarks);
      setAssessmentType(found.assessmentType);
      if (found.subject?._id) setSelectedSubject(found.subject._id);
      if (found.semester) setSemester(found.semester);
    }
  };

  // Handle Mark Change with Boundary Validation (0 <= marks <= maxMarks)
  const handleMarkChange = (studentId, value) => {
    const valNum = Number(value);
    const errors = { ...validationErrors };

    if (value === '' || isNaN(valNum)) {
      errors[studentId] = 'Required number';
    } else if (valNum < 0) {
      errors[studentId] = 'Cannot be negative (< 0)';
    } else if (valNum > maxMarks) {
      errors[studentId] = `Exceeds max marks (${maxMarks})`;
    } else {
      delete errors[studentId];
    }

    setValidationErrors(errors);
    setMarksMap((prev) => ({ ...prev, [studentId]: value === '' ? '' : valNum }));
  };

  // Create New Assessment
  const handleCreateAssessment = async (e) => {
    e.preventDefault();
    if (!newAssessment.title.trim()) {
      alert('Please enter an assessment title.');
      return;
    }
    if (Number(newAssessment.maxMarks) <= 0) {
      alert('Maximum marks must be a positive number greater than 0.');
      return;
    }

    setCreatingAssessment(true);
    try {
      const res = await apiService.createAssessment(newAssessment);
      const created = res.data?.assessment;

      // Add to list and set as current
      setAssessments((prev) => [created, ...prev]);
      handleAssessmentSelect(created._id);
      setCreateModalOpen(false);

      setSaveFeedback({
        success: true,
        message: `Assessment "${created.title}" created successfully! You can now enter student marks below.`,
      });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create assessment.');
    } finally {
      setCreatingAssessment(false);
    }
  };

  // Save / Publish Marks (Batch)
  const handleSaveMarks = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSaveFeedback(null);

    // Validate any outstanding errors
    if (Object.keys(validationErrors).length > 0) {
      setErrorMsg('Please fix invalid marks before submitting. All marks must be between 0 and maximum marks.');
      return;
    }

    // Prepare records
    const records = [];
    for (const st of students) {
      const val = marksMap[st._id];
      if (val !== undefined && val !== '') {
        const num = Number(val);
        if (num < 0 || num > maxMarks) {
          setErrorMsg(`Marks for ${st.user?.name || st.rollNumber} must be between 0 and ${maxMarks}.`);
          return;
        }
        records.push({
          studentId: st._id,
          obtainedMarks: num,
          remarks: remarksMap[st._id] || '',
        });
      }
    }

    if (records.length === 0) {
      setErrorMsg('Please enter marks for at least one student before saving.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        assessmentId: selectedAssessmentId || undefined,
        subject: selectedSubject,
        assessmentType,
        maxMarks,
        records,
      };

      const res = await apiService.enterMarksBatch(payload);

      const lowCount = records.filter((r) => (r.obtainedMarks / maxMarks) * 100 < 50).length;

      setSaveFeedback({
        success: true,
        message: `Successfully saved marks for ${records.length} students! Academic risk metrics recalculated.`,
        lowMarksCount: lowCount,
      });
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to record marks.');
    } finally {
      setSubmitting(false);
    }
  };

  // Performance Statistics from current marks
  const recordedScores = Object.values(marksMap).filter((v) => v !== '' && v !== undefined && !isNaN(v));
  const totalCount = recordedScores.length;
  const totalMarksSum = recordedScores.reduce((acc, curr) => acc + Number(curr), 0);
  const classAverageMarks = totalCount > 0 ? Math.round((totalMarksSum / totalCount) * 10) / 10 : 0;
  const classAveragePercentage = maxMarks > 0 ? Math.round((classAverageMarks / maxMarks) * 100 * 10) / 10 : 0;
  const passCount = recordedScores.filter((s) => (Number(s) / maxMarks) * 100 >= 50).length;
  const remedialCount = totalCount - passCount;
  const highestMark = totalCount > 0 ? Math.max(...recordedScores.map(Number)) : 0;
  const lowestMark = totalCount > 0 ? Math.min(...recordedScores.map(Number)) : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-400" />
            <span>Internal Assessment & Marks Module</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Create continuous evaluation assessments, record validated marks (0 - Max), and trigger automated risk recalibration.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Assessment</span>
          </button>
        </div>
      </div>

      {/* Success Banner */}
      {saveFeedback && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-white">{saveFeedback.message}</p>
            {saveFeedback.lowMarksCount > 0 && (
              <p className="text-[11px] text-amber-300 mt-0.5">
                Academic remediation warning prepared for {saveFeedback.lowMarksCount} student(s) scoring below 50%.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <p className="font-semibold text-white">{errorMsg}</p>
        </div>
      )}

      {/* Assessment Selector & Config */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
            Choose Created Assessment
          </label>
          <select
            value={selectedAssessmentId}
            onChange={(e) => handleAssessmentSelect(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-semibold"
          >
            <option value="">Manual Subject / Test Mode</option>
            {assessments.map((ass) => (
              <option key={ass._id} value={ass._id}>
                {ass.title} ({ass.assessmentType} - Max {ass.maxMarks})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Subject / Course</label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            disabled={!!currentAssessment}
            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          >
            {subjects.map((sub) => (
              <option key={sub._id} value={sub._id}>
                {sub.code} - {sub.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Assessment Type</label>
          <select
            value={assessmentType}
            onChange={(e) => setAssessmentType(e.target.value)}
            disabled={!!currentAssessment}
            className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          >
            {ASSESSMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Maximum Marks (Benchmark)</label>
          <input
            type="number"
            min="1"
            max="100"
            value={maxMarks}
            onChange={(e) => setMaxMarks(Number(e.target.value))}
            disabled={!!currentAssessment}
            className="w-full px-3 py-2 text-xs font-bold font-mono bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
          />
        </div>
      </div>

      {/* Class Performance Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <span className="text-[10px] text-slate-400 block uppercase font-semibold">Evaluated</span>
          <span className="text-base font-bold text-white font-mono">{totalCount} / {students.length}</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <span className="text-[10px] text-slate-400 block uppercase font-semibold">Class Avg Marks</span>
          <span className="text-base font-bold text-indigo-400 font-mono">{classAverageMarks} / {maxMarks}</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <span className="text-[10px] text-slate-400 block uppercase font-semibold">Class Avg %</span>
          <span className="text-base font-bold text-indigo-400 font-mono">{classAveragePercentage}%</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <span className="text-[10px] text-slate-400 block uppercase font-semibold">Pass Count (&ge;50%)</span>
          <span className="text-base font-bold text-emerald-400 font-mono">{passCount}</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <span className="text-[10px] text-slate-400 block uppercase font-semibold">Remedial (&lt;50%)</span>
          <span className="text-base font-bold text-rose-400 font-mono">{remedialCount}</span>
        </div>
        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs">
          <span className="text-[10px] text-slate-400 block uppercase font-semibold">Range (Min - Max)</span>
          <span className="text-base font-bold text-white font-mono">{lowestMark} - {highestMark}</span>
        </div>
      </div>

      {/* Marks Entry Table */}
      <form onSubmit={handleSaveMarks} className="space-y-4">
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                <th className="px-5 py-3.5">Roll No</th>
                <th className="px-5 py-3.5">Student Name</th>
                <th className="px-5 py-3.5">Obtained Marks (Max: {maxMarks})</th>
                <th className="px-5 py-3.5">Percentage</th>
                <th className="px-5 py-3.5">Academic Status</th>
                <th className="px-5 py-3.5">Faculty Feedback / Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {students.map((student) => {
                const rawVal = marksMap[student._id];
                const hasScore = rawVal !== undefined && rawVal !== '';
                const obt = hasScore ? Number(rawVal) : null;
                const error = validationErrors[student._id];
                const pct = obt !== null && maxMarks > 0 ? Math.round((obt / maxMarks) * 100 * 10) / 10 : null;
                const isRemedial = pct !== null && pct < 50;

                return (
                  <tr key={student._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-slate-400 font-semibold">{student.rollNumber}</td>
                    <td className="px-5 py-3.5 font-semibold text-white">
                      <div>{student.user?.name || student.rollNumber}</div>
                      <span className="text-[10px] text-slate-400 font-normal">{student.user?.email}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max={maxMarks}
                            step="0.5"
                            value={rawVal !== undefined ? rawVal : ''}
                            onChange={(e) => handleMarkChange(student._id, e.target.value)}
                            placeholder="0"
                            className={`w-24 px-3 py-1.5 text-xs font-bold font-mono text-center rounded-lg bg-slate-950 text-white focus:outline-none transition-all ${
                              error
                                ? 'border-2 border-rose-500 bg-rose-950/20 text-rose-200'
                                : 'border border-slate-800 focus:border-indigo-500'
                            }`}
                          />
                          <span className="text-slate-500 font-mono text-xs">/ {maxMarks}</span>
                        </div>
                        {error && (
                          <span className="text-[10px] text-rose-400 font-semibold block">
                            ⚠️ {error}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-sm">
                      {pct !== null ? (
                        <span className={isRemedial ? 'text-rose-400' : 'text-emerald-400'}>
                          {pct}%
                        </span>
                      ) : (
                        <span className="text-slate-500 italic text-xs">Not entered</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {pct !== null ? (
                        isRemedial ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Remedial Required (&lt;50%)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Pass</span>
                          </span>
                        )
                      ) : (
                        <span className="text-slate-500 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <input
                        type="text"
                        placeholder="e.g. Strong conceptual clarity"
                        value={remarksMap[student._id] || ''}
                        onChange={(e) =>
                          setRemarksMap({ ...remarksMap, [student._id]: e.target.value })
                        }
                        className="w-full max-w-xs px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-indigo-500"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-slate-400">
            Validated against maximum score ({maxMarks}). Scores &lt; 50% automatically notify parents for intervention.
          </span>
          <button
            type="submit"
            disabled={submitting || Object.keys(validationErrors).length > 0}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 active:scale-95 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Recording Marks...' : 'Publish Assessment Marks'}</span>
          </button>
        </div>
      </form>

      {/* ===================== CREATE ASSESSMENT MODAL ===================== */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Create New Assessment</h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAssessment} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Assessment Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Midterm Evaluation 1"
                  value={newAssessment.title}
                  onChange={(e) => setNewAssessment({ ...newAssessment, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Subject / Course *
                </label>
                <select
                  value={newAssessment.subject}
                  onChange={(e) => setNewAssessment({ ...newAssessment, subject: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  {subjects.map((sub) => (
                    <option key={sub._id} value={sub._id}>
                      {sub.code} - {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Assessment Type *
                  </label>
                  <select
                    value={newAssessment.assessmentType}
                    onChange={(e) =>
                      setNewAssessment({ ...newAssessment, assessmentType: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    {ASSESSMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Maximum Marks *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={newAssessment.maxMarks}
                    onChange={(e) =>
                      setNewAssessment({ ...newAssessment, maxMarks: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 font-mono font-bold bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Assessment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newAssessment.date}
                    onChange={(e) => setNewAssessment({ ...newAssessment, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Semester
                  </label>
                  <select
                    value={newAssessment.semester}
                    onChange={(e) =>
                      setNewAssessment({ ...newAssessment, semester: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="4">Semester 4</option>
                    <option value="6">Semester 6</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Description / Syllabus Covered
                </label>
                <textarea
                  rows="2"
                  value={newAssessment.description}
                  onChange={(e) =>
                    setNewAssessment({ ...newAssessment, description: e.target.value })
                  }
                  placeholder="e.g. Modules 1 and 2: Recursion, dynamic programming, and binary trees"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAssessment}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{creatingAssessment ? 'Creating...' : 'Create Assessment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyMarks;
