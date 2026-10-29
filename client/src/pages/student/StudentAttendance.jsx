import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import StatCard from '../../components/common/StatCard';
import AttendanceTrendChart from '../../components/charts/AttendanceTrendChart';
import PDFExportButton from '../../components/reports/PDFExportButton';
import apiService from '../../api/apiService';
import { SAMPLE_ATTENDANCE_SUMMARY } from '../../data/mockData';
import {
  CalendarCheck,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Filter,
  RefreshCw,
  Clock,
  ShieldAlert,
} from 'lucide-react';

const StudentAttendance = () => {
  const { user } = useAuth();
  const studentId = user?.profile?._id || user?._id || 'CS2026-001';

  const [summary, setSummary] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchAttendanceData = async () => {
    setLoading(true);
    try {
      // 1. Fetch live summary
      const summaryRes = await apiService.getAttendanceSummary(studentId);
      if (summaryRes.data?.summary) {
        setSummary(summaryRes.data.summary);
      }

      // 2. Fetch records with filters
      const params = {};
      if (selectedSubject) params.subject = selectedSubject;
      if (selectedStatus) params.status = selectedStatus;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const recordsRes = await apiService.getAttendance(params);
      if (recordsRes.data?.records) {
        setRecords(recordsRes.data.records);
      }
    } catch (err) {
      console.warn('Using fallback attendance data:', err);
      if (!summary) {
        setSummary(SAMPLE_ATTENDANCE_SUMMARY);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceData();
  }, [studentId, selectedSubject, selectedStatus, startDate, endDate]);

  const activeSummary = summary || SAMPLE_ATTENDANCE_SUMMARY;
  const threshold = activeSummary.attendanceThreshold || 75;
  const isShortage = activeSummary.overallPercentage < threshold;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-indigo-400" />
            <span>My Academic Attendance Records</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Institutional examination eligibility requires a minimum aggregate of {threshold}% attendance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PDFExportButton
            reportType="attendance"
            studentId={studentId}
            btnText="Export Attendance PDF"
            className="py-1.5 text-xs"
          />
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
              isShortage
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {isShortage ? (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Attendance Deficit Warning (&lt;{threshold}%)</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Exam Eligible (&ge;{threshold}%)</span>
              </>
            )}
          </span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Overall Attendance"
          value={`${activeSummary.overallPercentage}%`}
          subtext={isShortage ? `Below required ${threshold}% policy benchmark` : `Above mandatory ${threshold}% limit`}
          icon={CalendarCheck}
          color={isShortage ? 'rose' : 'emerald'}
        />
        <StatCard
          title="Total Classes Conducted"
          value={activeSummary.totalClasses?.toString() || '0'}
          subtext="Official lectures recorded"
          icon={BookOpen}
          color="indigo"
        />
        <StatCard
          title="Sessions Attended"
          value={activeSummary.presentClasses?.toString() || '0'}
          subtext="Present, Excused & On-Duty"
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Absences Recorded"
          value={activeSummary.absentClasses?.toString() || '0'}
          subtext="Sessions missed"
          icon={AlertTriangle}
          color="amber"
        />
      </div>

      {/* Attendance Trends */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
        <h3 className="text-sm font-bold text-white tracking-wide mb-1">Monthly Attendance Trend</h3>
        <p className="text-xs text-slate-400 mb-4">Tracking semester attendance compliance over time</p>
        <AttendanceTrendChart />
      </div>

      {/* Subject-Wise Attendance Breakdown Table */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Course-Wise Attendance Breakdown</h3>
            <p className="text-xs text-slate-400">Aggregate session tracking per enrolled course</p>
          </div>
          <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            Eligibility Benchmark: <strong>{threshold}%</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase text-slate-400 bg-slate-950/40">
                <th className="py-2.5 px-3">Subject / Course</th>
                <th className="py-2.5 px-3">Total Sessions</th>
                <th className="py-2.5 px-3">Attended</th>
                <th className="py-2.5 px-3">Missed</th>
                <th className="py-2.5 px-3">Attendance %</th>
                <th className="py-2.5 px-3">Examination Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {activeSummary.subjectStats && activeSummary.subjectStats.map((item, idx) => {
                const subShortage = item.percentage < threshold;
                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-white">
                      <div>{item.subject}</div>
                      {item.code && <span className="text-[10px] text-slate-400 font-mono">{item.code}</span>}
                    </td>
                    <td className="py-3 px-3 font-mono">{item.total}</td>
                    <td className="py-3 px-3 font-mono text-emerald-400 font-bold">{item.present}</td>
                    <td className="py-3 px-3 font-mono text-rose-400">{item.absent}</td>
                    <td className="py-3 px-3 font-bold text-slate-200">
                      <span className={subShortage ? 'text-rose-400 font-bold text-sm' : 'text-emerald-400 font-bold text-sm'}>
                        {item.percentage}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          subShortage
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {subShortage ? `Shortage (<${threshold}%)` : 'Eligible'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Date & Subject Filterable Session History Table */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Detailed Session Attendance Logs</h3>
            <p className="text-xs text-slate-400">Filter daily classroom records by date and course</p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1">Subject</label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Subjects</option>
              {activeSummary.subjectStats?.map((s, i) => (
                <option key={i} value={s.subject}>
                  {s.subject}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Late">Late</option>
              <option value="Excused">Excused</option>
              <option value="On Duty">On Duty</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-semibold text-slate-400 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Detailed Logs List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase text-slate-400">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Course</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Faculty / Remarks</th>
                <th className="py-2.5 px-3 text-right">Audit History</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {records.length > 0 ? (
                records.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-mono text-slate-400">{r.dateStr || new Date(r.date).toISOString().split('T')[0]}</td>
                    <td className="py-3 px-3 font-semibold text-white">{r.subject?.name || 'Course'}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'Present'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : r.status === 'Absent'
                            ? 'bg-rose-500/20 text-rose-400'
                            : r.status === 'Late'
                            ? 'bg-amber-500/20 text-amber-400'
                            : r.status === 'On Duty'
                            ? 'bg-cyan-500/20 text-cyan-400'
                            : 'bg-purple-500/20 text-purple-400'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-400">{r.remarks || '—'}</td>
                    <td className="py-3 px-3 text-right">
                      {r.auditTrail && r.auditTrail.length > 0 ? (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          {r.auditTrail.length} correction revision(s)
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600">Original entry</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="py-6 text-center text-slate-500">
                    No session attendance records matched the filter parameters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StudentAttendance;
