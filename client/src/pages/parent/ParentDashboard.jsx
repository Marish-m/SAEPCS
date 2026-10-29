import React, { useState, useEffect } from 'react';
import StatCard from '../../components/common/StatCard';
import RiskBadge from '../../components/common/RiskBadge';
import AttendanceTrendChart from '../../components/charts/AttendanceTrendChart';
import MarksComparisonChart from '../../components/charts/MarksComparisonChart';
import PDFExportButton from '../../components/reports/PDFExportButton';
import AcademicReportsHub from '../../components/reports/AcademicReportsHub';
import Modal from '../../components/common/Modal';
import {
  SAMPLE_STUDENTS,
  SAMPLE_ATTENDANCE_SUMMARY,
  SAMPLE_MARKS_ANALYTICS,
  SAMPLE_ASSIGNMENTS,
  SAMPLE_LEAVES,
  SAMPLE_NOTIFICATIONS,
} from '../../data/mockData';
import {
  GraduationCap,
  CalendarCheck,
  Award,
  AlertTriangle,
  ClipboardList,
  UserCheck,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  Plus,
  RefreshCw,
  Volume2,
  VolumeX,
  MessageSquare,
  Bell,
  Languages,
  Info,
  Play,
  Square,
} from 'lucide-react';
import apiService from '../../api/apiService';

