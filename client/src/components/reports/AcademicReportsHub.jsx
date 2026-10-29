import React, { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck,
  Award,
  ClipboardList,
  CheckCircle,
  AlertTriangle,
  Bell,
  FileText,
  Filter,
  RefreshCw,
  Search,
  X,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  GraduationCap,
} from 'lucide-react';
import StatCard from '../common/StatCard';
import RiskBadge from '../common/RiskBadge';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import AlertBanner from '../common/AlertBanner';
import AttendanceTrendChart from '../charts/AttendanceTrendChart';
import MarksComparisonChart from '../charts/MarksComparisonChart';
import RiskDoughnutChart from '../charts/RiskDoughnutChart';
import PDFExportButton from './PDFExportButton';
import apiService from '../../api/apiService';

const AcademicReportsHub = ({ role = 'admin', currentStudent = null }) => {
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'marks' | 'assignments' | 'leaves' | 'risks' | 'notifications' | 'transcript'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Dropdown options
  const [studentsList, setStudentsList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);

  // Filter States
  const [selectedStudentId, setSelectedStudentId] = useState(currentStudent?._id || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterRiskType, setFilterRiskType] = useState('All');
  const [filterChannel, setFilterChannel] = useState('All');

  // Report Data
  const [reportData, setReportData] = useState(null);
  const [transcriptData, setTranscriptData] = useState(null);

  // Sync if currentStudent prop changes
  useEffect(() => {
    if (currentStudent?._id) {
      setSelectedStudentId(currentStudent._id);
    }
  }, [currentStudent]);

  // Load students & subjects for filter dropdowns (admin & faculty only)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        if (role === 'admin' || role === 'faculty') {
          const [stRes, subRes] = await Promise.all([
            apiService.getStudents().catch(() => ({ data: { students: [] } })),
            apiService.getSubjects().catch(() => ({ data: { subjects: [] } })),
          ]);

          if (stRes.data?.students) {
            setStudentsList(stRes.data.students);
          }
          if (subRes.data?.subjects) {
            setSubjectsList(subRes.data.subjects);
          }
        }
      } catch (err) {
        console.warn('Failed to load filter metadata:', err.message);
      }
    };
    fetchMetadata();
  }, [role]);

  // Main fetch function based on activeTab
  const fetchActiveReport = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    setReportData(null);

    const baseParams = {};
    if (selectedStudentId) baseParams.studentId = selectedStudentId;
    if (selectedSubjectId) baseParams.subjectId = selectedSubjectId;
    if (selectedDepartment) baseParams.departmentId = selectedDepartment;
    if (startDate) baseParams.startDate = startDate;
    if (endDate) baseParams.endDate = endDate;

    try {
      let res;
      switch (activeTab) {
        case 'attendance': {
          res = await apiService.getAttendanceReport(baseParams);
          setReportData(res.data);
          break;
        }
        case 'marks': {
          const params = { ...baseParams };
          if (filterStatus !== 'All') params.examType = filterStatus;
          res = await apiService.getMarksReport(params);
          setReportData(res.data);
          break;
        }
        case 'assignments': {
          const params = { ...baseParams };
          if (filterStatus !== 'All') params.status = filterStatus;
          res = await apiService.getAssignmentsReport(params);
          setReportData(res.data);
          break;
        }
        case 'leaves': {
          const params = { ...baseParams };
          if (filterStatus !== 'All') params.status = filterStatus;
          res = await apiService.getLeavesReport(params);
          setReportData(res.data);
          break;
        }
        case 'risks': {
          const params = { ...baseParams };
          if (filterSeverity !== 'All') params.severity = filterSeverity;
          if (filterRiskType !== 'All') params.riskType = filterRiskType;
          if (filterStatus !== 'All') params.status = filterStatus;
          res = await apiService.getRisksReport(params);
          setReportData(res.data);
          break;
        }
        case 'notifications': {
          const params = { ...baseParams };
          if (filterChannel !== 'All') params.channel = filterChannel;
          if (filterStatus !== 'All') params.status = filterStatus;
          res = await apiService.getNotificationsReport(params);
          setReportData(res.data);
          break;
        }
        case 'transcript': {
          // If no specific student selected, pick first from list
          const targetId = selectedStudentId || currentStudent?._id || studentsList[0]?._id;
          if (targetId) {
            res = await apiService.getStudentReport(targetId);
            setTranscriptData(res.data?.report || null);
          } else {
            setTranscriptData(null);
          }
          break;
        }
        default:
          break;
      }
    } catch (err) {
      console.error('Report fetch error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to retrieve report data.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    selectedStudentId,
    selectedSubjectId,
    selectedDepartment,
    startDate,
    endDate,
    filterStatus,
    filterSeverity,
    filterRiskType,
    filterChannel,
    currentStudent,
    studentsList,
  ]);

  useEffect(() => {
    fetchActiveReport();
  }, [fetchActiveReport]);

  const handleResetFilters = () => {
    setSelectedSubjectId('');
    setSelectedDepartment('');
    setStartDate('');
    setEndDate('');
    setFilterStatus('All');
    setFilterSeverity('All');
    setFilterRiskType('All');
    setFilterChannel('All');
    if (!currentStudent) {
      setSelectedStudentId('');
    }
  };

  const tabsConfig = [
    { id: 'attendance', label: 'Attendance Audit', icon: CalendarCheck, desc: 'Date-range & subject trends' },
    { id: 'marks', label: 'Internal Marks', icon: Award, desc: 'Assessment scores & averages' },
    { id: 'assignments', label: 'Coursework & Missing', icon: ClipboardList, desc: 'Submissions & overdue tasks' },
    { id: 'leaves', label: 'Leave History', icon: CheckCircle, desc: 'Applications & approved days' },
    { id: 'risks', label: 'Academic Risks', icon: AlertTriangle, desc: 'Audit trail & severity alerts' },
    { id: 'notifications', label: 'Parent Communication', icon: Bell, desc: 'Email, SMS & voice logs' },
    { id: 'transcript', label: 'Consolidated Transcript', icon: FileText, desc: 'Official student transcript' },
  ];

  // Resolve selected student object
  const activeStudentDoc =
    studentsList.find((s) => s._id === selectedStudentId) ||
    currentStudent ||
    (transcriptData?.student ? transcriptData.student : null);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header & Global Export Action */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </span>
            Academic Reporting & Institutional Analytics
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time compliance tracking, assessment metrics, deficit audits, and authorized PDF generation.
          </p>
        </div>

        {/* Global PDF Download for Active Tab */}
        <div className="flex items-center gap-2 self-stretch md:self-auto justify-end">
          <PDFExportButton
            reportType={activeTab === 'transcript' ? 'comprehensive' : activeTab}
            student={activeStudentDoc}
            customData={activeTab === 'transcript' ? transcriptData : reportData}
            filters={{
              department: selectedDepartment,
              subject: subjectsList.find((s) => s._id === selectedSubjectId)?.name,
              startDate,
              endDate,
              status: filterStatus !== 'All' ? filterStatus : undefined,
              severity: filterSeverity !== 'All' ? filterSeverity : undefined,
            }}
            btnText={`Export ${tabsConfig.find((t) => t.id === activeTab)?.label} PDF`}
          />
        </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        {tabsConfig.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setFilterStatus('All');
              }}
              className={`p-3 rounded-2xl text-left border transition-all ${
                isActive
                  ? 'bg-indigo-600/15 border-indigo-500/50 text-white shadow-lg shadow-indigo-600/10'
                  : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span className="text-xs font-bold truncate">{tab.label}</span>
              </div>
              <p className="text-[10px] text-slate-400 truncate hidden sm:block">{tab.desc}</p>
            </button>
          );
        })}
      </div>

      {/* 3. Universal Multi-Facet Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span>Audit & Report Filters</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] font-semibold text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800"
            >
              <X className="w-3 h-3" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={fetchActiveReport}
              disabled={loading}
              className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          {/* Student Filter (For Admin & Faculty, or if not locked) */}
          {(role === 'admin' || role === 'faculty') && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Student
              </label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Students (Cohort)</option>
                {studentsList.map((st) => (
                  <option key={st._id} value={st._id}>
                    {st.user?.name || st.name} ({st.rollNumber})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Department Filter (Admin only) */}
          {role === 'admin' && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Department
              </label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Departments</option>
                <option value="Computer Science & Engineering">CSE</option>
                <option value="Information Technology">IT</option>
                <option value="Electronics & Communication">ECE</option>
                <option value="Mechanical Engineering">MECH</option>
              </select>
            </div>
          )}

          {/* Subject Filter (Relevant for attendance, marks, assignments) */}
          {(activeTab === 'attendance' || activeTab === 'marks' || activeTab === 'assignments') && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Subject
              </label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Subjects</option>
                {subjectsList.map((sub) => (
                  <option key={sub._id} value={sub._id}>
                    {sub.name} ({sub.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range Start (Relevant for attendance, leaves, notifications) */}
          {(activeTab === 'attendance' || activeTab === 'leaves' || activeTab === 'notifications') && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* Date Range End */}
          {(activeTab === 'attendance' || activeTab === 'leaves' || activeTab === 'notifications') && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          {/* Contextual Status / Exam Type / Severity Filter */}
          {activeTab === 'marks' && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Assessment Type
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="All">All Assessments</option>
                <option value="Internal 1">Internal 1</option>
                <option value="Internal 2">Internal 2</option>
                <option value="Model Exam">Model Exam</option>
                <option value="Assignment">Assignment</option>
              </select>
            </div>
          )}

          {activeTab === 'assignments' && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Submission Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="All">All Statuses</option>
                <option value="Submitted">Submitted</option>
                <option value="Graded">Graded</option>
                <option value="Missing">Missing (Overdue)</option>
                <option value="Late">Late</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
          )}

          {activeTab === 'leaves' && (
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Approval Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="All">All Statuses</option>
                <option value="Approved">Approved</option>
                <option value="Pending">Pending</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          )}

          {activeTab === 'risks' && (
            <>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Severity Level
                </label>
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Severities</option>
                  <option value="High">High (Critical)</option>
                  <option value="Medium">Medium (Moderate)</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Risk Category
                </label>
                <select
                  value={filterRiskType}
                  onChange={(e) => setFilterRiskType(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Categories</option>
                  <option value="Attendance">Attendance Shortage</option>
                  <option value="Assessment Marks">Low Assessment Marks</option>
                  <option value="Missing Assignments">Missing Assignments</option>
                  <option value="Excessive Leave">Excessive Leave</option>
                </select>
              </div>
            </>
          )}

          {activeTab === 'notifications' && (
            <>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Channel
                </label>
                <select
                  value={filterChannel}
                  onChange={(e) => setFilterChannel(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Channels</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="voice">Voice</option>
                  <option value="system">System / In-App</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                  Delivery Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="delivered">Delivered</option>
                  <option value="failed">Failed</option>
                  <option value="sent">Sent</option>
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. Error Banner */}
      {errorMessage && (
        <AlertBanner
          type="error"
          message={errorMessage}
          actionLabel="Try Again"
          onAction={fetchActiveReport}
        />
      )}

      {/* 5. Loading State */}
      {loading ? (
        <div className="p-16 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-center">
          <LoadingSpinner text={`Compiling ${tabsConfig.find((t) => t.id === activeTab)?.label}...`} size="lg" />
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* TAB 1: ATTENDANCE AUDIT */}
          {/* ========================================================================= */}
          {activeTab === 'attendance' && (
            <div className="space-y-6">
              {/* Summary Metrics Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard
                  title="Total Class Sessions"
                  value={reportData?.summary?.totalSessions ?? 0}
                  subtext="Logged in period"
                  icon={CalendarCheck}
                  color="indigo"
                />
                <StatCard
                  title="Present Sessions"
                  value={reportData?.summary?.presentCount ?? 0}
                  subtext="Attended or excused"
                  icon={CheckCircle2}
                  color="emerald"
                />
                <StatCard
                  title="Absences Logged"
                  value={reportData?.summary?.absentCount ?? 0}
                  subtext="Unexcused sessions"
                  icon={AlertTriangle}
                  color="rose"
                />
                <StatCard
                  title="Excused / Leaves"
                  value={reportData?.summary?.excusedCount ?? 0}
                  subtext="Authorized duty/med"
                  icon={Clock}
                  color="amber"
                />
                <StatCard
                  title="Overall Attendance Rate"
                  value={`${reportData?.summary?.overallPercentage ?? 100}%`}
                  subtext={`Benchmark: ${reportData?.summary?.threshold ?? 75}%`}
                  icon={TrendingUp}
                  color={(reportData?.summary?.overallPercentage ?? 100) < 75 ? 'rose' : 'emerald'}
                />
              </div>

              {/* Chart.js Monthly Trend & Subject Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
                  <h3 className="text-sm font-bold text-white tracking-wide mb-1">
                    Attendance Rate Trend (Monthly)
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">Percentage trend line across academic months</p>
                  <AttendanceTrendChart data={reportData?.chartTrend} />
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide mb-1">
                      Course-Wise Attendance Compliance
                    </h3>
                    <p className="text-xs text-slate-400 mb-3">Breakdown of attended vs total held sessions</p>

                    <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                      {reportData?.subjectStats?.length > 0 ? (
                        reportData.subjectStats.map((sub, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="font-semibold text-white">{sub.subject}</span>
                              <span
                                className={`font-bold ${
                                  sub.percentage < 75 ? 'text-rose-400' : 'text-emerald-400'
                                }`}
                              >
                                {sub.percentage}% ({sub.present}/{sub.total})
                              </span>
                            </div>
                            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  sub.percentage < 75 ? 'bg-rose-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(sub.percentage, 100)}%` }}
                              />
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic">No course records in current filter.</p>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>* Minimum 75% attendance mandatory for exam qualification</span>
                    <span className="font-mono text-indigo-400">Policy Sec. 4.2</span>
                  </div>
                </div>
              </div>

              {/* Attendance Table */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Session Attendance Log Records
                    </h3>
                    <p className="text-xs text-slate-400">Chronological attendance timestamps</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Showing {reportData?.records?.length || 0} entries
                  </span>
                </div>

                {!reportData?.records || reportData.records.length === 0 ? (
                  <EmptyState
                    title="No attendance records match filter criteria"
                    description="Try selecting a wider date range or clearing your subject filter."
                    onAction={handleResetFilters}
                    actionLabel="Reset Filters"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase text-slate-400">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Student Name</th>
                          <th className="py-2.5 px-3">Roll No</th>
                          <th className="py-2.5 px-3">Course / Subject</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {reportData.records.map((r, i) => (
                          <tr key={r._id || i} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-slate-400">
                              {r.date ? new Date(r.date).toLocaleDateString('en-IN') : 'N/A'}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-white">
                              {r.student?.user?.name || r.student?.name || 'Student'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">
                              {r.student?.rollNumber || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-indigo-300">
                              {r.subject?.name || r.subject || 'Subject'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  r.status === 'Present'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : r.status === 'Absent'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">
                              {r.remarks || (r.status === 'Present' ? 'Attended' : 'Unexcused')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: INTERNAL MARKS REPORT */}
          {/* ========================================================================= */}
          {activeTab === 'marks' && (
            <div className="space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Assessments Evaluated"
                  value={reportData?.summary?.totalAssessments ?? 0}
                  subtext="Evaluated exam records"
                  icon={Award}
                  color="indigo"
                />
                <StatCard
                  title="Continuous Assessment Avg"
                  value={`${reportData?.summary?.averagePercentage ?? 0}%`}
                  subtext="Aggregate marks percentage"
                  icon={TrendingUp}
                  color={(reportData?.summary?.averagePercentage ?? 0) < 50 ? 'rose' : 'emerald'}
                />
                <StatCard
                  title="Passing Benchmark"
                  value={`${reportData?.summary?.passingBenchmark ?? 50}%`}
                  subtext="Minimum passing threshold"
                  icon={CheckCircle2}
                  color="slate"
                />
                <StatCard
                  title="Pass Rate"
                  value={
                    reportData?.records?.length > 0
                      ? `${Math.round(
                          (reportData.records.filter((m) => (m.percentage || 0) >= 50).length /
                            reportData.records.length) *
                            100
                        )}%`
                      : '100%'
                  }
                  subtext="Meeting benchmark"
                  icon={CheckCircle}
                  color="emerald"
                />
              </div>

              {/* Chart.js Marks Comparison Bar Chart */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Subject Average Marks vs Maximum Benchmarks
                    </h3>
                    <p className="text-xs text-slate-400">Comparative assessment performance</p>
                  </div>
                </div>
                <MarksComparisonChart data={reportData?.chartData} />
              </div>

              {/* Marks Table */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Internal Assessment Marks Records
                    </h3>
                    <p className="text-xs text-slate-400">Detailed marks entries and pass/fail status</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Showing {reportData?.records?.length || 0} entries
                  </span>
                </div>

                {!reportData?.records || reportData.records.length === 0 ? (
                  <EmptyState
                    title="No assessment records found"
                    description="Try selecting a different assessment type or clearing the subject filter."
                    onAction={handleResetFilters}
                    actionLabel="Reset Filters"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase text-slate-400">
                          <th className="py-2.5 px-3">Student Name</th>
                          <th className="py-2.5 px-3">Course / Subject</th>
                          <th className="py-2.5 px-3">Assessment Type</th>
                          <th className="py-2.5 px-3">Max Marks</th>
                          <th className="py-2.5 px-3">Obtained</th>
                          <th className="py-2.5 px-3">Percentage</th>
                          <th className="py-2.5 px-3">Result / Standing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {reportData.records.map((m, i) => (
                          <tr key={m._id || i} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-white">
                              {m.student?.user?.name || m.student?.name || 'Student'}
                            </td>
                            <td className="py-2.5 px-3 text-indigo-300">
                              {m.subject?.name || m.subject || 'Course'}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-300">
                              {m.examType || 'Internal 1'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">{m.maxMarks || 50}</td>
                            <td className="py-2.5 px-3 font-mono font-bold text-white">
                              {m.obtainedMarks || 0}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              <span
                                className={`font-bold ${
                                  (m.percentage || 0) < 50 ? 'text-rose-400' : 'text-emerald-400'
                                }`}
                              >
                                {m.percentage || Math.round(((m.obtainedMarks || 0) / (m.maxMarks || 50)) * 100)}%
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  (m.percentage || 0) >= 50
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                {(m.percentage || 0) >= 50 ? 'Pass' : 'Remedial Required'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: ASSIGNMENT SUBMISSION & MISSING WORK */}
          {/* ========================================================================= */}
          {activeTab === 'assignments' && (
            <div className="space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard
                  title="Total Coursework"
                  value={reportData?.summary?.totalAssignments ?? 0}
                  subtext="Assigned tasks"
                  icon={ClipboardList}
                  color="indigo"
                />
                <StatCard
                  title="Submitted Work"
                  value={reportData?.summary?.submittedCount ?? 0}
                  subtext="On-time or graded"
                  icon={CheckCircle2}
                  color="emerald"
                />
                <StatCard
                  title="Missing (Overdue)"
                  value={reportData?.summary?.missingCount ?? 0}
                  subtext="Past deadline / no submission"
                  icon={AlertTriangle}
                  color="rose"
                />
                <StatCard
                  title="Late Submissions"
                  value={reportData?.summary?.lateCount ?? 0}
                  subtext="Submitted after deadline"
                  icon={Clock}
                  color="amber"
                />
                <StatCard
                  title="Pending Submissions"
                  value={reportData?.summary?.pendingCount ?? 0}
                  subtext="Awaiting due date"
                  icon={Clock}
                  color="slate"
                />
              </div>

              {/* Assignment Table */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Coursework Submissions & Missing Work Audit
                    </h3>
                    <p className="text-xs text-slate-400">
                      Detailed submission timestamps, grading scores, and overdue tracking
                    </p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Showing {reportData?.records?.length || 0} entries
                  </span>
                </div>

                {!reportData?.records || reportData.records.length === 0 ? (
                  <EmptyState
                    title="No coursework items found"
                    description="Try selecting a different status filter or clearing your subject filter."
                    onAction={handleResetFilters}
                    actionLabel="Reset Filters"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase text-slate-400">
                          <th className="py-2.5 px-3">Assignment Title</th>
                          <th className="py-2.5 px-3">Course / Subject</th>
                          <th className="py-2.5 px-3">Student Name</th>
                          <th className="py-2.5 px-3">Deadline</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Score / Max</th>
                          <th className="py-2.5 px-3">Submitted At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {reportData.records.map((a, i) => (
                          <tr key={a._id || i} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-white">{a.title}</td>
                            <td className="py-2.5 px-3 text-indigo-300">{a.subject}</td>
                            <td className="py-2.5 px-3 text-slate-300">{a.studentName}</td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">
                              {new Date(a.dueDate).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  a.status === 'Missing'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : a.status === 'Graded' || a.status === 'Submitted'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : a.status === 'Late'
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                                }`}
                              >
                                {a.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {a.obtainedMarks !== null ? (
                                <span className="text-emerald-400 font-bold">
                                  {a.obtainedMarks} / {a.maxMarks}
                                </span>
                              ) : (
                                <span className="text-slate-500">{a.maxMarks} pts</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">
                              {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('en-IN') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: LEAVE HISTORY & APPROVAL STATUS */}
          {/* ========================================================================= */}
          {activeTab === 'leaves' && (
            <div className="space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard
                  title="Total Leave Requests"
                  value={reportData?.summary?.totalRequests ?? 0}
                  subtext="Submitted applications"
                  icon={CheckCircle}
                  color="indigo"
                />
                <StatCard
                  title="Approved Requests"
                  value={reportData?.summary?.approvedCount ?? 0}
                  subtext="Excused by faculty"
                  icon={CheckCircle2}
                  color="emerald"
                />
                <StatCard
                  title="Pending Reviews"
                  value={reportData?.summary?.pendingCount ?? 0}
                  subtext="Under advisor review"
                  icon={Clock}
                  color="amber"
                />
                <StatCard
                  title="Rejected Requests"
                  value={reportData?.summary?.rejectedCount ?? 0}
                  subtext="Marked as unexcused"
                  icon={AlertTriangle}
                  color="rose"
                />
                <StatCard
                  title="Total Approved Days"
                  value={`${reportData?.summary?.totalApprovedDays ?? 0} days`}
                  subtext="Official leave duration"
                  icon={TrendingUp}
                  color="slate"
                />
              </div>

              {/* Leave Table */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Student Leave Applications & Approval Audit
                    </h3>
                    <p className="text-xs text-slate-400">Official leave authorizations and medical certificates</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Showing {reportData?.records?.length || 0} entries
                  </span>
                </div>

                {!reportData?.records || reportData.records.length === 0 ? (
                  <EmptyState
                    title="No leave applications on record"
                    description="Try widening the date range or clearing your status filter."
                    onAction={handleResetFilters}
                    actionLabel="Reset Filters"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase text-slate-400">
                          <th className="py-2.5 px-3">Student</th>
                          <th className="py-2.5 px-3">Leave Type</th>
                          <th className="py-2.5 px-3">Duration</th>
                          <th className="py-2.5 px-3">Start Date</th>
                          <th className="py-2.5 px-3">End Date</th>
                          <th className="py-2.5 px-3">Reason</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Reviewed By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {reportData.records.map((l, i) => (
                          <tr key={l._id || i} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-white">
                              {l.student?.user?.name || l.student?.name || 'Student'}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[10px]">
                                {l.leaveType}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-200">
                              {l.durationDays || 1} day(s)
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">
                              {new Date(l.startDate).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">
                              {new Date(l.endDate).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate">{l.reason}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  l.status === 'Approved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : l.status === 'Rejected'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {l.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">
                              {l.reviewedBy?.name || 'Faculty Advisor'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: ACADEMIC RISK SUMMARIES & AUDIT TRAIL */}
          {/* ========================================================================= */}
          {activeTab === 'risks' && (
            <div className="space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Total Logged Deficits"
                  value={reportData?.summary?.total ?? 0}
                  subtext="Active & historical risks"
                  icon={AlertTriangle}
                  color="indigo"
                />
                <StatCard
                  title="Active Interventions"
                  value={reportData?.summary?.active ?? 0}
                  subtext="Unresolved deficits"
                  icon={AlertCircle}
                  color="rose"
                />
                <StatCard
                  title="Resolved Deficits"
                  value={reportData?.summary?.resolved ?? 0}
                  subtext="Remedial completed"
                  icon={CheckCircle2}
                  color="emerald"
                />
                <StatCard
                  title="High Severity Alerts"
                  value={reportData?.summary?.counts?.high ?? 0}
                  subtext="Immediate counseling required"
                  icon={AlertTriangle}
                  color="rose"
                />
              </div>

              {/* Chart.js Risk Doughnut Distribution & Risk Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
                  <h3 className="text-sm font-bold text-white tracking-wide mb-1">
                    Risk Severity Distribution
                  </h3>
                  <p className="text-xs text-slate-400 mb-4">Critical vs Moderate vs Low standing</p>
                  <RiskDoughnutChart counts={reportData?.summary?.counts} />
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide mb-1">
                      Academic Risk Factor Categories
                    </h3>
                    <p className="text-xs text-slate-400 mb-3">Deficit triggers identified across cohort</p>

                    <div className="space-y-3">
                      {reportData?.summary?.byRiskType &&
                        Object.entries(reportData.summary.byRiskType).map(([type, cnt], idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                            <span className="font-semibold text-xs text-white">{type}</span>
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold text-xs">
                              {cnt} alerts
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                    Deficit alerts trigger automated parent warnings via Email and SMS when severity reaches High.
                  </div>
                </div>
              </div>

              {/* Risks Table */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Academic Deficit Log & Intervention History
                    </h3>
                    <p className="text-xs text-slate-400">Audit trail of automated risk evaluations</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Showing {reportData?.records?.length || 0} entries
                  </span>
                </div>

                {!reportData?.records || reportData.records.length === 0 ? (
                  <EmptyState
                    title="No academic deficits identified"
                    description="All students are currently performing within benchmark compliance."
                    onAction={handleResetFilters}
                    actionLabel="Reset Filters"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase text-slate-400">
                          <th className="py-2.5 px-3">Student Name</th>
                          <th className="py-2.5 px-3">Risk Category</th>
                          <th className="py-2.5 px-3">Severity</th>
                          <th className="py-2.5 px-3">Trigger Reason / Advisory</th>
                          <th className="py-2.5 px-3">Detected Date</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Resolution Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {reportData.records.map((r, i) => (
                          <tr key={r._id || i} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-semibold text-white">
                              {r.student?.user?.name || r.student?.name || 'Student'}
                            </td>
                            <td className="py-2.5 px-3 text-indigo-300 font-medium">{r.riskType}</td>
                            <td className="py-2.5 px-3">
                              <RiskBadge
                                level={
                                  r.severity === 'High'
                                    ? 'Critical Risk'
                                    : r.severity === 'Medium'
                                    ? 'Moderate Risk'
                                    : 'Low Risk'
                                }
                              />
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 max-w-sm">
                              {r.triggerReason || 'Deficit threshold exceeded'}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">
                              {new Date(r.detectedDate).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  r.status === 'Resolved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}
                              >
                                {r.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">
                              {r.resolvedBy?.name
                                ? `Resolved by ${r.resolvedBy.name}`
                                : 'Faculty Counseling Active'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 6: PARENT NOTIFICATION HISTORY */}
          {/* ========================================================================= */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              {/* Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <StatCard
                  title="Total Dispatched"
                  value={reportData?.summary?.total ?? 0}
                  subtext="Parent notifications"
                  icon={Bell}
                  color="indigo"
                />
                <StatCard
                  title="Delivered Successfully"
                  value={reportData?.summary?.delivered ?? 0}
                  subtext="Confirmed deliveries"
                  icon={CheckCircle2}
                  color="emerald"
                />
                <StatCard
                  title="Delivery Failures"
                  value={reportData?.summary?.failed ?? 0}
                  subtext="Provider errors"
                  icon={AlertTriangle}
                  color="rose"
                />
                <StatCard
                  title="Email Dispatches"
                  value={reportData?.summary?.byChannel?.email ?? 0}
                  subtext="SMTP delivered"
                  icon={TrendingUp}
                  color="slate"
                />
                <StatCard
                  title="SMS Dispatches"
                  value={reportData?.summary?.byChannel?.sms ?? 0}
                  subtext="Twilio / Fast2SMS"
                  icon={TrendingUp}
                  color="slate"
                />
              </div>

              {/* Notifications Table */}
              <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Parent Communication & Notification Logs
                    </h3>
                    <p className="text-xs text-slate-400">Multi-channel delivery status and message logs</p>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Showing {reportData?.records?.length || 0} entries
                  </span>
                </div>

                {!reportData?.records || reportData.records.length === 0 ? (
                  <EmptyState
                    title="No notification records match criteria"
                    description="Try selecting a different channel or widening the date filter."
                    onAction={handleResetFilters}
                    actionLabel="Reset Filters"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase text-slate-400">
                          <th className="py-2.5 px-3">Timestamp</th>
                          <th className="py-2.5 px-3">Student</th>
                          <th className="py-2.5 px-3">Recipient / Parent</th>
                          <th className="py-2.5 px-3">Channel</th>
                          <th className="py-2.5 px-3">Subject / Title</th>
                          <th className="py-2.5 px-3">Delivery Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {reportData.records.map((n, i) => (
                          <tr key={n._id || i} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-slate-400">
                              {new Date(n.createdAt).toLocaleDateString('en-IN')}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-white">
                              {n.student?.user?.name || n.student?.name || 'Student'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {n.recipient?.name || 'Parent'} ({n.recipient?.phone || n.recipient?.email || ''})
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 font-mono text-[10px] uppercase font-bold">
                                {n.channel || 'System'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-200 max-w-sm truncate">
                              {n.title || n.message}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  n.status === 'delivered'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : n.status === 'failed'
                                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {n.status || 'sent'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 7: CONSOLIDATED STUDENT TRANSCRIPT */}
          {/* ========================================================================= */}
          {activeTab === 'transcript' && (
            <div className="space-y-6">
              {!transcriptData ? (
                <EmptyState
                  title="No Student Selected"
                  description="Please choose a student from the filter dropdown above to preview their official academic transcript."
                />
              ) : (
                <div className="space-y-6">
                  {/* Student Header Card */}
                  <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-600/30">
                        {transcriptData.student?.name?.[0] || 'S'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-lg font-bold text-white tracking-tight">
                            {transcriptData.student?.name}
                          </h3>
                          <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                            {transcriptData.student?.rollNumber}
                          </span>
                          <RiskBadge level={transcriptData.academicStanding || 'Good Standing'} />
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {transcriptData.student?.department} • Semester {transcriptData.student?.semester} (Sec{' '}
                          {transcriptData.student?.section || 'A'})
                        </p>
                      </div>
                    </div>

                    <PDFExportButton
                      student={transcriptData.student}
                      customData={transcriptData}
                      btnText="Download Official Transcript PDF"
                      className="py-2.5 px-4 text-xs font-bold"
                    />
                  </div>

                  {/* Transcript KPI Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                      title="Attendance Percentage"
                      value={`${transcriptData.attendance?.overallPercentage ?? 85}%`}
                      subtext={`${transcriptData.attendance?.presentClasses ?? 0} of ${transcriptData.attendance?.totalClasses ?? 0} classes`}
                      icon={CalendarCheck}
                      color={(transcriptData.attendance?.overallPercentage ?? 85) < 75 ? 'rose' : 'emerald'}
                    />
                    <StatCard
                      title="Assessment Average"
                      value={`${transcriptData.marks?.averagePercentage ?? 75}%`}
                      subtext="Continuous evaluation"
                      icon={Award}
                      color="indigo"
                    />
                    <StatCard
                      title="Approved Leaves"
                      value={`${transcriptData.leaves?.totalDays ?? 0} days`}
                      subtext="Medical / personal excuses"
                      icon={CheckCircle}
                      color="slate"
                    />
                    <StatCard
                      title="Composite Risk Score"
                      value={transcriptData.compositeRiskScore ?? 15}
                      subtext={transcriptData.academicStanding || 'Low Risk'}
                      icon={AlertTriangle}
                      color={transcriptData.compositeRiskScore > 50 ? 'rose' : 'emerald'}
                    />
                  </div>

                  {/* Summary Tables for Transcript */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Course Attendance Breakdown */}
                    <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3">
                        1. Subject-Wise Attendance Breakdown
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead>
                            <tr className="border-b border-slate-800 text-[10px] font-semibold uppercase text-slate-400">
                              <th className="py-2 px-2">Course</th>
                              <th className="py-2 px-2">Held</th>
                              <th className="py-2 px-2">Attended</th>
                              <th className="py-2 px-2">Compliance %</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {transcriptData.attendance?.subjectStats?.map((s, i) => (
                              <tr key={i}>
                                <td className="py-2 px-2 font-medium text-white">{s.subject}</td>
                                <td className="py-2 px-2 font-mono text-slate-400">{s.total}</td>
                                <td className="py-2 px-2 font-mono text-emerald-400">{s.present}</td>
                                <td className="py-2 px-2 font-mono font-bold">
                                  <span className={s.percentage < 75 ? 'text-rose-400' : 'text-emerald-400'}>
                                    {s.percentage}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Internal Marks Breakdown */}
                    <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 mb-3">
                        2. Internal Assessment Scores
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead>
                            <tr className="border-b border-slate-800 text-[10px] font-semibold uppercase text-slate-400">
                              <th className="py-2 px-2">Course</th>
                              <th className="py-2 px-2">Assessment</th>
                              <th className="py-2 px-2">Score</th>
                              <th className="py-2 px-2">Result</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {transcriptData.marks?.records?.map((m, i) => (
                              <tr key={i}>
                                <td className="py-2 px-2 font-medium text-white">{m.subject}</td>
                                <td className="py-2 px-2 text-slate-400">{m.examType}</td>
                                <td className="py-2 px-2 font-mono font-bold text-white">
                                  {m.obtainedMarks} / {m.maxMarks}
                                </td>
                                <td className="py-2 px-2">
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                      (m.percentage || 0) >= 50
                                        ? 'bg-emerald-500/10 text-emerald-400'
                                        : 'bg-rose-500/10 text-rose-400'
                                    }`}
                                  >
                                    {(m.percentage || 0) >= 50 ? 'Pass' : 'Remedial'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AcademicReportsHub;
