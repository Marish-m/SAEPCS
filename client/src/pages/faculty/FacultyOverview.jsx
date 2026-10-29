import React from 'react';
import StatCard from '../../components/common/StatCard';
import RiskBadge from '../../components/common/RiskBadge';
import AttendanceTrendChart from '../../components/charts/AttendanceTrendChart';
import { CalendarCheck, Award, ClipboardList, AlertTriangle, ArrowRight, UserCheck } from 'lucide-react';
import { SAMPLE_STUDENTS, SAMPLE_LEAVES, SAMPLE_ASSIGNMENTS } from '../../data/mockData';

const FacultyOverview = ({ onNavigate }) => {
  const atRiskCount = SAMPLE_STUDENTS.filter((s) => s.attendance < 75 || s.riskLevel === 'High Risk').length;
  const pendingLeaves = SAMPLE_LEAVES.filter((l) => l.status === 'Pending').length;
  const activeAssignments = SAMPLE_ASSIGNMENTS.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Class Attendance"
          value="89.4%"
          subtext="Today's marked session average"
          icon={CalendarCheck}
          color="emerald"
        />
        <StatCard
          title="At-Risk Students"
          value={atRiskCount.toString()}
          subtext="Under 75% attendance or failing"
          icon={AlertTriangle}
          color="rose"
        />
        <StatCard
          title="Pending Leaves"
          value={pendingLeaves.toString()}
          subtext="Awaiting faculty review"
          icon={UserCheck}
          color="amber"
        />
        <StatCard
          title="Active Assignments"
          value={activeAssignments.toString()}
          subtext="Published for this semester"
          icon={ClipboardList}
          color="indigo"
        />
      </div>

      {/* Quick Action Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/80 to-slate-900/80 border border-indigo-500/30 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide">
            Attendance Recording Due: Data Structures & Algorithms (Sec A)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Record today's session attendance. Automated alerts will dispatch to parents if attendance falls below 75%.
          </p>
        </div>
        <button
          onClick={() => onNavigate && onNavigate('attendance')}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition-all flex-shrink-0"
        >
          <span>Take Class Attendance</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Charts and Priority Watchlist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Attendance Progression (My Courses)</h3>
              <p className="text-xs text-slate-400">Weekly class attendance rates</p>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">Fall 2026</span>
          </div>
          <AttendanceTrendChart />
        </div>

        {/* Pending Leave Requests Card */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white tracking-wide">Pending Leave Applications</h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                {pendingLeaves} Pending
              </span>
            </div>

            <div className="space-y-3">
              {SAMPLE_LEAVES.filter((l) => l.status === 'Pending').map((leave) => (
                <div key={leave._id} className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                  <div className="flex items-center justify-between font-semibold text-white mb-1">
                    <span>{leave.studentName}</span>
                    <span className="text-[10px] text-amber-400 font-normal">{leave.leaveType}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 mb-2">{leave.reason}</p>
                  <div className="text-[10px] text-slate-500">
                    Duration: {leave.startDate} to {leave.endDate}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigate && onNavigate('leaves')}
            className="w-full mt-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-xl transition-colors text-center"
          >
            Review All Leave Requests
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacultyOverview;
