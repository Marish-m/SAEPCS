import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Bell,
  Menu,
  ChevronDown,
  LogOut,
  User,
  Shield,
  GraduationCap,
  Users,
  Briefcase,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { SAMPLE_NOTIFICATIONS } from '../../data/mockData';

const Navbar = ({ onToggleSidebar, activePageTitle = 'Dashboard' }) => {
  const { user, role, logout, demoLogin, isApiLive, verifyBackendHealth, apiChecking } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  const rolesList = [
    { id: 'admin', label: 'Admin (System)', icon: Shield, color: 'text-purple-400' },
    { id: 'faculty', label: 'Faculty (Prof. Alan)', icon: Briefcase, color: 'text-indigo-400' },
    { id: 'student', label: 'Student (Aarav)', icon: GraduationCap, color: 'text-emerald-400' },
    { id: 'parent', label: 'Parent (Robert)', icon: Users, color: 'text-amber-400' },
  ];

  const unreadCount = SAMPLE_NOTIFICATIONS.filter((n) => !n.isRead).length;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80">
      {/* Left Section: Mobile toggle and title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 text-slate-400 rounded-xl hover:text-white hover:bg-slate-800 lg:hidden transition-colors"
          aria-label="Toggle navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">{activePageTitle}</h1>
          <p className="hidden sm:block text-[11px] text-slate-400 font-medium">
            Student Academic Engagement Monitoring & Parent Communication
          </p>
        </div>
      </div>

      {/* Right Section: System Status, Role Switcher, Notifications, Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Backend API Health Indicator */}
        <button
          onClick={verifyBackendHealth}
          title="Click to re-verify live backend connection"
          className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-all ${
            isApiLive
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
          }`}
        >
          {apiChecking ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : isApiLive ? (
            <Wifi className="w-3 h-3 text-emerald-400" />
          ) : (
            <WifiOff className="w-3 h-3 text-amber-400" />
          )}
          <span>{isApiLive ? 'API Connected' : 'UI Preview Mode'}</span>
        </button>

        {/* Quick Role Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setRoleSwitcherOpen(!roleSwitcherOpen);
              setNotificationsOpen(false);
              setProfileDropdownOpen(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-300 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
          >
            <span className="capitalize text-indigo-400 font-bold">{role} View</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {roleSwitcherOpen && (
            <div className="absolute right-0 mt-2 w-56 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800">
                Switch Role Preview
              </div>
              <div className="py-1">
                {rolesList.map((r) => {
                  const Icon = r.icon;
                  const isCurrent = role === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        demoLogin(r.id);
                        setRoleSwitcherOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-xl transition-all ${
                        isCurrent
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isCurrent ? 'text-white' : r.color}`} />
                      <span>{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setRoleSwitcherOpen(false);
              setProfileDropdownOpen(false);
            }}
            className="relative p-2 text-slate-400 bg-slate-900 border border-slate-800 rounded-xl hover:text-white hover:border-slate-700 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 p-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-white tracking-wide">Notifications</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  {unreadCount} Unread
                </span>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {SAMPLE_NOTIFICATIONS.map((n) => (
                  <div
                    key={n._id}
                    className={`p-2.5 rounded-xl border text-xs transition-colors ${
                      n.isRead
                        ? 'bg-slate-950/40 border-slate-800/60 text-slate-400'
                        : 'bg-indigo-950/30 border-indigo-500/30 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold mb-1">
                      <span className="truncate pr-2">{n.title}</span>
                      <span className="text-[10px] text-slate-500 flex-shrink-0">
                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed line-clamp-2 text-slate-400">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setProfileDropdownOpen(!profileDropdownOpen);
              setRoleSwitcherOpen(false);
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-2 p-1 pl-2 text-left bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors"
          >
            <div className="hidden sm:block text-right">
              <div className="text-xs font-bold text-slate-200 leading-tight">{user?.name || 'User'}</div>
              <div className="text-[10px] text-slate-400 capitalize">{role}</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-indigo-600/30">
              {user?.name ? user.name[0].toUpperCase() : 'U'}
            </div>
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-52 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-slate-800">
                <p className="text-xs font-bold text-white">{user?.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
              </div>
              <div className="py-1">
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors font-semibold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