const ParentDashboard = ({ activeTab = 'overview' }) => {
  const [linkedChildren, setLinkedChildren] = useState([SAMPLE_STUDENTS[0], SAMPLE_STUDENTS[1]]);
  const [selectedChild, setSelectedChild] = useState(SAMPLE_STUDENTS[0]);

  // Live Child Academic Records
  const [attendanceSummary, setAttendanceSummary] = useState(null);
  const [marksAnalytics, setMarksAnalytics] = useState(null);
  const [riskDetails, setRiskDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // Leave application state for parent
  const [isApplyLeaveOpen, setIsApplyLeaveOpen] = useState(false);
  const [leaves, setLeaves] = useState(SAMPLE_LEAVES);
  const [wardAssignments, setWardAssignments] = useState(SAMPLE_ASSIGNMENTS);
  const [newLeave, setNewLeave] = useState({
    leaveType: 'Medical',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [leaveSuccess, setLeaveSuccess] = useState('');

  // Academic Warnings & Voice Notifications State
  const [parentNotifications, setParentNotifications] = useState([]);
  const [speechLanguage, setSpeechLanguage] = useState('en');
  const [playingNotifId, setPlayingNotifId] = useState(null);
  const [langSaving, setLangSaving] = useState(false);

  const handleLanguageChange = async (newLang) => {
    setSpeechLanguage(newLang);
    setLangSaving(true);
    try {
      await apiService.updateNotificationPreferences({ languagePreference: newLang });
    } catch {
      // offline preview mode fallback
    } finally {
      setLangSaving(false);
    }
  };

  const handlePlayVoice = (notif) => {
    if (!('speechSynthesis' in window)) {
      alert('Browser Text-To-Speech is not supported in this browser.');
      return;
    }

    if (playingNotifId === notif._id) {
      window.speechSynthesis.cancel();
      setPlayingNotifId(null);
      return;
    }

    window.speechSynthesis.cancel();

    let textToSpeak = '';
    if (speechLanguage === 'ta') {
      textToSpeak =
        notif.voiceDetails?.language === 'ta' && notif.voiceDetails?.transcript
          ? notif.voiceDetails.transcript
          : `Vanakkam. Your child ${notif.academicDetails?.studentName || selectedChild.name} has attendance below 75 percent. Please contact the class faculty for further details.`;
    } else {
      textToSpeak =
        notif.voiceMessage?.en ||
        notif.voiceDetails?.transcript ||
        `${notif.title}. ${notif.message}. Recommended action: ${notif.academicDetails?.recommendedAction || 'Please consult the department faculty advisor.'}`;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const voices = window.speechSynthesis.getVoices();

    if (speechLanguage === 'ta') {
      utterance.lang = 'ta-IN';
      const tamilVoice = voices.find(
        (v) => v.lang.includes('ta') || v.name.toLowerCase().includes('tamil')
      );
      if (tamilVoice) utterance.voice = tamilVoice;
    } else {
      utterance.lang = 'en-IN';
      const indianVoice = voices.find(
        (v) => v.lang.includes('en-IN') || v.name.toLowerCase().includes('india')
      );
      if (indianVoice) utterance.voice = indianVoice;
    }

    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setPlayingNotifId(notif._id);
    utterance.onend = () => setPlayingNotifId(null);
    utterance.onerror = () => setPlayingNotifId(null);

    window.speechSynthesis.speak(utterance);
  };

  const handleStopVoice = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingNotifId(null);
  };

  // 1. Fetch Parent's Linked Wards from API
  useEffect(() => {
    const fetchChildren = async () => {
      try {
        const res = await apiService.getMyChildren();
        if (res.data?.children && res.data.children.length > 0) {
          const formatted = res.data.children.map((c) => ({
            _id: c._id,
            name: c.user?.name || c.rollNumber,
            rollNumber: c.rollNumber,
            department: c.department?.name || 'Computer Science & Engineering',
            semester: c.semester,
            section: c.section,
            attendance: c.risk?.attendancePercentage || 85,
            riskLevel: c.risk?.riskLevel || 'Low Risk',
            internalMarksAvg: c.risk?.marksAveragePercentage || 80,
            pendingAssignments: c.risk?.pendingAssignmentsCount || 0,
            facultyAdvisor: c.facultyAdvisor || null,
          }));
          setLinkedChildren(formatted);
          setSelectedChild(formatted[0]);
        }
      } catch (err) {
        console.warn('Using default linked children fallback:', err);
      }
    };

    fetchChildren();
  }, []);

  // 2. Fetch Live Academic Records for Selected Ward
  useEffect(() => {
    const fetchChildAcademicRecords = async () => {
      if (!selectedChild?._id) return;
      setLoading(true);

      try {
        const [attRes, marksRes, riskRes, assignRes, leavesRes, notifRes] = await Promise.allSettled([
          apiService.getAttendanceSummary(selectedChild._id),
          apiService.getStudentMarksAnalytics(selectedChild._id),
          apiService.getStudentRiskDetails(selectedChild._id),
          apiService.getAssignments({ studentId: selectedChild._id }),
          apiService.getLeaves({ studentId: selectedChild._id }),
          apiService.getParentNotifications({ studentId: selectedChild._id }),
        ]);

        if (attRes.status === 'fulfilled' && attRes.value.data?.summary) {
          setAttendanceSummary(attRes.value.data.summary);
        } else {
          setAttendanceSummary(SAMPLE_ATTENDANCE_SUMMARY);
        }

        if (marksRes.status === 'fulfilled' && marksRes.value.data?.analytics) {
          setMarksAnalytics(marksRes.value.data.analytics);
        } else {
          setMarksAnalytics(SAMPLE_MARKS_ANALYTICS);
        }

        if (riskRes.status === 'fulfilled' && riskRes.value.data?.report) {
          setRiskDetails(riskRes.value.data.report);
        }

        if (assignRes.status === 'fulfilled' && assignRes.value.data?.assignments) {
          setWardAssignments(assignRes.value.data.assignments);
        }

        if (leavesRes.status === 'fulfilled' && leavesRes.value.data?.leaves) {
          setLeaves(leavesRes.value.data.leaves);
        }

        if (notifRes.status === 'fulfilled' && notifRes.value.data?.notifications) {
          setParentNotifications(notifRes.value.data.notifications);
        } else {
          // Provide realistic academic warning for at-risk child
          setParentNotifications([
            {
              _id: 'default-notif-1',
              title: `Academic Notice: Attendance Benchmark Shortage (${selectedChild.name})`,
              message: `${selectedChild.name}'s attendance has fallen below the 75% institutional threshold. Remedial counseling is required.`,
              type: 'attendance_alert',
              channel: 'all',
              status: 'delivered',
              academicDetails: {
                studentName: selectedChild.name,
                rollNumber: selectedChild.rollNumber,
                issue: 'Attendance Shortage',
                currentMetric: `${selectedChild.attendance || 68}% Attendance`,
                recommendedAction: 'Immediate parent-faculty conference required and remedial intervention.',
                date: new Date(),
              },
              voiceMessage: {
                en: `Hello. Your child ${selectedChild.name} has attendance at ${selectedChild.attendance || 68} percent, which is below the mandatory 75 percent benchmark. Please contact the class faculty for further details.`,
                ta: `வணக்கம். உங்கள் குழந்தை ${selectedChild.name} வருகை பதிவு ${selectedChild.attendance || 68} சதவிகிதமாக உள்ளது. வகுப்பு ஆசிரியரை தொடர்பு கொள்ளவும்.`,
              },
              voiceDetails: {
                mode: 'browser_tts',
                language: 'en',
                transcript: `Vanakkam. Your child ${selectedChild.name} has attendance below 75 percent. Please contact the class faculty for further details.`,
              },
              deliveryStatus: { emailSent: true, smsSent: true, voicePlayed: false },
              emailDetails: { to: 'parent@saepcs.edu', status: 'delivered', messageId: 'MSG-EM-992' },
              smsDetails: { to: '+91 98765 43210', status: 'delivered', provider: 'mock', messageId: 'MSG-SMS-881' },
              createdAt: new Date().toISOString(),
            },
          ]);
        }
      } catch (err) {
        console.warn('Error loading ward academic data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchChildAcademicRecords();
  }, [selectedChild]);

  // Derived Values
  const activeAtt = attendanceSummary || SAMPLE_ATTENDANCE_SUMMARY;
  const activeMarks = marksAnalytics || SAMPLE_MARKS_ANALYTICS;
  const threshold = activeAtt.attendanceThreshold || 75;
  const currentAttendancePct = activeAtt.overallPercentage !== undefined ? activeAtt.overallPercentage : (selectedChild.attendance || 80);
  const isShortage = currentAttendancePct < threshold;
  const currentRiskLevel = riskDetails?.riskLevel || selectedChild.riskLevel || (isShortage ? 'Critical Risk' : 'Low Risk');
  const marksAvg = activeMarks.overallAveragePercentage !== undefined ? activeMarks.overallAveragePercentage : (selectedChild.internalMarksAvg || 75);

  const handleApplyLeave = async (e) => {
    e.preventDefault();
    try {
      await apiService.applyLeave({
        studentId: selectedChild._id,
        ...newLeave,
      });
    } catch {
      // preview mode fallback
    }

    const created = {
      _id: 'leave-' + Date.now(),
      studentName: selectedChild.name,
      rollNumber: selectedChild.rollNumber,
      ...newLeave,
      status: 'Pending',
      appliedBy: 'parent',
      facultyRemarks: '',
    };

    setLeaves([created, ...leaves]);
    setLeaveSuccess(`Leave application submitted on behalf of ${selectedChild.name}!`);
    setTimeout(() => {
      setLeaveSuccess('');
      setIsApplyLeaveOpen(false);
    }, 1200);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Child Switcher & Profile Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-600/30">
            {selectedChild.name ? selectedChild.name[0] : 'W'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-tight">{selectedChild.name}</h2>
              <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                {selectedChild.rollNumber}
              </span>
              <RiskBadge level={currentRiskLevel} />
            </div>
            <p className="text-xs text-slate-400">
              {selectedChild.department} • Semester {selectedChild.semester} (Section {selectedChild.section})
            </p>
          </div>
        </div>

        {/* Switch Between Linked Wards */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-semibold">Select Ward:</span>
          <div className="flex gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
            {linkedChildren.map((child) => (
              <button
                key={child._id}
                onClick={() => setSelectedChild(child)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  selectedChild._id === child._id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {child.name.split(' ')[0]}
              </button>
            ))}
          </div>

          <PDFExportButton
            student={selectedChild}
            btnText="Download Progress Report"
            className="py-1.5 text-xs"
          />
        </div>
      </div>

      {/* Render Active View Based on Selected Sidebar Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Attendance Rate"
              value={`${currentAttendancePct}%`}
              subtext={isShortage ? `Critical: Below ${threshold}% benchmark` : `Eligible for examinations (>= ${threshold}%)`}
              icon={CalendarCheck}
              color={isShortage ? 'rose' : 'emerald'}
            />
            <StatCard
              title="Academic Standing"
              value={currentRiskLevel}
              subtext="Re-evaluated from live records"
              icon={GraduationCap}
              color={currentRiskLevel === 'Critical Risk' ? 'rose' : currentRiskLevel === 'Moderate Risk' ? 'amber' : 'emerald'}
            />
            <StatCard
              title="Internal Exam Avg"
              value={`${marksAvg}%`}
              subtext="Continuous assessment average"
              icon={Award}
              color={marksAvg < 50 ? 'rose' : 'indigo'}
            />
            <StatCard
              title="Sessions Attended"
              value={activeAtt.presentClasses ? `${activeAtt.presentClasses} / ${activeAtt.totalClasses}` : '24 / 28'}
              subtext="Lectures & practicals attended"
              icon={CheckCircle2}
              color="emerald"
            />
          </div>

          {/* Urgent Shortage Notice Banner if < configured threshold */}
          {isShortage && (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-white tracking-wide text-sm mb-0.5">
                  Action Required: Mandatory Attendance Deficit Notice
                </h4>
                <p className="leading-relaxed">
                  {selectedChild.name}'s attendance is currently at <strong>{currentAttendancePct}%</strong>, which is
                  below the mandatory institutional examination benchmark of <strong>{threshold}%</strong>. Please review
                  course-wise logs or consult the faculty advisor to schedule remedial sessions.
                </p>
                {riskDetails?.recommendedAction && (
                  <p className="mt-1 text-amber-300 font-semibold">
                    Advisory: {riskDetails.recommendedAction}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
              <h3 className="text-sm font-bold text-white tracking-wide mb-1">
                Semester Attendance Compliance ({selectedChild.name})
              </h3>
              <p className="text-xs text-slate-400 mb-4">Tracking monthly compliance over time</p>
              <AttendanceTrendChart />
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
              <h3 className="text-sm font-bold text-white tracking-wide mb-1">
                Subject-Wise Assessment Scores
              </h3>
              <p className="text-xs text-slate-400 mb-4">Comparison of marks obtained across subjects</p>
              <MarksComparisonChart />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'attendance-marks' && (
        <div className="space-y-6">
          {/* Course-Wise Attendance Records Table */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  Course-Wise Attendance Records
                </h3>
                <p className="text-xs text-slate-400">Official session records and exam eligibility</p>
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
                    <th className="py-2.5 px-3">Total Held</th>
                    <th className="py-2.5 px-3">Attended</th>
                    <th className="py-2.5 px-3">Missed</th>
                    <th className="py-2.5 px-3">Attendance %</th>
                    <th className="py-2.5 px-3">Exam Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {activeAtt.subjectStats &&
                    activeAtt.subjectStats.map((item, idx) => {
                      const subShortage = item.percentage < threshold;
                      return (
                        <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 font-semibold text-white">
                            <div>{item.subject}</div>
                            {item.code && <span className="text-[10px] text-slate-400 font-mono">{item.code}</span>}
                          </td>
                          <td className="py-3 px-3 font-mono">{item.total}</td>
                          <td className="py-3 px-3 font-mono text-emerald-400 font-bold">{item.present}</td>
                          <td className="py-3 px-3 font-mono text-rose-400">{item.absent || 0}</td>
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

          {/* Internal Examination Results Cards */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md space-y-3">
            <h3 className="text-sm font-bold text-white tracking-wide">
              Internal Continuous Evaluation Transcripts
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeMarks.subjectAverages &&
                activeMarks.subjectAverages.map((sub, idx) => {
                  const subRemedial = sub.averagePercentage < 50;
                  return (
                    <div key={idx} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-2">
                      <div className="flex items-center justify-between font-bold text-white">
                        <span>{sub.subject}</span>
                        <span className={`px-2 py-0.5 rounded-md text-xs font-mono ${subRemedial ? 'text-rose-400 bg-rose-500/10' : 'text-indigo-400 bg-indigo-500/10'}`}>
                          {sub.averagePercentage}% Avg
                        </span>
                      </div>
                      <div className="space-y-1.5 pt-1">
                        {sub.assessments &&
                          sub.assessments.map((a, i) => (
                            <div key={i} className="flex justify-between items-center text-slate-400 py-1 border-b border-slate-900 last:border-0">
                              <span>{a.title || a.type}</span>
                              <span className="font-mono text-slate-200 font-semibold">
                                <span className={a.percentage < 50 ? 'text-rose-400' : 'text-emerald-400'}>
                                  {a.obtained}
                                </span>{' '}
                                / {a.max} ({a.percentage}%)
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {wardAssignments.map((item) => (
              <div
                key={item._id}
                className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
                      {item.subject?.name || item.subject}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.status === 'Graded'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : item.status === 'Submitted'
                          ? 'bg-indigo-500/15 text-indigo-400'
                          : item.status === 'Missing'
                          ? 'bg-rose-500/15 text-rose-400'
                          : item.status === 'Late'
                          ? 'bg-orange-500/15 text-orange-400'
                          : 'bg-amber-500/15 text-amber-400'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white mb-1">{item.title}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2">{item.description}</p>
                </div>
                <div className="pt-3 mt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                  <span>Due: {new Date(item.dueDate).toLocaleDateString()}</span>
                  <span className="font-mono font-bold text-slate-200">
                    {item.mySubmission?.obtainedMarks !== undefined && item.mySubmission?.obtainedMarks !== null
                      ? `${item.mySubmission.obtainedMarks}/${item.maxMarks || 50}`
                      : item.obtainedMarks !== null && item.obtainedMarks !== undefined
                      ? `${item.obtainedMarks}/${item.maxMarks || item.maxPoints || 50}`
                      : `${item.maxMarks || item.maxPoints || 50} pts`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'leaves' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">Student Leave History & Requests</h3>
            <button
              onClick={() => setIsApplyLeaveOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Apply Leave for {selectedChild.name.split(' ')[0]}</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase text-slate-400">
                  <th className="py-3 px-4">Leave Type</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Faculty Response</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leaves.map((lv) => (
                  <tr key={lv._id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-semibold text-white">{lv.leaveType}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {lv.startDate} to {lv.endDate}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{lv.reason}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          lv.status === 'Approved'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : lv.status === 'Rejected'
                            ? 'bg-rose-500/15 text-rose-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {lv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400 italic">{lv.facultyRemarks || 'Pending review'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'warnings' && (
        <div className="space-y-6">
          {/* Header with Title and Voice Language Preference Controls */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white tracking-tight">
                  Academic Notices & Warnings: {selectedChild.name}
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Official institutional communications regarding attendance, marks, and assignments.
              </p>
            </div>

            {/* Language Preference Switcher for Audio & Notifications */}
            <div className="flex items-center gap-3 bg-slate-950 p-2 rounded-xl border border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Languages className="w-4 h-4 text-indigo-400" />
                <span>Voice Language:</span>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleLanguageChange('en')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    speechLanguage === 'en'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange('ta')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    speechLanguage === 'ta'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  தமிழ் (Tamil)
                </button>
              </div>
              {langSaving && <span className="text-[10px] text-indigo-400 animate-pulse">Saving...</span>}
            </div>
          </div>

          {/* Browser TTS Transparent Advisory Notice */}
          <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/30 text-xs text-indigo-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Volume2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
              <span>
                <strong>Voice-Friendly Notifications:</strong> Press the <strong>Listen</strong> button on any notice to hear an audio reading via browser speech synthesis. (Note: Audio plays locally through your device; no automated telephone call is placed).
              </span>
            </div>
            {playingNotifId && (
              <button
                type="button"
                onClick={handleStopVoice}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600/30 border border-rose-500/40 text-rose-300 hover:bg-rose-600/50 text-xs font-semibold"
              >
                <Square className="w-3 h-3 fill-rose-300" />
                <span>Stop Audio</span>
              </button>
            )}
          </div>

          {/* Warning Notifications List */}
          <div className="space-y-4">
            {parentNotifications.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-slate-900/40 border border-slate-800">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-white">No Active Academic Warnings</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  {selectedChild.name} is currently maintaining satisfactory engagement across attendance and assessments.
                </p>
              </div>
            ) : (
              parentNotifications.map((notif) => {
                const isPlaying = playingNotifId === notif._id;
                const isCritical =
                  notif.type.includes('alert') ||
                  notif.type.includes('risk') ||
                  notif.type.includes('warning');

                return (
                  <div
                    key={notif._id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isPlaying
                        ? 'bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-950/50 ring-1 ring-indigo-500'
                        : isCritical
                        ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-900/60 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isCritical
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                            }`}
                          >
                            {notif.type.replace('_', ' ').toUpperCase()}
                          </span>

                          <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(
                              notif.createdAt || notif.academicDetails?.date
                            ).toLocaleDateString()}
                          </span>

                          {/* Multi-channel delivery indicators */}
                          <div className="flex items-center gap-1.5 ml-2">
                            {notif.emailDetails?.status === 'delivered' ||
                            notif.deliveryStatus?.emailSent ? (
                              <span className="flex items-center gap-1 text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                <Mail className="w-3 h-3" /> Email Dispatched
                              </span>
                            ) : null}
                            {notif.smsDetails?.status === 'delivered' ||
                            notif.deliveryStatus?.smsSent ? (
                              <span className="flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                <MessageSquare className="w-3 h-3" /> SMS Delivered
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <h4 className="text-sm font-bold text-white tracking-tight">{notif.title}</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">{notif.message}</p>

                        {/* Academic Metric Box */}
                        {notif.academicDetails?.currentMetric && (
                          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                            <div>
                              <span className="text-slate-400 block text-[11px]">Recorded Deficit:</span>
                              <span className="font-semibold text-rose-300">
                                {notif.academicDetails.currentMetric}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[11px]">
                                Recommended Action:
                              </span>
                              <span className="font-semibold text-sky-300">
                                {notif.academicDetails.recommendedAction ||
                                  'Meet with faculty mentor.'}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Localized Voice Transcript Preview */}
                        <div className="p-2.5 rounded-lg bg-slate-950/40 border border-slate-800/60 text-[11px] text-slate-400 flex items-start gap-2">
                          <Volume2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium text-slate-300">
                              Voice Reading Preview ({speechLanguage === 'ta' ? 'Tamil' : 'English'}):{' '}
                            </span>
                            <span>
                              {speechLanguage === 'ta'
                                ? notif.voiceMessage?.ta ||
                                  notif.voiceDetails?.transcript ||
                                  `Vanakkam. Your child has attendance below 75 percent. Please contact the class faculty for further details.`
                                : notif.voiceMessage?.en ||
                                  notif.voiceDetails?.transcript ||
                                  notif.message}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Button: Listen / Stop */}
                      <div className="flex md:flex-col items-center gap-2 self-start flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handlePlayVoice(notif)}
                          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                            isPlaying
                              ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                          }`}
                        >
                          {isPlaying ? (
                            <>
                              <Square className="w-3.5 h-3.5 fill-white" />
                              <span>Stop Audio</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Listen ({speechLanguage === 'ta' ? 'தமிழ்' : 'EN'})</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Reports & Official Academic Transcripts for Selected Ward */}
      {activeTab === 'reports' && (
        <AcademicReportsHub role="parent" currentStudent={selectedChild} />
      )}

      {/* Leave Application Modal */}
      {isApplyLeaveOpen && (
        <Modal
          title={`Apply Leave for ${selectedChild.name}`}
          isOpen={isApplyLeaveOpen}
          onClose={() => setIsApplyLeaveOpen(false)}
        >
          {leaveSuccess ? (
            <div className="p-4 rounded-xl bg-emerald-950/40 text-emerald-300 text-xs font-semibold text-center">
              ✓ {leaveSuccess}
            </div>
          ) : (
            <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Leave Category</label>
                <select
                  value={newLeave.leaveType}
                  onChange={(e) => setNewLeave({ ...newLeave, leaveType: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                >
                  <option value="Medical">Medical Leave</option>
                  <option value="Personal">Personal / Family Emergency</option>
                  <option value="Academic/Duty">Duty / Extra-Curricular</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={newLeave.startDate}
                    onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={newLeave.endDate}
                    onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Reason for Leave</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Specify circumstances..."
                  value={newLeave.reason}
                  onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsApplyLeaveOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold"
                >
                  Submit Application
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
};

export default ParentDashboard;
