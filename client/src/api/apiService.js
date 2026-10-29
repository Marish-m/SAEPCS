import apiClient from './axios';

export const apiService = {
  // System Health
  checkHealth: async () => {
    try {
      const res = await apiClient.get('/health');
      return { connected: true, data: res.data };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  },

  // Auth Endpoints
  login: (credentials) => apiClient.post('/auth/login', credentials),
  demoLogin: (role) => apiClient.post('/auth/demo-login', { role }),
  getMe: () => apiClient.get('/auth/me'),
  updateProfile: (data) => apiClient.put('/auth/update-profile', data),
  registerUser: (data) => apiClient.post('/auth/register', data),

  // Student, Faculty & Parent Management
  getStudents: (params) => apiClient.get('/students', { params }),
  getSubjects: (params) => apiClient.get('/students/subjects', { params }),
  getStudentById: (id) => apiClient.get(`/students/${id}`),
  createStudent: (data) => apiClient.post('/students', data),
  updateStudent: (id, data) => apiClient.put(`/students/${id}`, data),
  deleteStudent: (id) => apiClient.delete(`/students/${id}`),
  getMyChildren: () => apiClient.get('/students/parent/my-children'),
  getParentsList: () => apiClient.get('/students/parents/list'),
  createParent: (data) => apiClient.post('/students/parents', data),
  linkStudentToParent: (data) => apiClient.post('/students/parents/link', data),
  unlinkStudentFromParent: (data) => apiClient.post('/students/parents/unlink', data),
  deleteParent: (id) => apiClient.delete(`/students/parents/${id}`),
  getFaculty: (params) => apiClient.get('/faculty', { params }),
  getFacultyById: (id) => apiClient.get(`/faculty/${id}`),
  createFaculty: (data) => apiClient.post('/faculty', data),
  updateFaculty: (id, data) => apiClient.put(`/faculty/${id}`, data),
  deleteFaculty: (id) => apiClient.delete(`/faculty/${id}`),

  // Department & Curriculum Endpoints
  getDepartments: (params) => apiClient.get('/departments', { params }),
  createDepartment: (data) => apiClient.post('/departments', data),
  createSubject: (data) => apiClient.post('/departments/subjects', data),
  deleteSubject: (id) => apiClient.delete(`/departments/subjects/${id}`),

  // Attendance Endpoints
  getAttendance: (params) => apiClient.get('/attendance', { params }),
  markAttendance: (payload) => apiClient.post('/attendance/mark', payload),
  correctAttendance: (id, data) => apiClient.put(`/attendance/correct/${id}`, data),
  checkAttendance: (params) => apiClient.get('/attendance/check', { params }),
  getAttendanceHistory: (params) => apiClient.get('/attendance/history', { params }),
  getAttendanceSummary: (studentId) => apiClient.get(`/attendance/summary/${studentId}`),

  // Assessment Marks Endpoints
  createAssessment: (data) => apiClient.post('/marks/assessments', data),
  getAssessments: (params) => apiClient.get('/marks/assessments', { params }),
  enterMarksBatch: (data) => apiClient.post('/marks/batch', data),
  getMarks: (params) => apiClient.get('/marks', { params }),
  addMarks: (data) => apiClient.post('/marks', data),
  getStudentMarksAnalytics: (studentId) => apiClient.get(`/marks/student/${studentId}`),
  updateMarks: (id, data) => apiClient.put(`/marks/${id}`, data),
  deleteMarks: (id) => apiClient.delete(`/marks/${id}`),

  // Assignment Endpoints
  getAssignments: (params) => apiClient.get('/assignments', { params }),
  getAssignmentSubmissions: (id) => apiClient.get(`/assignments/${id}/submissions`),
  createAssignment: (data) => apiClient.post('/assignments', data),
  submitAssignment: (id, data) => apiClient.post(`/assignments/${id}/submit`, data),
  gradeSubmission: (id, data) => apiClient.post(`/assignments/${id}/grade`, data),
  deleteAssignment: (id) => apiClient.delete(`/assignments/${id}`),

  // Leave Endpoints
  getLeaves: (params) => apiClient.get('/leaves', { params }),
  getLeaveUsage: (studentId = 'me') => apiClient.get(`/leaves/usage/${studentId}`),
  applyLeave: (data) => apiClient.post('/leaves/apply', data),
  updateLeaveStatus: (id, data) => apiClient.put(`/leaves/${id}/status`, data),

  // Academic Risk Endpoints
  getRiskOverview: (params) => apiClient.get('/risk/overview', { params }),
  getStudentRiskDetails: (studentId) => apiClient.get(`/risk/student/${studentId}`),
  getStudentRiskHistory: (studentId) => apiClient.get(`/risk/history/${studentId}`),
  resolveRisk: (riskId, data) => apiClient.put(`/risk/${riskId}/resolve`, data),
  sendRiskAlertToParent: (studentId, payload) => apiClient.post(`/risk/notify-parent/${studentId}`, payload),
  getRiskSettings: () => apiClient.get('/risk/settings'),
  updateRiskSettings: (data) => apiClient.put('/risk/settings', data),

  // Notification Endpoints
  getNotifications: (params) => apiClient.get('/notifications', { params }),
  getParentNotifications: (params) => apiClient.get('/notifications/parent', { params }),
  getAdminNotificationLogs: (params) => apiClient.get('/notifications/admin/logs', { params }),
  getFacultyNotificationHistory: (params) => apiClient.get('/notifications/faculty-history', { params }),
  getStudentParentContact: (studentId) => apiClient.get(`/students/${studentId}/parent-contact`),
  updateStudentParentContact: (studentId, data) => apiClient.put(`/students/${studentId}/parent-contact`, data),
  getNotificationDiagnostics: () => apiClient.get('/notifications/config-diagnostics'),
  testParentNotification: (studentId, data) => apiClient.post(`/notifications/test-parent/${studentId}`, data),
  sendFacultyParentMessage: (data) => apiClient.post('/notifications/faculty-message', data),
  scheduleParentMeeting: (data) => apiClient.post('/notifications/schedule-meeting', data),
  sendAcademicAnnouncement: (data) => apiClient.post('/notifications/announcement', data),
  retryNotification: (id) => apiClient.post(`/notifications/${id}/retry`),
  updateNotificationPreferences: (data) => apiClient.put('/notifications/preferences', data),
  getVoiceConfig: () => apiClient.get('/notifications/voice-config'),
  markNotificationRead: (id) => apiClient.put(`/notifications/${id}/read`),
  markAllNotificationsRead: () => apiClient.put('/notifications/read-all'),
  sendNotification: (data) => apiClient.post('/notifications/send', data),

  // Report Endpoints
  getStudentReport: (studentId) => apiClient.get(`/reports/student-summary/${studentId}`),
  getAttendanceReport: (params) => apiClient.get('/reports/attendance', { params }),
  getMarksReport: (params) => apiClient.get('/reports/marks', { params }),
  getAssignmentsReport: (params) => apiClient.get('/reports/assignments', { params }),
  getLeavesReport: (params) => apiClient.get('/reports/leaves', { params }),
  getRisksReport: (params) => apiClient.get('/reports/academic-risks', { params }),
  getNotificationsReport: (params) => apiClient.get('/reports/notifications', { params }),
  getClassPerformance: (params) => apiClient.get('/reports/class-performance', { params }),
};

export default apiService;
