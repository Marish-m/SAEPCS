import React, { useState, useEffect } from 'react';
import apiService from '../../api/apiService';
import {
  CalendarCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Save,
  AlertCircle,
  AlertTriangle,
  CheckCheck,
  History,
  ShieldCheck,
  Filter,
  Search,
  Eye,
  RefreshCw,
  FileText,
  BadgeAlert,
  ArrowRight,
} from 'lucide-react';

const APPROVED_STATUSES = ['Present', 'Absent', 'Late', 'Excused', 'On Duty'];

const FacultyAttendance = () => {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState('record'); // 'record' | 'history'

  // Form Controls
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [semester, setSemester] = useState(4);
  const [section, setSection] = useState('A');

  // Students & Attendance Maps
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [remarksMap, setRemarksMap] = useState({});
  const [existingSession, setExistingSession] = useState(null); // { isMarked, count, records }

  // UI state
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alertResult, setAlertResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Correction Modal State
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState(null);
  const [correctionStatus, setCorrectionStatus] = useState('Present');
  const [correctionRemarks, setCorrectionRemarks] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correcting, setCorrecting] = useState(false);

  // Audit Trail Detail Drawer / Modal
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditRecord, setAuditRecord] = useState(null);

  // History Tab Filters & State
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyStudentSummary, setHistoryStudentSummary] = useState([]);
  const [historySubjectSummary, setHistorySubjectSummary] = useState([]);
  const [historyFilterSubject, setHistoryFilterSubject] = useState('');
  const [historyFilterStudent, setHistoryFilterStudent] = useState('');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [historyFilterStatus, setHistoryFilterStatus] = useState('');
  const [historySubTab, setHistorySubTab] = useState('students'); // 'students' | 'subjects' | 'logs'
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeThreshold, setActiveThreshold] = useState(75);

  // 1. Fetch Subjects and Risk Threshold
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [subRes, riskSettingsRes] = await Promise.allSettled([
          apiService.getSubjects(),
          apiService.getRiskSettings(),
        ]);

        if (subRes.status === 'fulfilled' && subRes.value.data?.subjects) {
          const list = subRes.value.data.subjects;
          setSubjects(list);
          if (list.length > 0) {
            setSelectedSubject(list[0]._id);
          }
        }

        if (riskSettingsRes.status === 'fulfilled' && riskSettingsRes.value.data?.settings) {
          setActiveThreshold(riskSettingsRes.value.data.settings.attendanceThreshold || 75);
        }
      } catch (err) {
        console.error('Error loading initial subjects/settings:', err);
      }
    };
    fetchInitialData();
  }, []);

  // 2. Fetch Students for Selected Class
  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const res = await apiService.getStudents({ semester });
        const studentList = res.data?.students || [];
        setStudents(studentList);

        // Reset attendance status map
        const initialMap = {};
        studentList.forEach((st) => {
          initialMap[st._id] = 'Present';
        });
        setAttendanceMap(initialMap);
      } catch (err) {
        console.error('Failed to load students:', err);
        setErrorMsg('Unable to load students from server. Please verify connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, [semester, section]);

  // 3. Check for Existing Attendance Session to Prevent Duplicates
  useEffect(() => {
    const checkSession = async () => {
      if (!selectedSubject || !date) return;
      try {
        const res = await apiService.checkAttendance({
          subject: selectedSubject,
          date,
        });
        if (res.data?.isMarked) {
          setExistingSession(res.data);
          // If session exists, prefill remarks and statuses from database
          const existingMap = {};
          const existingRem = {};
          res.data.records.forEach((r) => {
            const sId = r.student?._id || r.student;
            existingMap[sId] = r.status;
            existingRem[sId] = r.remarks || '';
          });
          setAttendanceMap((prev) => ({ ...prev, ...existingMap }));
          setRemarksMap((prev) => ({ ...prev, ...existingRem }));
        } else {
          setExistingSession(null);
        }
      } catch {
        setExistingSession(null);
      }
    };

    checkSession();
  }, [selectedSubject, date]);

  // 4. Fetch History Records when History Tab is Activated
  const fetchAttendanceHistory = async () => {
    setHistoryLoading(true);
    try {
      const params = {};
      if (historyFilterSubject) params.subject = historyFilterSubject;
      if (historyFilterStudent) params.studentId = historyFilterStudent;
      if (historyStartDate) params.startDate = historyStartDate;
      if (historyEndDate) params.endDate = historyEndDate;
      if (historyFilterStatus) params.status = historyFilterStatus;
      if (semester) params.semester = semester;

      const res = await apiService.getAttendanceHistory(params);
      if (res.data) {
        setHistoryRecords(res.data.records || []);
        setHistoryStudentSummary(res.data.studentSummary || []);
        setHistorySubjectSummary(res.data.subjectSummary || []);
        if (res.data.threshold) setActiveThreshold(res.data.threshold);
      }
    } catch (err) {
      console.error('Error fetching attendance history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchAttendanceHistory();
    }
  }, [activeTab, historyFilterSubject, historyFilterStudent, historyStartDate, historyEndDate, historyFilterStatus]);

  // Batch Status Helpers
  const setStatus = (studentId, status) => {
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const markAll = (status) => {
    const updated = {};
    students.forEach((st) => {
      updated[st._id] = status;
    });
    setAttendanceMap(updated);
  };

  // Submit Attendance (With Duplicate Prevention)
  const handleSaveAttendance = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setAlertResult(null);

    if (existingSession && existingSession.isMarked) {
      setErrorMsg(
        `Duplicate entry prevented: Attendance for this subject and date (${existingSession.dateStr}) is already marked. Please use the Correction feature below to modify existing records with an audit trail.`
      );
      return;
    }

    setSubmitting(true);

    const records = students.map((st) => ({
      studentId: st._id,
      status: attendanceMap[st._id] || 'Present',
      remarks: remarksMap[st._id] || '',
    }));

    try {
      const res = await apiService.markAttendance({
        subject: selectedSubject,
        date,
        semester,
        section,
        records,
      });

      setAlertResult({
        success: true,
        message: `Attendance marked successfully for ${records.length} students!`,
        alertsTriggered: res.data?.alertsTriggered || 0,
      });

      // Re-check session state
      const checkRes = await apiService.checkAttendance({ subject: selectedSubject, date });
      if (checkRes.data?.isMarked) {
        setExistingSession(checkRes.data);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to record attendance.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Correction Modal
  const openCorrection = (record) => {
    setSelectedRecordForCorrection(record);
    setCorrectionStatus(record.status);
    setCorrectionRemarks(record.remarks || '');
    setCorrectionReason('');
    setCorrectionModalOpen(true);
  };

  // Submit Attendance Correction (With Audit Trail)
  const handleCorrectAttendance = async (e) => {
    e.preventDefault();
    if (!selectedRecordForCorrection) return;

    if (!correctionReason.trim() || correctionReason.trim().length < 3) {
      alert('Please provide a descriptive reason for attendance correction (minimum 3 characters) to record in the audit trail.');
      return;
    }

    setCorrecting(true);
    try {
      const res = await apiService.correctAttendance(selectedRecordForCorrection._id, {
        status: correctionStatus,
        remarks: correctionRemarks,
        reason: correctionReason.trim(),
      });

      // Update local state in existingSession
      if (existingSession?.records) {
        const updatedRecords = existingSession.records.map((r) =>
          r._id === selectedRecordForCorrection._id ? res.data.record : r
        );
        setExistingSession({ ...existingSession, records: updatedRecords });
        setAttendanceMap((prev) => ({ ...prev, [selectedRecordForCorrection.student._id]: correctionStatus }));
      }

      // Update history records if open
      setHistoryRecords((prev) =>
        prev.map((r) => (r._id === selectedRecordForCorrection._id ? res.data.record : r))
      );

      setAlertResult({
        success: true,
        message: `Correction logged successfully with audit trail! Status changed to ${correctionStatus}.`,
      });
      setCorrectionModalOpen(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit correction.');
    } finally {
      setCorrecting(false);
    }
  };

  // Calculations
  const totalPresent = Object.values(attendanceMap).filter(
    (s) => s === 'Present' || s === 'Excused' || s === 'On Duty'
  ).length;
  const totalAbsent = Object.values(attendanceMap).filter((s) => s === 'Absent').length;
  const totalLate = Object.values(attendanceMap).filter((s) => s === 'Late').length;
  const totalOnDuty = Object.values(attendanceMap).filter((s) => s === 'On Duty').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Tab Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-indigo-400" />
            <span>Attendance Management Module</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Record class sessions, prevent duplicate entries, correct records with an audit trail, and track shortage alerts ({`< ${activeThreshold}%`}).
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('record')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'record'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Mark / Correct Session</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Attendance History & Logs</span>
          </button>
        </div>
      </div>

      {/* ===================== TAB 1: RECORD & CORRECT SESSION ===================== */}
      {activeTab === 'record' && (
        <div className="space-y-6">
          {/* Duplicate Session Notice / Warning Banner */}
          {existingSession && existingSession.isMarked && (
            <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white text-sm">Session Attendance Already Recorded</h4>
                  <p className="text-slate-300 mt-0.5">
                    Attendance for <strong>{existingSession.subject?.name}</strong> on <strong>{existingSession.dateStr}</strong> is already stored ({existingSession.count} records). Duplicate re-entry is blocked by database policy.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Correction Mode Active</span>
              </span>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Success Banner */}
          {alertResult && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">{alertResult.message}</p>
                {alertResult.alertsTriggered > 0 && (
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Triggered {alertResult.alertsTriggered} automated parental deficit notifications.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Session Configuration Bar */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Subject / Course</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                {subjects.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.code} - {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Session Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
              </input>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Semester & Section</label>
              <div className="flex gap-2">
                <select
                  value={semester}
                  onChange={(e) => setSemester(Number(e.target.value))}
                  className="w-1/2 px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="4">Semester 4</option>
                  <option value="6">Semester 6</option>
                  <option value="8">Semester 8</option>
                </select>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-1/2 px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="A">Sec A</option>
                  <option value="B">Sec B</option>
                </select>
              </div>
            </div>

            {/* Live Counters */}
            <div className="flex items-center justify-around p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
              <div className="text-center">
                <span className="block font-bold text-emerald-400 text-sm">{totalPresent}</span>
                <span className="text-[10px] text-slate-400 uppercase">Attended</span>
              </div>
              <div className="text-center">
                <span className="block font-bold text-rose-400 text-sm">{totalAbsent}</span>
                <span className="text-[10px] text-slate-400 uppercase">Absent</span>
              </div>
              <div className="text-center">
                <span className="block font-bold text-amber-400 text-sm">{totalLate}</span>
                <span className="text-[10px] text-slate-400 uppercase">Late</span>
              </div>
              <div className="text-center">
                <span className="block font-bold text-cyan-400 text-sm">{totalOnDuty}</span>
                <span className="text-[10px] text-slate-400 uppercase">On Duty</span>
              </div>
            </div>
          </div>

          {/* Quick Action Tools */}
          {!existingSession?.isMarked && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-400">
                Marking <strong>{students.length}</strong> students for semester {semester} (Section {section})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => markAll('Present')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark All Present</span>
                </button>
                <button
                  type="button"
                  onClick={() => markAll('Absent')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Mark All Absent</span>
                </button>
              </div>
            </div>
          )}

          {/* Student Table */}
          <form onSubmit={handleSaveAttendance} className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="px-5 py-3.5">Roll No</th>
                    <th className="px-5 py-3.5">Student Name</th>
                    <th className="px-5 py-3.5">Attendance Status</th>
                    <th className="px-5 py-3.5">Remarks</th>
                    <th className="px-5 py-3.5 text-right">Actions / Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {students.map((student) => {
                    const currentStatus = attendanceMap[student._id] || 'Present';
                    // Check if this student has an existing record in current session
                    const existingRecord = existingSession?.records?.find(
                      (r) => (r.student?._id || r.student) === student._id
                    );
                    const auditCount = existingRecord?.auditTrail?.length || 0;

                    return (
                      <tr key={student._id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-slate-400 font-semibold">
                          {student.rollNumber}
                        </td>
                        <td className="px-5 py-3.5 font-semibold text-white">
                          <div>{student.user?.name || student.rollNumber}</div>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {student.user?.email}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {existingSession?.isMarked ? (
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                                  currentStatus === 'Present'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : currentStatus === 'Absent'
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : currentStatus === 'Late'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : currentStatus === 'On Duty'
                                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                                    : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                }`}
                              >
                                {currentStatus}
                              </span>
                              {existingRecord && (
                                <button
                                  type="button"
                                  onClick={() => openCorrection(existingRecord)}
                                  className="text-[11px] text-indigo-400 hover:text-indigo-300 underline font-medium"
                                >
                                  Correct
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {APPROVED_STATUSES.map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => setStatus(student._id, st)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                    currentStatus === st
                                      ? st === 'Present'
                                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                                        : st === 'Absent'
                                        ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                                        : st === 'Late'
                                        ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                                        : st === 'On Duty'
                                        ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                                        : 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                                      : 'bg-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {existingSession?.isMarked ? (
                            <span className="text-slate-400 italic">
                              {remarksMap[student._id] || '—'}
                            </span>
                          ) : (
                            <input
                              type="text"
                              placeholder="Optional session notes..."
                              value={remarksMap[student._id] || ''}
                              onChange={(e) =>
                                setRemarksMap({ ...remarksMap, [student._id]: e.target.value })
                              }
                              className="w-full max-w-xs px-2.5 py-1 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 focus:outline-none focus:border-indigo-500"
                            />
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {existingRecord ? (
                            <div className="flex items-center justify-end gap-2">
                              {auditCount > 0 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAuditRecord(existingRecord);
                                    setAuditModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-amber-500/20 hover:bg-slate-700"
                                >
                                  <ShieldCheck className="w-3 h-3 text-amber-400" />
                                  <span>{auditCount} Audit{auditCount > 1 ? 's' : ''}</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openCorrection(existingRecord)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-all"
                              >
                                Correct
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-[11px]">Pending submission</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Save Bar */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-400">
                {existingSession?.isMarked
                  ? 'Attendance saved for this session. Use "Correct" button on individual rows to revise records.'
                  : 'Once submitted, duplicate entries for this session date are prevented.'}
              </span>
              {!existingSession?.isMarked && (
                <button
                  type="submit"
                  disabled={submitting || students.length === 0}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'Saving Records...' : 'Save & Submit Attendance'}</span>
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ===================== TAB 2: ATTENDANCE HISTORY & LOGS ===================== */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          {/* History Filter Bar */}
          <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Subject Filter</label>
              <select
                value={historyFilterSubject}
                onChange={(e) => setHistoryFilterSubject(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Subjects</option>
                {subjects.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.code} - {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Status Filter</label>
              <select
                value={historyFilterStatus}
                onChange={(e) => setHistoryFilterStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Statuses</option>
                {APPROVED_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Date Range (Start to End)</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={historyStartDate}
                  onChange={(e) => setHistoryStartDate(e.target.value)}
                  className="w-1/2 px-2 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="date"
                  value={historyEndDate}
                  onChange={(e) => setHistoryEndDate(e.target.value)}
                  className="w-1/2 px-2 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={fetchAttendanceHistory}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-all border border-slate-700"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
                <span>Apply Filters</span>
              </button>
            </div>
          </div>

          {/* Sub Tab Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
            <button
              onClick={() => setHistorySubTab('students')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                historySubTab === 'students'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Student-Wise Performance ({historyStudentSummary.length})
            </button>
            <button
              onClick={() => setHistorySubTab('subjects')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                historySubTab === 'subjects'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Subject-Wise Breakdown ({historySubjectSummary.length})
            </button>
            <button
              onClick={() => setHistorySubTab('logs')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                historySubTab === 'logs'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Session Records & Audit Logs ({historyRecords.length})
            </button>
          </div>

          {/* Sub Tab 1: Student-Wise Performance */}
          {historySubTab === 'students' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="px-5 py-3.5">Roll No</th>
                    <th className="px-5 py-3.5">Student Name</th>
                    <th className="px-5 py-3.5 font-mono">Total Classes</th>
                    <th className="px-5 py-3.5 font-mono text-emerald-400">Attended</th>
                    <th className="px-5 py-3.5 font-mono text-rose-400">Absent</th>
                    <th className="px-5 py-3.5 font-mono text-amber-400">Late</th>
                    <th className="px-5 py-3.5 font-mono text-cyan-400">On Duty</th>
                    <th className="px-5 py-3.5 font-bold">Attendance %</th>
                    <th className="px-5 py-3.5">Risk Standing</th>
                    <th className="px-5 py-3.5">Audit Trail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {historyStudentSummary.map((st) => {
                    const isShortage = st.percentage < activeThreshold;
                    return (
                      <tr key={st.studentId} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-slate-400 font-semibold">{st.rollNumber}</td>
                        <td className="px-5 py-3.5 font-semibold text-white">{st.name}</td>
                        <td className="px-5 py-3.5 font-mono">{st.total}</td>
                        <td className="px-5 py-3.5 font-mono text-emerald-400 font-bold">{st.present}</td>
                        <td className="px-5 py-3.5 font-mono text-rose-400">{st.absent}</td>
                        <td className="px-5 py-3.5 font-mono text-amber-400">{st.late}</td>
                        <td className="px-5 py-3.5 font-mono text-cyan-400">{st.onDuty}</td>
                        <td className="px-5 py-3.5 font-bold text-sm">
                          <span className={isShortage ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                            {st.percentage}%
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {isShortage ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Shortage Alert ({`< ${activeThreshold}%`})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Eligible ({`>= ${activeThreshold}%`})</span>
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          {st.correctionsCount > 0 ? (
                            <span className="text-[11px] text-amber-400 font-semibold">
                              {st.correctionsCount} correction(s)
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">No revisions</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Sub Tab 2: Subject-Wise Breakdown */}
          {historySubTab === 'subjects' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="px-5 py-3.5">Subject Code</th>
                    <th className="px-5 py-3.5">Subject Name</th>
                    <th className="px-5 py-3.5 font-mono">Total Recorded Sessions</th>
                    <th className="px-5 py-3.5 font-mono text-emerald-400">Total Attended Entries</th>
                    <th className="px-5 py-3.5 font-bold">Class Average %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {historySubjectSummary.map((sub) => (
                    <tr key={sub.subjectId} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-slate-400 font-bold">{sub.code}</td>
                      <td className="px-5 py-3.5 font-semibold text-white">{sub.name}</td>
                      <td className="px-5 py-3.5 font-mono">{sub.total}</td>
                      <td className="px-5 py-3.5 font-mono text-emerald-400 font-bold">{sub.present}</td>
                      <td className="px-5 py-3.5 font-bold text-sm">
                        <span className={sub.percentage < activeThreshold ? 'text-amber-400' : 'text-emerald-400'}>
                          {sub.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Sub Tab 3: Detailed Session Logs & Audit Trail */}
          {historySubTab === 'logs' && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Subject</th>
                    <th className="px-5 py-3.5">Student</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Remarks</th>
                    <th className="px-5 py-3.5 text-right">Audit Trail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {historyRecords.map((rec) => {
                    const audits = rec.auditTrail || [];
                    return (
                      <tr key={rec._id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-slate-400">{rec.dateStr}</td>
                        <td className="px-5 py-3.5 font-semibold text-white">
                          {rec.subject?.code} - {rec.subject?.name}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-white block">
                            {rec.student?.user?.name || rec.student?.rollNumber}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {rec.student?.rollNumber}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rec.status === 'Present'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : rec.status === 'Absent'
                                ? 'bg-rose-500/20 text-rose-400'
                                : rec.status === 'Late'
                                ? 'bg-amber-500/20 text-amber-400'
                                : rec.status === 'On Duty'
                                ? 'bg-cyan-500/20 text-cyan-400'
                                : 'bg-purple-500/20 text-purple-400'
                            }`}
                          >
                            {rec.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-400 italic">{rec.remarks || '—'}</td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {audits.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAuditRecord(rec);
                                  setAuditModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>{audits.length} Revision{audits.length > 1 ? 's' : ''}</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openCorrection(rec)}
                              className="px-2 py-1 text-xs rounded-lg bg-slate-800 text-indigo-300 hover:bg-slate-700"
                            >
                              Correct
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================== CORRECTION MODAL (AUDIT TRAIL REQUIRED) ===================== */}
      {correctionModalOpen && selectedRecordForCorrection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Attendance Correction & Audit Logging</h3>
              </div>
              <button
                type="button"
                onClick={() => setCorrectionModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">Student:</span>
                <span className="font-bold text-white">
                  {selectedRecordForCorrection.student?.user?.name ||
                    selectedRecordForCorrection.student?.rollNumber} ({selectedRecordForCorrection.student?.rollNumber})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Date & Course:</span>
                <span className="text-white">
                  {selectedRecordForCorrection.dateStr} • {selectedRecordForCorrection.subject?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Current Status:</span>
                <span className="font-bold text-amber-400">{selectedRecordForCorrection.status}</span>
              </div>
            </div>

            <form onSubmit={handleCorrectAttendance} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Corrected Attendance Status *
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {APPROVED_STATUSES.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setCorrectionStatus(st)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        correctionStatus === st
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Updated Session Remarks
                </label>
                <input
                  type="text"
                  value={correctionRemarks}
                  onChange={(e) => setCorrectionRemarks(e.target.value)}
                  placeholder="e.g. Lab experiment verified"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-rose-300 mb-1 flex items-center gap-1">
                  <span>Reason for Attendance Correction (Mandatory Audit Requirement) *</span>
                </label>
                <textarea
                  rows="3"
                  required
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Student submitted medical certificate verified by campus health clinic on 2026-10-12."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-600"
                />
                <span className="text-[10px] text-slate-500">
                  This justification is permanently stored in the compliance audit trail alongside your faculty identity.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCorrectionModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={correcting || !correctionReason.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 active:scale-95 transition-all disabled:opacity-50"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{correcting ? 'Logging Correction...' : 'Save & Record Audit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== AUDIT TRAIL LOG VIEWER MODAL ===================== */}
      {auditModalOpen && auditRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Attendance Record Audit Trail</h3>
              </div>
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <p className="font-semibold text-white">
                {auditRecord.student?.user?.name || auditRecord.student?.rollNumber} • {auditRecord.subject?.name}
              </p>
              <p className="text-slate-400 text-[11px]">
                Date: {auditRecord.dateStr} • Current Status: <strong>{auditRecord.status}</strong>
              </p>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {auditRecord.auditTrail && auditRecord.auditTrail.length > 0 ? (
                auditRecord.auditTrail.map((audit, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                        <span className="line-through text-rose-400">{audit.previousStatus}</span>
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                        <span className="text-emerald-400 font-bold">{audit.newStatus}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(audit.correctedAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-slate-300 text-[11px]">
                      <strong>Reason:</strong> {audit.reason}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                      <span>Corrected by: {audit.correctedByName || audit.correctedBy?.name || 'Authorized Faculty'}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-xs">No corrections recorded for this attendance entry.</p>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setAuditModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-800 text-white hover:bg-slate-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FacultyAttendance;
