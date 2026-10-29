import React, { useState, useEffect } from 'react';
import StatCard from '../../components/common/StatCard';
import RiskDoughnutChart from '../../components/charts/RiskDoughnutChart';
import AttendanceTrendChart from '../../components/charts/AttendanceTrendChart';
import RiskBadge from '../../components/common/RiskBadge';
import {
  Users,
  GraduationCap,
  AlertTriangle,
  Building2,
  UserPlus,
  ArrowUpRight,
  Settings,
  Save,
  CheckCircle2,
  ShieldCheck,
  Percent,
} from 'lucide-react';
import apiService from '../../api/apiService';
import { SAMPLE_STUDENTS, SAMPLE_FACULTY } from '../../data/mockData';

const AdminOverview = ({ onNavigate }) => {
  const [students, setStudents] = useState(SAMPLE_STUDENTS);
  const [faculty, setFaculty] = useState(SAMPLE_FACULTY);
  const [loading, setLoading] = useState(false);

  // Configurable Risk Policy Thresholds
  const [attendanceThreshold, setAttendanceThreshold] = useState(75);
  const [marksThreshold, setMarksThreshold] = useState(50);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyFeedback, setPolicyFeedback] = useState('');

  // 1. Fetch Students, Faculty and Risk Policy Settings
  const fetchData = async () => {
    try {
      setLoading(true);
      const [stuRes, facRes, riskSettingsRes] = await Promise.allSettled([
        apiService.getStudents(),
        apiService.getFaculty(),
        apiService.getRiskSettings(),
      ]);

      if (stuRes.status === 'fulfilled' && stuRes.value.data?.students?.length > 0) {
        setStudents(stuRes.value.data.students);
      } else if (stuRes.status === 'fulfilled' && stuRes.value.data?.data?.length > 0) {
        setStudents(stuRes.value.data.data);
      }

      if (facRes.status === 'fulfilled' && facRes.value.data?.faculty) {
        setFaculty(facRes.value.data.faculty);
      }

      if (riskSettingsRes.status === 'fulfilled' && riskSettingsRes.value.data?.settings) {
        const s = riskSettingsRes.value.data.settings;
        setAttendanceThreshold(s.attendanceThreshold || 75);
        setMarksThreshold(s.marksThreshold || 50);
      }
    } catch {
      // Keep preview data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update Configurable Threshold
  const handleUpdatePolicy = async (e) => {
    e.preventDefault();
    setSavingPolicy(true);
    setPolicyFeedback('');

    try {
      const res = await apiService.updateRiskSettings({
        attendanceThreshold: Number(attendanceThreshold),
        marksThreshold: Number(marksThreshold),
        description: `Administrator updated attendance threshold to ${attendanceThreshold}%`,
      });

      setPolicyFeedback(
        `Academic risk policy updated to ${attendanceThreshold}% attendance. Re-evaluated ${res.data?.recalculatedCount || students.length} student academic profiles!`
      );

      // Refresh student list with newly calculated risk levels
      const stuRes = await apiService.getStudents();
      if (stuRes.data?.students) {
        setStudents(stuRes.data.students);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update risk policy.');
    } finally {
      setSavingPolicy(false);
    }
  };

  const totalStudents = students.length;
  const criticalRiskStudents = students.filter(
    (s) =>
      (s.risk?.attendancePercentage !== undefined
        ? s.risk.attendancePercentage < attendanceThreshold
        : (s.attendance || 80) < attendanceThreshold) ||
      s.risk?.riskLevel === 'Critical Risk' ||
      s.riskLevel === 'Critical Risk' ||
      s.riskLevel === 'High Risk'
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={totalStudents.toString()}
          subtext="Enrolled across academic departments"
          icon={GraduationCap}
          color="indigo"
          trend={{ label: '4.2%', positive: true }}
        />
        <StatCard
          title="Faculty Members"
          value={faculty.length.toString()}
          subtext="Active teaching staff"
          icon={Users}
          color="purple"
        />
        <StatCard
          title="Risk Policy Threshold"
          value={`${attendanceThreshold}%`}
          subtext="Configured attendance shortage limit"
          icon={Percent}
          color="cyan"
        />
        <StatCard
          title="At-Risk Students"
          value={criticalRiskStudents.length.toString()}
          subtext={`Attendance < ${attendanceThreshold}% or Low Marks`}
          icon={AlertTriangle}
          color="rose"
        />
      </div>

      {/* Administrator Policy Configuration Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border border-indigo-500/30 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Institutional Academic Risk Policy Benchmark (Administrator Configurable)
              </h3>
              <p className="text-xs text-slate-400">
                Modify the institutional attendance shortage threshold. Updates trigger real-time recalculation of risk profiles across all students.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
            Active Rule: &lt; {attendanceThreshold}% Flagged
          </span>
        </div>

        {policyFeedback && (
          <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{policyFeedback}</span>
          </div>
        )}

        <form onSubmit={handleUpdatePolicy} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end text-xs">
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Minimum Attendance Threshold (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="50"
                max="95"
                value={attendanceThreshold}
                onChange={(e) => setAttendanceThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold text-center focus:outline-none focus:border-indigo-500"
              />
              <span className="text-slate-400 font-bold">%</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Passing Benchmark for Internal Marks (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="35"
                max="75"
                value={marksThreshold}
                onChange={(e) => setMarksThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold text-center focus:outline-none focus:border-indigo-500"
              />
              <span className="text-slate-400 font-bold">%</span>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={savingPolicy}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 active:scale-95 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingPolicy ? 'Re-evaluating System...' : 'Update & Recalculate Risk Policy'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Attendance Trends */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Institution Attendance Progression</h3>
              <p className="text-xs text-slate-400">Monthly percentage across all enrolled students</p>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold">
              Current Semester
            </span>
          </div>
          <AttendanceTrendChart />
        </div>

        {/* Risk Distribution Doughnut */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide">Academic Risk Distribution</h3>
            <p className="text-xs text-slate-400">Categorization by attendance & assessment thresholds</p>
          </div>
          <RiskDoughnutChart
            counts={{
              low: students.filter((s) => (s.risk?.attendancePercentage || s.attendance || 85) >= 85).length || 65,
              moderate: students.filter((s) => (s.risk?.attendancePercentage || s.attendance || 80) >= attendanceThreshold && (s.risk?.attendancePercentage || s.attendance || 80) < 85).length || 20,
              high: criticalRiskStudents.length || 15,
            }}
          />
          <div className="pt-2 text-center text-[11px] text-slate-400">
            Mandatory criteria: {attendanceThreshold}% minimum university exam eligibility
          </div>
        </div>
      </div>

      {/* Critical Students Quick Watchlist */}
      <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <span>Urgent Attention: Students Under Attendance Shortage</span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                {criticalRiskStudents.length} Flagged (&lt;{attendanceThreshold}%)
              </span>
            </h3>
            <p className="text-xs text-slate-400">Immediate parent outreach recommended</p>
          </div>
          <button
            onClick={() => onNavigate && onNavigate('students-faculty')}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
          >
            <span>View All Students</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-semibold uppercase text-slate-400">
                <th className="py-2.5 px-3">Student Name</th>
                <th className="py-2.5 px-3">Roll No</th>
                <th className="py-2.5 px-3">Department</th>
                <th className="py-2.5 px-3">Attendance</th>
                <th className="py-2.5 px-3">Risk Classification</th>
                <th className="py-2.5 px-3">Linked Parent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {criticalRiskStudents.map((st) => {
                const attPct = st.risk?.attendancePercentage !== undefined ? st.risk.attendancePercentage : (st.attendance || 60);
                const rLevel = st.risk?.riskLevel || st.riskLevel || 'Critical Risk';
                return (
                  <tr key={st._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-white">{st.user?.name || st.name}</td>
                    <td className="py-3 px-3 font-mono text-slate-400">{st.rollNumber}</td>
                    <td className="py-3 px-3 text-slate-300">{st.department?.name || st.department || 'CSE'}</td>
                    <td className="py-3 px-3 font-bold text-rose-400">{attPct}%</td>
                    <td className="py-3 px-3">
                      <RiskBadge level={rLevel} size="sm" />
                    </td>
                    <td className="py-3 px-3 text-slate-300">
                      <div>{st.parents && st.parents[0]?.user?.name ? st.parents[0].user.name : (st.parentName || 'Robert Sharma')}</div>
                      <div className="text-[10px] text-slate-500">{st.parents && st.parents[0]?.user?.phone ? st.parents[0].user.phone : (st.parentPhone || '+1-555-0201')}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
