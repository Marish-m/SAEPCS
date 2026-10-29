import React, { useState, useEffect } from 'react';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AlertBanner from '../../components/common/AlertBanner';
import {
  Users,
  Link,
  Mail,
  Phone,
  UserPlus,
  Trash2,
  Unlink,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Building,
} from 'lucide-react';
import apiService from '../../api/apiService';

const AdminParents = () => {
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Link Child Modal State
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [linking, setLinking] = useState(false);

  // Register New Parent Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newParent, setNewParent] = useState({
    name: '',
    email: '',
    phone: '',
    password: 'Password@123',
    relationship: 'Father',
    occupation: '',
    studentId: '',
  });

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [parentRes, stuRes] = await Promise.all([
        apiService.getParentsList(),
        apiService.getStudents(),
      ]);

      const parentList = parentRes.data?.parents || [];
      const studentList = stuRes.data?.students || stuRes.data?.data || [];

      setParents(parentList);
      setStudents(studentList);
      if (studentList.length > 0) {
        setSelectedStudentId(studentList[0]._id);
      }
    } catch (err) {
      console.error('Failed to load parent management data:', err);
      setErrorMsg(err.response?.data?.message || 'Failed to load parents list from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLinkStudent = async (e) => {
    e.preventDefault();
    if (!selectedParent || !selectedStudentId) return;

    setLinking(true);
    setErrorMsg('');
    try {
      await apiService.linkStudentToParent({
        parentId: selectedParent._id,
        studentId: selectedStudentId,
      });

      setSuccessMsg(`Student ward successfully linked to ${selectedParent.user?.name || 'parent'}!`);
      setIsLinkModalOpen(false);
      fetchData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to link student to parent.');
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkStudent = async (parentId, studentId, studentName) => {
    if (!window.confirm(`Unlink ${studentName} from this parent profile?`)) return;

    try {
      await apiService.unlinkStudentFromParent({ parentId, studentId });
      setSuccessMsg(`Unlinked student ward successfully.`);
      fetchData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to unlink student.');
    }
  };

  const handleCreateParent = async (e) => {
    e.preventDefault();
    setCreating(true);
    setErrorMsg('');

    try {
      await apiService.createParent(newParent);
      setSuccessMsg(`Parent account created for ${newParent.name}! Default credentials set.`);
      setIsCreateModalOpen(false);
      setNewParent({
        name: '',
        email: '',
        phone: '',
        password: 'Password@123',
        relationship: 'Father',
        occupation: '',
        studentId: '',
      });
      fetchData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to create parent account.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteParent = async (parentId, parentName) => {
    if (!window.confirm(`Are you sure you want to deactivate ${parentName}'s parent account?`)) return;

    try {
      await apiService.deleteParent(parentId);
      setSuccessMsg(`Parent account deactivated successfully.`);
      fetchData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to deactivate parent.');
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Parent / Guardian',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-white flex items-center gap-2">
            <span>{row.user?.name || 'Registered Parent'}</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {row.relationship || 'Guardian'}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
            <Mail className="w-3 h-3 text-slate-500" />
            <span>{row.user?.email || 'N/A'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Contact Number',
      render: (row) => (
        <span className="font-mono text-xs text-slate-300 flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-indigo-400" />
          <span>{row.user?.phone || row.alternatePhone || 'Not Registered'}</span>
        </span>
      ),
    },
    {
      key: 'linkedStudents',
      label: 'Linked Student Wards',
      render: (row) => {
        const studentList = row.students || [];
        if (studentList.length === 0) {
          return (
            <span className="text-xs text-slate-500 italic">No student wards linked</span>
          );
        }

        return (
          <div className="flex flex-wrap gap-1.5 max-w-md">
            {studentList.map((st) => (
              <div
                key={st._id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs"
              >
                <span className="font-medium text-slate-200">
                  {st.user?.name || st.rollNumber}
                </span>
                <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950/60 px-1 py-0.5 rounded">
                  {st.rollNumber}
                </span>
                <button
                  onClick={() => handleUnlinkStudent(row._id, st._id, st.user?.name || st.rollNumber)}
                  title="Unlink ward"
                  className="text-slate-400 hover:text-rose-400 transition-colors ml-0.5"
                >
                  <Unlink className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      key: 'language',
      label: 'Voice / SMS Language',
      render: (row) => (
        <span className="px-2 py-0.5 text-[11px] font-bold uppercase rounded-md bg-slate-800 text-slate-300 border border-slate-700">
          {row.notificationLanguagePreference === 'ta' ? 'Tamil (ta)' : 'English (en)'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedParent(row);
              setIsLinkModalOpen(true);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-400 hover:text-white bg-indigo-500/10 hover:bg-indigo-600 rounded-lg border border-indigo-500/20 transition-all"
          >
            <Link className="w-3 h-3" />
            <span>Link Ward</span>
          </button>
          <button
            onClick={() => handleDeleteParent(row._id, row.user?.name || 'Parent')}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            title="Deactivate parent"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Parent Communication Directory</h2>
          <p className="text-xs text-slate-400">
            Link students to verified parent contacts for real-time automated SMS, Email, and voice alerts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-all"
            title="Refresh parents list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/25 active:scale-95 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register Parent</span>
          </button>
        </div>
      </div>

      {errorMsg && <AlertBanner type="error" message={errorMsg} onClose={() => setErrorMsg('')} />}
      {successMsg && <AlertBanner type="success" message={successMsg} onClose={() => setSuccessMsg('')} />}

      {loading ? (
        <div className="py-12 flex justify-center">
          <LoadingSpinner size="lg" message="Loading registered parents directory..." />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={parents}
          searchPlaceholder="Search parent by name, email, or ward..."
          searchField="user.name"
        />
      )}

      {/* Modal: Link Student to Parent */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title={`Link Student Ward to ${selectedParent?.user?.name || 'Parent'}`}
        subtitle="Associate an enrolled student with this verified parent account"
      >
        <form onSubmit={handleLinkStudent} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Select Enrolled Student
            </label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            >
              {students.map((st) => (
                <option key={st._id} value={st._id}>
                  {st.user?.name || st.name} ({st.rollNumber}) - Semester {st.semester}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-1">
            <p>
              Once linked, the parent will gain access to real-time attendance matrix, internal test marks,
              coursework assignments, and academic risk advisories for this ward.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsLinkModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={linking}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md disabled:opacity-50"
            >
              {linking ? 'Linking Ward...' : 'Confirm Link'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Register New Parent */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Register Parent Account"
        subtitle="Create institutional credentials for a student's parent or guardian"
      >
        <form onSubmit={handleCreateParent} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={newParent.name}
                onChange={(e) => setNewParent({ ...newParent, name: e.target.value })}
                placeholder="e.g. Ramesh Kumar"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                required
                value={newParent.email}
                onChange={(e) => setNewParent({ ...newParent, email: e.target.value })}
                placeholder="e.g. parent.ramesh@saepcs.edu"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Phone Number (SMS & Voice)
              </label>
              <input
                type="tel"
                value={newParent.phone}
                onChange={(e) => setNewParent({ ...newParent, phone: e.target.value })}
                placeholder="e.g. +91 98765 43210"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Relationship
              </label>
              <select
                value={newParent.relationship}
                onChange={(e) => setNewParent({ ...newParent, relationship: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Guardian">Guardian</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Associate Student Ward (Optional)
            </label>
            <select
              value={newParent.studentId}
              onChange={(e) => setNewParent({ ...newParent, studentId: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Associate later or leave empty --</option>
              {students.map((st) => (
                <option key={st._id} value={st._id}>
                  {st.user?.name || st.name} ({st.rollNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md disabled:opacity-50"
            >
              {creating ? 'Registering...' : 'Register Parent'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminParents;
