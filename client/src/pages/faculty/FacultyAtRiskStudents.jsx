import React, { useState, useEffect } from 'react';
import RiskBadge from '../../components/common/RiskBadge';
import Modal from '../../components/common/Modal';
import {
  AlertTriangle,
  Send,
  Mail,
  MessageSquare,
  CheckCircle2,
  ShieldAlert,
  RefreshCw,
  Search,
  Filter,
  Check,
  FileText,
  CalendarCheck,
  Award,
  ClipboardList,
  ArrowUpDown,
  History,
  Clock,
  Info,
  CheckCircle,
  XCircle,
  ChevronDown
} from 'lucide-react';
import apiService from '../../api/apiService';
import { SAMPLE_STUDENTS } from '../../data/mockData';

const FacultyAtRiskStudents = () => {
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState({
    totalStudents: 0,
    criticalRiskCount: 0,
    moderateRiskCount: 0,
    lowRiskCount: 0,
    activeRisksCount: 0,
    resolvedRisksCount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters & Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('All'); // All, High, Medium, Low
  const [selectedRiskType, setSelectedRiskType] = useState('All'); // All, Attendance, Assessment Marks, Missing Assignments, Excessive Leave
  const [sortBy, setSortBy] = useState('compositeRiskScore'); // compositeRiskScore, attendance, marks, missingAssignments, name
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc

  // 1-Click Parent Alert Modal State
  const [selectedStudentReport, setSelectedStudentReport] = useState(null);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [customNote, setCustomNote] = useState('');
  const [channels, setChannels] = useState({ email: true, sms: true, portal: true });
  const [sending, setSending] = useState(false);
  const [alertSuccess, setAlertSuccess] = useState('');
  const [alertError, setAlertError] = useState('');

  // Audit Trail & Risk Details Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyStudent, setHistoryStudent] = useState(null);
  const [studentRiskDetails, setStudentRiskDetails] = useState({
    report: null,
    activeRisks: [],
    resolvedRisks: [],
    history: [],
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [resolvingRiskId, setResolvingRiskId] = useState(null);
  const [resolveNotes, setResolveNotes] = useState('');
  const [resolveMsg, setResolveMsg] = useState('');

  const fetchRiskData = async () => {
    setLoading(true);
    try {
      const res = await apiService.getRiskOverview({
        severity: selectedSeverity !== 'All' ? selectedSeverity : undefined,
        riskType: selectedRiskType !== 'All' ? selectedRiskType : undefined,
        search: searchQuery.trim() || undefined,
        sortBy,
        sortOrder,
      });

      if (res.data?.data) {
        setReports(res.data.data.reports || []);
        setSummary(res.data.data.summary || {});
      } else {
        fallbackWithMock();
      }
    } catch (err) {
      console.warn('Error fetching risk overview:', err);
      fallbackWithMock();
    } finally {
      setLoading(false);
    }
  };

  const fallbackWithMock = () => {
    const mockReports = SAMPLE_STUDENTS.map((st) => ({
      student: {
        _id: st._id,
        name: st.name,
        rollNumber: st.rollNumber,
        department: st.department || 'Computer Science & Engineering',
        semester: st.semester || 4,
      },
      metrics: {
        attendancePercentage: st.attendance || 80,
        marksAveragePercentage: st.internalMarksAvg || 75,
        missingAssignmentsCount: st.pendingAssignments || 0,
        approvedLeaveDays: 2,
        compositeRiskScore: st.attendance < 75 ? 65 : 20,
      },
      severity: st.attendance < 75 ? 'High' : st.riskLevel === 'Moderate Risk' ? 'Medium' : 'Low',
      riskLevel: st.attendance < 75 || st.riskLevel === 'High Risk' ? 'Critical Risk' : st.riskLevel === 'Moderate Risk' ? 'Moderate Risk' : 'Low Risk',
      badgeColor: st.attendance < 75 ? 'rose' : 'emerald',
      riskFactors: st.attendance < 75 ? ['Attendance is critically low at 68% (Mandatory threshold: 75%)'] : ['Consistent attendance and good academic standing.'],
      activeRisks: st.attendance < 75 ? [
        {
          _id: 'mock-risk-1',
          riskType: 'Attendance',
          severity: 'High',
          reason: 'Attendance 68% is below mandatory threshold 75%',
          detectedDate: new Date().toISOString(),
          status: 'Active',
          lastEvaluatedDate: new Date().toISOString(),
        }
      ] : [],
      recommendedAction: st.attendance < 75 ? 'Immediate parent-faculty conference required and remedial intervention.' : 'Continue routine tracking.',
    }));

    setReports(mockReports);
    setSummary({
      totalStudents: mockReports.length,
      criticalRiskCount: mockReports.filter((r) => r.riskLevel === 'Critical Risk' || r.severity === 'High').length,
      moderateRiskCount: mockReports.filter((r) => r.riskLevel === 'Moderate Risk' || r.severity === 'Medium').length,
      lowRiskCount: mockReports.filter((r) => r.riskLevel === 'Low Risk' || r.severity === 'Low').length,
      activeRisksCount: mockReports.filter((r) => r.activeRisks?.length > 0).length,
      resolvedRisksCount: 0,
    });
  };

  useEffect(() => {
    fetchRiskData();
  }, [selectedSeverity, selectedRiskType, sortBy, sortOrder]);

  const handleOpenNotify = (item) => {
    setSelectedStudentReport(item);
    const issues = item.riskFactors?.join('; ') || 'academic performance notice';
    setCustomNote(
      `Please schedule an urgent academic counseling session with the faculty advisor regarding: ${issues}.`
    );
    setAlertSuccess('');
    setAlertError('');
    setNotifyModalOpen(true);
  };

  const handleSendParentAlert = async (e) => {
    e.preventDefault();
    if (!selectedStudentReport) return;
    setSending(true);
    setAlertError('');

    try {
      const channelList = Object.keys(channels).filter((k) => channels[k]);
      await apiService.sendRiskAlertToParent(selectedStudentReport.student._id, {
        customNote,
        channels: channelList,
      });

      setAlertSuccess(
        `Academic alert dispatched to parent of ${selectedStudentReport.student.name} via ${channelList.join(', ')}!`
      );
      setTimeout(() => {
        setAlertSuccess('');
        setNotifyModalOpen(false);
      }, 1500);
    } catch (err) {
      setAlertError(err.response?.data?.message || err.message || 'Failed to dispatch alert.');
    } finally {
      setSending(false);
    }
  };

  const handleOpenHistoryModal = async (student) => {
    setHistoryStudent(student);
    setHistoryModalOpen(true);
    setHistoryLoading(true);
    setResolveMsg('');
    setResolvingRiskId(null);
    setResolveNotes('');

    try {
      const res = await apiService.getStudentRiskDetails(student._id);
      if (res.data) {
        setStudentRiskDetails({
          report: res.data.report || null,
          activeRisks: res.data.activeRisks || [],
          resolvedRisks: res.data.resolvedRisks || [],
          history: res.data.history || [],
        });
      }
    } catch (err) {
      console.warn('Error fetching student risk history:', err);
      // Fallback
      setStudentRiskDetails({
        report: null,
        activeRisks: [],
        resolvedRisks: [],
        history: [],
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleManualResolveRisk = async (riskId) => {
    if (!riskId) return;
    try {
      await apiService.resolveRisk(riskId, { notes: resolveNotes || 'Manually resolved by faculty advisor' });
      setResolveMsg('Risk condition marked resolved with audit record.');
      setResolvingRiskId(null);
      setResolveNotes('');
      // Refresh student history
      if (historyStudent) {
        const res = await apiService.getStudentRiskDetails(historyStudent._id);
        if (res.data) {
          setStudentRiskDetails({
            report: res.data.report,
            activeRisks: res.data.activeRisks || [],
            resolvedRisks: res.data.resolvedRisks || [],
            history: res.data.history || [],
          });
        }
      }
      fetchRiskData();
    } catch (err) {
      setResolveMsg(err.response?.data?.message || 'Failed to resolve risk.');
    }
  };

  // Client-side search filtering if needed
  const displayReports = reports.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = (item.student?.name || '').toLowerCase();
      const roll = (item.student?.rollNumber || '').toLowerCase();
      return name.includes(q) || roll.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Academic Risk Identification & Early Warning Engine</h2>
              <p className="text-xs text-slate-400">
                Rule-based diagnostic engine evaluating attendance, internal assessment marks, overdue missing assignments, and excessive leave.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchRiskData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all shadow-sm active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Recalculate & Refresh</span>
        </button>
      </div>

      {/* Overview Risk Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div
          onClick={() => setSelectedSeverity(selectedSeverity === 'High' ? 'All' : 'High')}
          className={`p-4 rounded-2xl cursor-pointer transition-all border ${
            selectedSeverity === 'High'
              ? 'bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/30'
              : 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/60'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-rose-400 uppercase tracking-wide">High Risk (Critical)</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{summary.highRiskCount || summary.criticalRiskCount || 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Requires immediate intervention & parental notice</p>
        </div>

        <div
          onClick={() => setSelectedSeverity(selectedSeverity === 'Medium' ? 'All' : 'Medium')}
          className={`p-4 rounded-2xl cursor-pointer transition-all border ${
            selectedSeverity === 'Medium'
              ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/30'
              : 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/60'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">Medium Risk</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{summary.mediumRiskCount || summary.moderateRiskCount || 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Warning buffer zone (approaching threshold)</p>
        </div>

        <div
          onClick={() => setSelectedSeverity(selectedSeverity === 'Low' ? 'All' : 'Low')}
          className={`p-4 rounded-2xl cursor-pointer transition-all border ${
            selectedSeverity === 'Low'
              ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/30'
              : 'bg-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/60'
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Low Risk / On Track</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{summary.lowRiskCount || 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Satisfies academic coursework & attendance rules</p>
        </div>

        <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wide">Active Risk Issues</span>
            <History className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono">{summary.activeRisksCount || 0}</div>
          <p className="text-[11px] text-slate-400 mt-1">Monitored rule triggers in active status</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-lg">
        {/* Severity Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/60 border border-slate-800 overflow-x-auto">
          {[
            { label: 'All Severities', val: 'All' },
            { label: 'High', val: 'High' },
            { label: 'Medium', val: 'Medium' },
            { label: 'Low', val: 'Low' },
          ].map((item) => (
            <button
              key={item.val}
              onClick={() => setSelectedSeverity(item.val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                selectedSeverity === item.val
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Risk Type Filter Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Risk Condition:</span>
          <select
            value={selectedRiskType}
            onChange={(e) => setSelectedRiskType(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="All">All Risk Conditions</option>
            <option value="Attendance">Attendance Deficit (&lt; 75%)</option>
            <option value="Assessment Marks">Assessment Marks Deficit (&lt; 50%)</option>
            <option value="Missing Assignments">Missing Assignments Overdue</option>
            <option value="Excessive Leave">Excessive Approved Leave</option>
          </select>
        </div>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-semibold whitespace-nowrap">Sort By:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="compositeRiskScore">Composite Risk Score</option>
            <option value="attendance">Attendance Rate</option>
            <option value="marks">Internal Marks Average</option>
            <option value="missingAssignments">Missing Assignments</option>
            <option value="name">Student Name</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title={`Toggle Sort Order (${sortOrder.toUpperCase()})`}
            className="p-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-56">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search student or roll..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Student Risk Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              <th className="px-5 py-3.5">Student</th>
              <th className="px-4 py-3.5">Attendance</th>
              <th className="px-4 py-3.5">Marks Avg</th>
              <th className="px-4 py-3.5">Missing Assignments</th>
              <th className="px-4 py-3.5">Excessive Leave</th>
              <th className="px-4 py-3.5">Severity</th>
              <th className="px-5 py-3.5">Exact Reason &amp; Diagnostic Details</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {loading ? (
              <tr>
                <td colSpan="8" className="px-5 py-8 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
                  Evaluating student risk rules...
                </td>
              </tr>
            ) : displayReports.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-5 py-8 text-center text-slate-500">
                  No student records found matching the active filters.
                </td>
              </tr>
            ) : (
              displayReports.map((item, idx) => {
                const st = item.student;
                const metrics = item.metrics || {};
                const severity = item.severity || (item.riskLevel === 'Critical Risk' ? 'High' : item.riskLevel === 'Moderate Risk' ? 'Medium' : 'Low');
                const isCritical = severity === 'High';
                const isModerate = severity === 'Medium';

                const attShortage = metrics.attendancePercentage < (metrics.attendanceThreshold || 75);
                const marksShortage = metrics.marksAveragePercentage < (metrics.marksThreshold || 50);
                const missingAssignmentsFlagged = (metrics.missingAssignmentsCount || 0) >= (metrics.missingAssignmentsThreshold || 2);
                const excessiveLeaveFlagged = (metrics.approvedLeaveDays || 0) >= (metrics.excessiveLeaveThreshold || 6);

                return (
                  <tr
                    key={st?._id || idx}
                    className={`transition-colors ${
                      isCritical
                        ? 'bg-rose-950/15 hover:bg-rose-950/25'
                        : isModerate
                        ? 'bg-amber-950/10 hover:bg-amber-950/20'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white">{st?.name}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {st?.rollNumber} • Sem {st?.semester || 1}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 font-bold">
                      <span className={attShortage ? 'text-rose-400' : 'text-emerald-400'}>
                        {metrics.attendancePercentage}%
                      </span>
                      <span className="text-[10px] text-slate-500 block font-normal">
                        Min: {metrics.attendanceThreshold || 75}%
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-bold">
                      <span className={marksShortage ? 'text-rose-400' : 'text-slate-200'}>
                        {metrics.marksAveragePercentage}%
                      </span>
                      <span className="text-[10px] text-slate-500 block font-normal">
                        Min: {metrics.marksThreshold || 50}%
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                          missingAssignmentsFlagged
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : (metrics.missingAssignmentsCount || 0) > 0
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {metrics.missingAssignmentsCount || 0} Overdue
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-mono">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block ${
                          excessiveLeaveFlagged
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'text-slate-300'
                        }`}
                      >
                        {metrics.approvedLeaveDays || 0} / {metrics.excessiveLeaveThreshold || 6} Days
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <RiskBadge level={severity === 'High' ? 'Critical Risk' : severity === 'Medium' ? 'Moderate Risk' : 'Low Risk'} size="sm" />
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Score: {metrics.compositeRiskScore || 0}/100
                      </div>
                    </td>

                    <td className="px-5 py-3.5 max-w-xs">
                      {item.riskFactors && item.riskFactors.length > 0 ? (
                        <div className="space-y-1">
                          {item.riskFactors.map((factor, fi) => (
                            <div key={fi} className="text-[11px] text-slate-300 flex items-start gap-1">
                              <span className="text-rose-400 font-bold">•</span>
                              <span className="line-clamp-2">{factor}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-emerald-400 font-medium">All academic metrics within safe limits</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenHistoryModal(st)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
                          title="View Risk History & Audit Trail"
                        >
                          <History className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Audit Trail</span>
                        </button>

                        <button
                          onClick={() => handleOpenNotify(item)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 ${
                            isCritical
                              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                              : isModerate
                              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Alert Parent</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Student Risk History & Audit Trail */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Academic Risk Audit Trail & History: ${historyStudent?.name || ''}`}
        subtitle={`Roll Number: ${historyStudent?.rollNumber || ''} • Transparent Rule Lifecycle`}
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {historyLoading ? (
            <div className="py-8 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
              Loading audit records and risk lifecycle...
            </div>
          ) : (
            <>
              {resolveMsg && (
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs rounded-xl flex items-center gap-2">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  <span>{resolveMsg}</span>
                </div>
              )}

              {/* Active Risks Section */}
              <div>
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Active Rule-Triggered Risks ({studentRiskDetails.activeRisks.length})</span>
                </h4>

                {studentRiskDetails.activeRisks.length === 0 ? (
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-emerald-400 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    <span>No active academic risk conditions detected. All metrics satisfy institutional thresholds.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {studentRiskDetails.activeRisks.map((risk) => (
                      <div
                        key={risk._id}
                        className="p-3 rounded-xl bg-slate-950 border border-rose-500/30 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-xs font-bold text-white mr-2">{risk.riskType} Risk</span>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                risk.severity === 'High'
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : risk.severity === 'Medium'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-emerald-500/20 text-emerald-400'
                              }`}
                            >
                              {risk.severity} Severity
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">
                            Detected: {new Date(risk.detectedDate).toLocaleDateString()}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300">
                          <strong className="text-rose-400">Reason: </strong>
                          {risk.reason}
                        </p>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-900 text-[10px] text-slate-500">
                          <span>Last Evaluated: {new Date(risk.lastEvaluatedDate).toLocaleString()}</span>

                          {resolvingRiskId === risk._id ? (
                            <div className="flex items-center gap-2 w-full max-w-sm mt-2">
                              <input
                                type="text"
                                placeholder="Resolution notes..."
                                value={resolveNotes}
                                onChange={(e) => setResolveNotes(e.target.value)}
                                className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white"
                              />
                              <button
                                onClick={() => handleManualResolveRisk(risk._id)}
                                className="px-2 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg whitespace-nowrap"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setResolvingRiskId(null)}
                                className="px-2 py-1 text-[11px] bg-slate-800 text-slate-400 rounded-lg"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setResolvingRiskId(risk._id);
                                setResolveNotes('Counseled student; academic plan instituted');
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all"
                            >
                              Resolve Condition
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resolved / Closed Risks Section */}
              {studentRiskDetails.resolvedRisks.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Resolved &amp; Closed Risks ({studentRiskDetails.resolvedRisks.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {studentRiskDetails.resolvedRisks.map((risk) => (
                      <div
                        key={risk._id}
                        className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5 opacity-80"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300">{risk.riskType} Risk</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold">
                            {risk.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          <strong>Resolved Date: </strong>
                          {risk.resolvedDate ? new Date(risk.resolvedDate).toLocaleDateString() : 'N/A'}
                        </p>
                        <p className="text-[11px] text-slate-300">
                          <strong>Resolution Reason: </strong>
                          {risk.resolutionReason || 'Automatic condition clearance'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit Trail Timeline */}
              <div>
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Audit Trail &amp; Engine Event Logs</span>
                </h4>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                  {studentRiskDetails.history.length === 0 ? (
                    <p className="text-xs text-slate-500">No historical audit entries found.</p>
                  ) : (
                    studentRiskDetails.history.flatMap((record) =>
                      (record.auditTrail || []).map((entry, ei) => (
                        <div
                          key={`${record._id}-${ei}`}
                          className="flex items-start gap-2.5 pb-2.5 border-b border-slate-900 last:border-0 last:pb-0 text-xs"
                        >
                          <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-200">
                                {record.riskType}: {entry.action.replace('_', ' ')}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {new Date(entry.timestamp).toLocaleString()}
                              </span>
                            </div>
                            {entry.notes && (
                              <p className="text-[11px] text-slate-400 mt-0.5">{entry.notes}</p>
                            )}
                            {(entry.previousSeverity || entry.newSeverity) && (
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                Severity: {entry.previousSeverity || 'None'} &rarr; {entry.newSeverity || 'None'}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )
                  )}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              onClick={() => setHistoryModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: 1-Click Parent Intervention Alert */}
      <Modal
        isOpen={notifyModalOpen}
        onClose={() => !sending && setNotifyModalOpen(false)}
        title={`Trigger Parent Academic Alert: ${selectedStudentReport?.student?.name}`}
        subtitle={`Roll: ${selectedStudentReport?.student?.rollNumber} • Standing: ${selectedStudentReport?.riskLevel}`}
      >
        <form onSubmit={handleSendParentAlert} className="space-y-4">
          {alertSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{alertSuccess}</span>
            </div>
          )}

          {alertError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{alertError}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-4 gap-2 text-center text-xs">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Attendance</span>
              <span className="text-rose-400 font-bold">{selectedStudentReport?.metrics?.attendancePercentage}%</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Marks Avg</span>
              <span className="text-slate-200 font-bold">{selectedStudentReport?.metrics?.marksAveragePercentage}%</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Missing</span>
              <span className="text-rose-400 font-bold">{selectedStudentReport?.metrics?.missingAssignmentsCount || 0}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Leave Days</span>
              <span className="text-amber-400 font-bold">{selectedStudentReport?.metrics?.approvedLeaveDays || 0}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Communication Gateways</label>
            <div className="grid grid-cols-3 gap-2">
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={channels.email}
                  onChange={(e) => setChannels({ ...channels, email: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <Mail className="w-4 h-4 text-indigo-400" />
                <span className="text-slate-200">Email</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={channels.sms}
                  onChange={(e) => setChannels({ ...channels, sms: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-200">SMS Gateway</span>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={channels.portal}
                  onChange={(e) => setChannels({ ...channels, portal: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-0"
                />
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                <span className="text-slate-200">Portal Feed</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Custom Advisory Notice to Parent <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows="3"
              required
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="State intervention details, meeting schedule, or counselling steps..."
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={sending}
              onClick={() => setNotifyModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sending ? 'Dispatching...' : 'Dispatch Alert to Parent'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default FacultyAtRiskStudents;
