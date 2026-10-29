import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  BookOpen,
  FileText,
  CalendarCheck,
  Award,
  AlertTriangle,
  ClipboardList,
  Bell,
  GraduationCap,
  Building2,
  FolderClock,
  HeartHandshake,
  CheckCircle,
  PhoneCall,
  X,
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose, activeTab, onSelectTab }) => {
  const { role, user } = useAuth();

  const navItemsByRole = {
    admin: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'students-faculty', label: 'Student & Faculty Mgmt', icon: Users },
      { id: 'parents', label: 'Parent Management', icon: HeartHandshake },
      { id: 'departments', label: 'Departments & Subjects', icon: Building2 },
      { id: 'reports', label: 'Reports & Audits', icon: FileText },
      { id: 'notifications', label: 'Notification History', icon: FolderClock },
    ],
    faculty: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'parent-communication', label: 'Parent Communication', icon: PhoneCall, badge: 'Direct' },
      { id: 'attendance', label: 'Attendance Tracking', icon: CalendarCheck },
      { id: 'marks', label: 'Internal Marks', icon: Award },
      { id: 'assignments', label: 'Assignment Manager', icon: ClipboardList },
      { id: 'leaves', label: 'Leave Approvals', icon: CheckCircle },
      { id: 'at-risk', label: 'At-Risk Students', icon: AlertTriangle, badge: 'High Priority' },
      { id: 'reports', label: 'Class Reports', icon: FileText },
    ],
    student: [
      { id: 'attendance', label: 'My Attendance', icon: CalendarCheck },
      { id: 'marks', label: 'My Marks', icon: Award },
      { id: 'assignments', label: 'Assignments', icon: ClipboardList },
      { id: 'leaves', label: 'Leave Applications', icon: CheckCircle },
      { id: 'reports', label: 'My Academic Reports', icon: FileText },
      { id: 'notifications', label: 'Notifications', icon: Bell },
    ],
    parent: [
      { id: 'overview', label: 'Student Profile', icon: UserCheck },
      { id: 'attendance-marks', label: 'Attendance & Marks', icon: Award },
      { id: 'assignments', label: 'Assignment Status', icon: ClipboardList },
      { id: 'leaves', label: 'Leave History & Apply', icon: CheckCircle },
      { id: 'warnings', label: 'Academic Warnings', icon: AlertTriangle, badge: 'Alerts' },
      { id: 'reports', label: 'Reports & Export', icon: FileText },
    ],
  };

  const navItems = navItemsByRole[role] || navItemsByRole.faculty;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Content */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-64 bg-slate-950 border-r border-slate-800/80 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base font-extrabold tracking-tight text-white block">SAEPCS</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 block -mt-1">
                College Portal
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 rounded-lg hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Pill Indicator */}
        <div className="px-5 py-3 border-b border-slate-900 bg-slate-900/40">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Logged Role:</span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {role}
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onClose) onClose();
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-indigo-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Card in Footer */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-white truncate">{user?.name || 'Academic User'}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email || 'portal@saepcs.edu'}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
