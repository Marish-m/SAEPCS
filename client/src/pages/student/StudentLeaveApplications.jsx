import React, { useState, useEffect } from 'react';
import Modal from '../../components/common/Modal';
import {
  CalendarCheck,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Upload,
  Download,
  FileText,
  X,
  ShieldCheck,
  HeartPulse,
  Briefcase,
  Users,
  Compass
} from 'lucide-react';
import apiService from '../../api/apiService';
import { SAMPLE_LEAVES } from '../../data/mockData';

const StudentLeaveApplications = () => {
  const [leaves, setLeaves] = useState([]);
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Apply Leave Modal State
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [newLeave, setNewLeave] = useState({
    leaveType: 'Medical',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState('');
  const [dateError, setDateError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchLeaveData = async () => {
    setLoading(true);
    try {
      const [leavesRes, usageRes] = await Promise.allSettled([
        apiService.getLeaves(),
        apiService.getLeaveUsage('me'),
      ]);

      if (leavesRes.status === 'fulfilled' && leavesRes.value.data?.leaves) {
        setLeaves(leavesRes.value.data.leaves);
      } else {
        setLeaves(SAMPLE_LEAVES);
      }

      if (usageRes.status === 'fulfilled' && usageRes.value.data?.usage) {
        setUsageData(usageRes.value.data.usage);
      } else {
        // Compute fallback stats
        const approvedDays = SAMPLE_LEAVES.filter((l) => l.status === 'Approved').length * 2;
        setUsageData({
          totalApprovedDays: approvedDays,
          threshold: 6,
          remainingDays: Math.max(0, 6 - approvedDays),
          isExceeded: approvedDays >= 6,
          breakdownByType: {
            Medical: 2,
            'Academic/Duty': 2,
            Personal: 0,
            Family: 0,
          },
        });
      }
    } catch (err) {
      console.warn('Error fetching leave applications:', err);
      setLeaves(SAMPLE_LEAVES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveData();
  }, []);

  const handleOpenApplyModal = () => {
    // Tomorrow as default start date
    const tom = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const dateStr = tom.toISOString().split('T')[0];
    setNewLeave({
      leaveType: 'Medical',
      startDate: dateStr,
      endDate: dateStr,
      reason: '',
    });
    setSelectedFile(null);
    setFileError('');
    setDateError('');
    setErrorMsg('');
    setSuccessMsg('');
    setIsApplyModalOpen(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExts = ['.pdf', '.doc', '.docx', '.zip', '.txt', '.png', '.jpg', '.jpeg'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedExts.includes(fileExt)) {
      setFileError('Unsupported file type. Please upload PDF, DOC, DOCX, ZIP, or Image.');
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setFileError('File size exceeds 10MB limit.');
      setSelectedFile(null);
      return;
    }

    setFileError('');
    setSelectedFile(file);
  };

  const calculateRequestedDays = () => {
    if (!newLeave.startDate || !newLeave.endDate) return 1;
    const start = new Date(newLeave.startDate);
    const end = new Date(newLeave.endDate);
    if (end < start) return 0;
    const diff = Math.abs(end - start);
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  };

  const handleApplyLeave = async (e) => {
    e.preventDefault();

    // STRICT DATE RANGE VALIDATION
    if (!newLeave.startDate || !newLeave.endDate) {
      setDateError('Both start date and end date are required.');
      return;
    }

    const start = new Date(newLeave.startDate);
    const end = new Date(newLeave.endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setDateError('Please enter valid calendar dates.');
      return;
    }

    if (end < start) {
      setDateError('End date cannot be earlier than start date.');
      return;
    }

    setDateError('');
    setApplying(true);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('startDate', newLeave.startDate);
      formData.append('endDate', newLeave.endDate);
      formData.append('leaveType', newLeave.leaveType);
      formData.append('reason', newLeave.reason.trim());
      if (selectedFile) {
        formData.append('document', selectedFile);
      }

      const res = await apiService.applyLeave(formData);

      setSuccessMsg(res.data?.message || 'Leave application submitted for faculty advisor review.');
      setTimeout(() => {
        setIsApplyModalOpen(false);
        fetchLeaveData();
      }, 1400);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to submit leave application.';
      setErrorMsg(msg);
    } finally {
      setApplying(false);
    }
  };

  const threshold = usageData?.threshold || 6;
  const approvedDays = usageData?.totalApprovedDays || 0;
  const remainingDays = usageData?.remainingDays ?? Math.max(0, threshold - approvedDays);
  const isExceeded = usageData?.isExceeded || approvedDays >= threshold;
  const percentUsed = Math.min(100, Math.round((approvedDays / threshold) * 100));

  const requestedDays = calculateRequestedDays();
  const willExceed = approvedDays + requestedDays > threshold;

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
              <h2 className="text-base font-bold text-white tracking-tight">Student Leave Applications & Quota</h2>
              <p className="text-xs text-slate-400">
                Submit medical, academic on-duty, or personal leave requests. Approved on-duty leaves receive attendance credit.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenApplyModal}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {/* Institutional Leave Quota Compliance Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-slate-800 shadow-xl backdrop-blur-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>Institutional Leave Quota Policy</span>
            </h3>
            <p className="text-xs text-slate-400">
              Institution limit allows up to <strong className="text-slate-200">{threshold} approved days</strong> before academic risk flags are triggered.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-bold font-mono ${
                isExceeded
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : percentUsed >= 75
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {approvedDays} / {threshold} Days Taken
            </span>
          </div>
        </div>

        {/* Quota Progress Bar */}
        <div>
          <div className="flex justify-between text-xs mb-1.5 font-medium">
            <span className="text-slate-400">Approved Leave Usage:</span>
            <span className={isExceeded ? 'text-rose-400 font-bold' : 'text-slate-300'}>
              {percentUsed}% ({remainingDays} days remaining)
            </span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                isExceeded
                  ? 'bg-rose-500'
                  : percentUsed >= 75
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>
        </div>

        {/* Category Breakdown Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center gap-3">
            <HeartPulse className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Medical</span>
              <span className="text-xs font-mono font-bold text-slate-200">
                {usageData?.breakdownByType?.Medical || 0} Days
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center gap-3">
            <Briefcase className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Academic On-Duty</span>
              <span className="text-xs font-mono font-bold text-slate-200">
                {usageData?.breakdownByType?.['Academic/Duty'] || 0} Days
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center gap-3">
            <Compass className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Personal</span>
              <span className="text-xs font-mono font-bold text-slate-200">
                {usageData?.breakdownByType?.Personal || 0} Days
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center gap-3">
            <Users className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Family</span>
              <span className="text-xs font-mono font-bold text-slate-200">
                {usageData?.breakdownByType?.Family || 0} Days
              </span>
            </div>
          </div>
        </div>

        {/* Warning if exceeded */}
        {isExceeded && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>
              <strong>Excessive Leave Alert:</strong> You have reached or exceeded the institutional limit of {threshold} days.
              Further non-duty leaves will reduce your attendance percentage and may impact exam hall ticket issuance.
            </span>
          </div>
        )}
      </div>

      {/* Leave History List */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-white tracking-wide">Leave History & Review Records</h3>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
            Loading leave applications...
          </div>
        ) : leaves.length === 0 ? (
          <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-500">
            No leave applications recorded yet. Click "Apply for Leave" above.
          </div>
        ) : (
          leaves.map((item) => {
            const isApproved = item.status === 'Approved';
            const isRejected = item.status === 'Rejected';
            const isPending = item.status === 'Pending';
            const startStr = item.startDate ? new Date(item.startDate).toLocaleDateString() : 'N/A';
            const endStr = item.endDate ? new Date(item.endDate).toLocaleDateString() : 'N/A';
            const duration = item.durationDays || 1;
            const reviewerName = item.reviewedBy?.user?.name || item.reviewedBy?.name;

            return (
              <div
                key={item._id}
                className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      {item.leaveType}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {startStr} to {endStr}
                    </span>
                    <span className="text-[11px] font-bold text-slate-300 font-mono">
                      ({duration} {duration === 1 ? 'day' : 'days'})
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 font-medium leading-relaxed">{item.reason}</p>

                  {/* Supporting Document Link */}
                  {item.documentUrl && (
                    <div>
                      <a
                        href={item.documentUrl.startsWith('http') ? item.documentUrl : `http://localhost:5000${item.documentUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:underline pt-0.5"
                      >
                        <Download className="w-3 h-3" />
                        <span>Supporting Document: {item.documentName || 'Certificate'}</span>
                      </a>
                    </div>
                  )}

                  {/* Reviewer Details */}
                  {item.facultyRemarks && (
                    <div className="text-[11px] text-indigo-300 italic pt-1 border-t border-slate-850">
                      Faculty Remarks: "{item.facultyRemarks}"
                      {reviewerName && <span className="text-slate-400 not-italic"> — Reviewer: {reviewerName}</span>}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 ${
                      isApproved
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : isRejected
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {isApproved ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : isRejected ? (
                      <XCircle className="w-3.5 h-3.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    <span>{item.status}</span>
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Apply for Leave */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => !applying && setIsApplyModalOpen(false)}
        title="Apply for Student Leave"
        subtitle="Submit medical certificate, academic on-duty letter, or personal leave application"
      >
        <form onSubmit={handleApplyLeave} className="space-y-4">
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

          {dateError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{dateError}</span>
            </div>
          )}

          {/* Quota Impact Advisory Banner */}
          {willExceed && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Institutional Quota Advisory:</span>
                This request for {requestedDays} days would bring your approved leave to {approvedDays + requestedDays} days,
                exceeding the institutional limit of {threshold} days. Make sure to attach doctor/official certificates.
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Leave Category <span className="text-rose-400">*</span>
            </label>
            <select
              value={newLeave.leaveType}
              onChange={(e) => setNewLeave({ ...newLeave, leaveType: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="Medical">Medical Leave (Doctor Certificate)</option>
              <option value="Academic/Duty">Academic On-Duty (Hackathon, Sports, Paper Presentation)</option>
              <option value="Personal">Personal Emergency</option>
              <option value="Family">Family Function / Bereavement</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Start Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={newLeave.startDate}
                onChange={(e) => setNewLeave({ ...newLeave, startDate: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                End Date <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={newLeave.endDate}
                onChange={(e) => setNewLeave({ ...newLeave, endDate: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            Requested Duration: <span className="font-bold text-white font-mono">{requestedDays} day{requestedDays > 1 ? 's' : ''}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Detailed Reason for Absence <span className="text-rose-400">*</span>
            </label>
            <textarea
              rows="3"
              required
              value={newLeave.reason}
              onChange={(e) => setNewLeave({ ...newLeave, reason: e.target.value })}
              placeholder="State reason clearly for faculty advisor review..."
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Supporting Document Upload */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Attach Supporting Document <span className="text-slate-500 font-normal">(Medical certificate, invitation letter - optional)</span>
            </label>
            <div className="p-3 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 hover:border-indigo-500/50 transition-colors text-center relative">
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.zip,.txt,.png,.jpg,.jpeg"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
              <p className="text-xs text-slate-300 font-medium">
                {selectedFile ? selectedFile.name : 'Click to select certificate / document'}
              </p>
              <p className="text-[10px] text-slate-500">Supported: PDF, DOC, DOCX, ZIP, PNG, JPG (up to 10MB)</p>
            </div>
            {selectedFile && (
              <div className="mt-2 flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <span className="truncate max-w-xs font-mono">{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-slate-400 hover:text-rose-400 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {fileError && <p className="text-[11px] text-rose-400 mt-1">{fileError}</p>}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              disabled={applying}
              onClick={() => setIsApplyModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={applying}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md disabled:opacity-50"
            >
              {applying ? 'Submitting Application...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StudentLeaveApplications;
