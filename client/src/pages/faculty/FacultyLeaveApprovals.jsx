import React, { useState, useEffect } from 'react';
import Modal from '../../components/common/Modal';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Check,
  X,
  AlertTriangle,
  Download,
  CalendarCheck,
  Search,
  Users,
  FileText,
  ShieldCheck,
  MessageSquare
} from 'lucide-react';
import apiService from '../../api/apiService';
import { SAMPLE_LEAVES } from '../../data/mockData';

const FacultyLeaveApprovals = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('Pending'); // Pending, Approved, Rejected, All
  const [searchQuery, setSearchQuery] = useState('');

  // Decision Modal State
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [decisionType, setDecisionType] = useState('Approved'); // 'Approved' or 'Rejected'
  const [facultyRemarks, setFacultyRemarks] = useState('');
  const [processing, setProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const res = await apiService.getLeaves();
      if (res.data?.leaves) {
        setLeaves(res.data.leaves);
      } else {
        setLeaves(SAMPLE_LEAVES);
      }
    } catch (err) {
      console.warn('Error fetching leave applications:', err);
      setLeaves(SAMPLE_LEAVES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleOpenDecision = (leave, type) => {
    setSelectedLeave(leave);
    setDecisionType(type);
    setFacultyRemarks(
      type === 'Approved'
        ? leave.leaveType === 'Academic/Duty'
          ? 'Approved with academic on-duty attendance credit.'
          : 'Verified medical certificate; approved with attendance concession.'
        : 'Medical document inadequate or unexcused absence.'
    );
    setErrorMsg('');
    setDecisionModalOpen(true);
  };

  const handleConfirmDecision = async (e) => {
    e.preventDefault();
    if (!selectedLeave) return;

    setProcessing(true);
    setErrorMsg('');

    try {
      const res = await apiService.updateLeaveStatus(selectedLeave._id, {
        status: decisionType,
        facultyRemarks: facultyRemarks.trim(),
      });

      // Update state locally
      setLeaves((prev) =>
        prev.map((l) =>
          l._id === selectedLeave._id
            ? {
                ...l,
                status: decisionType,
                facultyRemarks: facultyRemarks.trim(),
                reviewedAt: new Date(),
              }
            : l
        )
      );

      setFeedbackMsg(
        `Leave application ${decisionType.toLowerCase()}! Student & parent notified automatically and academic risk recalculated.`
      );
      setTimeout(() => {
        setFeedbackMsg('');
        setDecisionModalOpen(false);
        fetchLeaves();
      }, 1400);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update leave status.';
      setErrorMsg(msg);
    } finally {
      setProcessing(false);
    }
  };

  const filteredLeaves = leaves.filter((item) => {
    if (selectedFilter !== 'All' && item.status !== selectedFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const studentName = (item.student?.user?.name || item.studentName || '').toLowerCase();
      const rollNumber = (item.student?.rollNumber || item.rollNumber || '').toLowerCase();
      const reason = (item.reason || '').toLowerCase();
      return studentName.includes(q) || rollNumber.includes(q) || reason.includes(q);
    }
    return true;
  });

  const stats = {
    pending: leaves.filter((l) => l.status === 'Pending').length,
    approved: leaves.filter((l) => l.status === 'Approved').length,
    rejected: leaves.filter((l) => l.status === 'Rejected').length,
    total: leaves.length,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Student & Parent Leave Approvals</h2>
              <p className="text-xs text-slate-400">
                Review leave applications, verify documents, and record endorsements. Approved on-duty leaves receive attendance credit.
              </p>
            </div>
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-slate-800">
          {[
            { id: 'Pending', label: 'Pending Review', count: stats.pending },
            { id: 'Approved', label: 'Approved', count: stats.approved },
            { id: 'Rejected', label: 'Rejected', count: stats.rejected },
            { id: 'All', label: 'All Requests', count: stats.total },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedFilter === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search student or roll number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Applications Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
              <th className="px-5 py-3.5">Student</th>
              <th className="px-5 py-3.5">Leave Type</th>
              <th className="px-5 py-3.5">Duration</th>
              <th className="px-5 py-3.5">Reason & Document</th>
              <th className="px-5 py-3.5">Applied By</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Review Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-5 py-8 text-center text-slate-400">
                  <div className="w-6 h-6 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
                  Loading leave applications...
                </td>
              </tr>
            ) : filteredLeaves.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-5 py-8 text-center text-slate-500">
                  No leave requests found for category "{selectedFilter}".
                </td>
              </tr>
            ) : (
              filteredLeaves.map((leave) => {
                const studentName = leave.student?.user?.name || leave.studentName || 'Student';
                const rollNumber = leave.student?.rollNumber || leave.rollNumber || 'N/A';
                const startStr = leave.startDate ? new Date(leave.startDate).toLocaleDateString() : 'N/A';
                const endStr = leave.endDate ? new Date(leave.endDate).toLocaleDateString() : 'N/A';
                const duration = leave.durationDays || 1;
                const reviewerName = leave.reviewedBy?.user?.name || leave.reviewedBy?.name;

                return (
                  <tr key={leave._id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-white">{studentName}</div>
                      <div className="text-[10px] font-mono text-slate-400">{rollNumber}</div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {leave.leaveType}
                      </span>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="font-mono text-slate-200">
                        {startStr} to {endStr}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold">
                        {duration} {duration === 1 ? 'day' : 'days'}
                      </div>
                    </td>

                    <td className="px-5 py-3.5 max-w-xs">
                      <p className="line-clamp-2 text-slate-300 leading-relaxed">{leave.reason}</p>
                      {leave.documentUrl && (
                        <a
                          href={leave.documentUrl.startsWith('http') ? leave.documentUrl : `http://localhost:5000${leave.documentUrl}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:underline mt-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>View {leave.documentName || 'Attachment'}</span>
                        </a>
                      )}
                      {leave.facultyRemarks && (
                        <p className="text-[10px] text-indigo-400 mt-1 italic">
                          Remarks: "{leave.facultyRemarks}"
                          {reviewerName && <span className="text-slate-400 not-italic"> ({reviewerName})</span>}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-3.5 capitalize font-medium text-slate-400">
                      {leave.appliedBy || 'student'}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                          leave.status === 'Approved'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : leave.status === 'Rejected'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {leave.status === 'Approved' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : leave.status === 'Rejected' ? (
                          <XCircle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        <span>{leave.status}</span>
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      {leave.status === 'Pending' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenDecision(leave, 'Approved')}
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-600 hover:text-white rounded-lg border border-emerald-500/20 transition-all flex items-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleOpenDecision(leave, 'Rejected')}
                            className="px-2.5 py-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-600 hover:text-white rounded-lg border border-rose-500/20 transition-all flex items-center gap-1"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500">
                          Reviewed {leave.reviewedAt ? new Date(leave.reviewedAt).toLocaleDateString() : ''}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Decision Modal */}
      <Modal
        isOpen={decisionModalOpen}
        onClose={() => !processing && setDecisionModalOpen(false)}
        title={`${decisionType} Leave Application`}
        subtitle={`Student: ${selectedLeave?.student?.user?.name || selectedLeave?.studentName || ''} (${
          selectedLeave?.student?.rollNumber || selectedLeave?.rollNumber || ''
        })`}
      >
        <form onSubmit={handleConfirmDecision} className="space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
            <div className="flex justify-between text-slate-400">
              <span>Category: <strong>{selectedLeave?.leaveType}</strong></span>
              <span>
                Duration:{' '}
                <strong>
                  {selectedLeave?.durationDays || 1} day{(selectedLeave?.durationDays || 1) > 1 ? 's' : ''}
                </strong>
              </span>
            </div>
            <div className="text-slate-300">
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Reason Stated:</span>
              <p className="italic mt-0.5">{selectedLeave?.reason}</p>
            </div>
            {selectedLeave?.documentUrl && (
              <a
                href={selectedLeave.documentUrl.startsWith('http') ? selectedLeave.documentUrl : `http://localhost:5000${selectedLeave.documentUrl}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:underline pt-1"
              >
                <Download className="w-3 h-3" />
                <span>Verify Attached Document ({selectedLeave.documentName || 'Attachment'})</span>
              </a>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Faculty Endorsement Remarks / Written Comments <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows="3"
              required
              value={facultyRemarks}
              onChange={(e) => setFacultyRemarks(e.target.value)}
              placeholder="State rationale, attendance concession policy, or reason for rejection..."
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={processing}
              onClick={() => setDecisionModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processing}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-md transition-all ${
                decisionType === 'Approved'
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                  : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
              }`}
            >
              {processing ? 'Recording Decision...' : `Confirm ${decisionType}`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default FacultyLeaveApprovals;
