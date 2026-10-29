import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/common/Navbar';
import Sidebar from './components/common/Sidebar';
import LoginPage from './pages/auth/LoginPage';

// Admin Pages
import AdminOverview from './pages/admin/AdminOverview';
import AdminStudentsFaculty from './pages/admin/AdminStudentsFaculty';
import AdminParents from './pages/admin/AdminParents';
import AdminDepartments from './pages/admin/AdminDepartments';
import AdminReports from './pages/admin/AdminReports';
import AdminNotificationHistory from './pages/admin/AdminNotificationHistory';

// Faculty Pages
import FacultyOverview from './pages/faculty/FacultyOverview';
import FacultyParentCommunication from './pages/faculty/FacultyParentCommunication';
import FacultyAttendance from './pages/faculty/FacultyAttendance';
import FacultyMarks from './pages/faculty/FacultyMarks';
import FacultyAssignments from './pages/faculty/FacultyAssignments';
import FacultyLeaveApprovals from './pages/faculty/FacultyLeaveApprovals';
import FacultyAtRiskStudents from './pages/faculty/FacultyAtRiskStudents';
import FacultyReports from './pages/faculty/FacultyReports';

// Student Pages
import StudentAttendance from './pages/student/StudentAttendance';
import StudentMarks from './pages/student/StudentMarks';
import StudentAssignments from './pages/student/StudentAssignments';
import StudentLeaveApplications from './pages/student/StudentLeaveApplications';
import StudentNotifications from './pages/student/StudentNotifications';
import StudentReports from './pages/student/StudentReports';

// Parent Pages
import ParentDashboard from './pages/parent/ParentDashboard';

const AppContent = () => {
  const { isAuthenticated, role, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Reset tab to default when role changes
  useEffect(() => {
    if (role === 'student') {
      setActiveTab('attendance');
    } else {
      setActiveTab('overview');
    }
  }, [role]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Determine Title for Top Navbar
  const getPageTitle = () => {
    const titles = {
      overview: 'Institutional Dashboard Overview',
      'students-faculty': 'Student & Faculty Management',
      parents: 'Parent Communication Directory',
      departments: 'Departments & Curricula',
      reports: 'Academic Reports & PDF Transcripts',
      notifications: 'Notification Dispatch Log',
      'parent-communication': 'Direct Parent Communication & Accessibility',
      attendance: role === 'faculty' ? 'Class Attendance Matrix' : 'My Attendance Record',
      marks: role === 'faculty' ? 'Internal Assessment Entry' : 'My Examination Grades',
      assignments: 'Coursework & Assignments',
      leaves: role === 'faculty' ? 'Leave Application Reviews' : 'Leave Applications',
      'at-risk': 'Academic Risk Identification',
      'attendance-marks': 'Ward Attendance & Assessment Grades',
      warnings: 'Academic Deficit Warnings',
    };
    return titles[activeTab] || 'Dashboard';
  };

  // Render role-specific content
  const renderContent = () => {
    if (role === 'admin') {
      switch (activeTab) {
        case 'overview':
          return <AdminOverview onNavigate={setActiveTab} />;
        case 'students-faculty':
          return <AdminStudentsFaculty />;
        case 'parents':
          return <AdminParents />;
        case 'departments':
          return <AdminDepartments />;
        case 'reports':
          return <AdminReports />;
        case 'notifications':
          return <AdminNotificationHistory />;
        default:
          return <AdminOverview onNavigate={setActiveTab} />;
      }
    }

    if (role === 'faculty') {
      switch (activeTab) {
        case 'overview':
          return <FacultyOverview onNavigate={setActiveTab} />;
        case 'parent-communication':
          return <FacultyParentCommunication />;
        case 'attendance':
          return <FacultyAttendance />;
        case 'marks':
          return <FacultyMarks />;
        case 'assignments':
          return <FacultyAssignments />;
        case 'leaves':
          return <FacultyLeaveApprovals />;
        case 'at-risk':
          return <FacultyAtRiskStudents />;
        case 'reports':
          return <FacultyReports />;
        default:
          return <FacultyOverview onNavigate={setActiveTab} />;
      }
    }

    if (role === 'student') {
      switch (activeTab) {
        case 'attendance':
          return <StudentAttendance />;
        case 'marks':
          return <StudentMarks />;
        case 'assignments':
          return <StudentAssignments />;
        case 'leaves':
          return <StudentLeaveApplications />;
        case 'reports':
          return <StudentReports />;
        case 'notifications':
          return <StudentNotifications />;
        default:
          return <StudentAttendance />;
      }
    }

    if (role === 'parent') {
      return <ParentDashboard activeTab={activeTab} />;
    }

    return <FacultyOverview onNavigate={setActiveTab} />;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex antialiased">
      {/* Role Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        <Navbar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          activePageTitle={getPageTitle()}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
