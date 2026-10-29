import React, { useState, useEffect } from 'react';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import AlertBanner from '../../components/common/AlertBanner';
import {
  Phone,
  Mail,
  MessageSquare,
  Volume2,
  VolumeX,
  Send,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  Search,
  Filter,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  Info,
  Clock,
  Sparkles,
  Play,
  Square,
  Globe,
  Radio,
  ExternalLink,
  ChevronRight,
  User,
  Users,
} from 'lucide-react';
import apiService from '../../api/apiService';

const FacultyParentCommunication = () => {
  // Navigation tabs: 'contacts' | 'history' | 'voice-center'
  const [activeTab, setActiveTab] = useState('contacts');

  // Data states
  const [students, setStudents] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logSummary, setLogSummary] = useState({
    total: 0,
    delivered: 0,
    simulated: 0,
    failed: 0,
    queued: 0,
    skipped: 0,
    byChannel: { sms: 0, email: 0, voice: 0 },
  });
  const [voiceConfig, setVoiceConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Filters for contacts
  const [contactSearch, setContactSearch] = useState('');
  const [selectedMethodFilter, setSelectedMethodFilter] = useState('All');
  const [selectedConsentFilter, setSelectedConsentFilter] = useState('All');

  // Filters for history
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('All');
  const [historyChannelFilter, setHistoryChannelFilter] = useState('All');

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isDirectMsgModalOpen, setIsDirectMsgModalOpen] = useState(false);
  const [isMeetingModalOpen, setIsMeetingModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // Form states for Edit Contact
  const [contactForm, setContactForm] = useState({
    name: '',
    relationship: 'Parent / Guardian',
    phone: '',
    email: '',
    preferredLanguage: 'en',
    preferredMethod: 'Automatic',
    consentStatus: 'Consented',
    notes: '',
  });
  const [validationErrors, setValidationErrors] = useState({});

  // Form states for Test Notification
  const [testForm, setTestForm] = useState({
    channel: 'SMS',
    language: 'en',
  });
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);

  // Form states for Direct Message
  const [msgForm, setMsgForm] = useState({
    subject: '',
    message: '',
    urgency: 'Normal',
    channel: 'Automatic',
    language: 'en',
  });

  // Form states for Meeting
  const [meetingForm, setMeetingForm] = useState({
    meetingDate: '',
    meetingTime: '10:00 AM',
    meetingType: 'In-Person',
    location: 'Department Faculty Room 204',
    agenda: 'Review academic attendance and internal assessment progress.',
    channel: 'Automatic',
  });

  // Audio / Speech state for Voice Audition Tool
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [auditionLang, setAuditionLang] = useState('en');
  const [auditionIssue, setAuditionIssue] = useState('attendance_alert');

  // 1. Fetch Students and Notification Logs
  const fetchData = async () => {
    setLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      const [stuRes, histRes, voiceRes, diagRes] = await Promise.all([
        apiService.getStudents(),
        apiService.getFacultyNotificationHistory(),
        apiService.getVoiceConfig().catch(() => ({ data: { config: null } })),
        apiService.getNotificationDiagnostics().catch(() => ({ data: { diagnostics: null } })),
      ]);

      const stuList = stuRes.data?.students || stuRes.data?.data || [];
      setStudents(stuList);

      if (histRes.data?.logs) {
        setLogs(histRes.data.logs);
        if (histRes.data.summary) {
          setLogSummary(histRes.data.summary);
        }
      }

      if (voiceRes.data?.config) {
        setVoiceConfig(voiceRes.data.config);
      }

      if (diagRes.data?.diagnostics) {
        setDiagnostics(diagRes.data.diagnostics);
      }
    } catch (err) {
      console.error('Error fetching parent communication data:', err);
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load parent contact data.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Open Edit Contact Modal
  const handleOpenEdit = (student) => {
    setSelectedStudent(student);
    const existing = student.parentContact || {};
    const linkedParent = student.parents && student.parents[0];

    setContactForm({
      name: existing.name || linkedParent?.user?.name || '',
      relationship: existing.relationship || linkedParent?.relationship || 'Parent / Guardian',
      phone: existing.phone || linkedParent?.user?.phone || '+91 ',
      email: existing.email || (linkedParent?.user?.email?.includes('noemail') ? '' : linkedParent?.user?.email) || '',
      preferredLanguage: existing.preferredLanguage || linkedParent?.notificationLanguagePreference || 'en',
      preferredMethod: existing.preferredMethod || linkedParent?.preferredNotificationMethod || 'Automatic',
      consentStatus: existing.consentStatus || linkedParent?.consentStatus || 'Consented',
      notes: existing.notes || '',
    });
    setValidationErrors({});
    setIsEditModalOpen(true);
  };

  // 3. Client-Side Contact Validation
  const validateContactForm = () => {
    const errors = {};
    const phoneTrimmed = contactForm.phone.trim();

    // Check phone with country code
    if (!phoneTrimmed) {
      errors.phone = 'Mobile number is required.';
    } else if (!/^\+[1-9]\d{0,3}[\s-]?[0-9]{4,14}$/.test(phoneTrimmed)) {
      errors.phone = 'Include country code with "+" prefix (e.g., +91 9876543210).';
    }

    // Check optional email
    if (contactForm.email && contactForm.email.trim()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactForm.email.trim())) {
        errors.email = 'Enter a valid email address or leave blank.';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 4. Save Parent Contact
  const handleSaveContact = async (e) => {
    e.preventDefault();
    if (!validateContactForm()) return;

    setActionLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await apiService.updateStudentParentContact(selectedStudent._id, contactForm);
      setFeedback({
        type: 'success',
        message: res.data?.message || 'Parent contact information saved successfully.',
      });
      setIsEditModalOpen(false);
      fetchData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to save parent contact details.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Open Test Modal
  const handleOpenTest = (student) => {
    setSelectedStudent(student);
    const existing = student.parentContact || {};
    setTestForm({
      channel: existing.preferredMethod || 'SMS',
      language: existing.preferredLanguage || 'en',
    });
    setTestPhone(existing.phone || '');
    setTestResult(null);
    setIsTestModalOpen(true);
  };

  // 6. Send Test Notification
  const handleSendTestNotification = async () => {
    if (!selectedStudent) return;
    setActionLoading(true);
    setTestResult(null);
    try {
      const res = await apiService.testParentNotification(selectedStudent._id, {
        ...testForm,
        phone: testPhone,
      });
      setTestResult(res.data?.result || res.data);
      if (res.data?.diagnostics) {
        setDiagnostics((prev) => ({
          ...prev,
          sms: {
            ...prev?.sms,
            activeProvider: res.data.diagnostics.activeProvider,
            isMock: res.data.diagnostics.isMock,
          },
        }));
      }
      setFeedback({
        type: 'success',
        message: `Test notification dispatched to ${selectedStudent.user?.name || 'student'}'s parent!`,
      });
      fetchData();
    } catch (err) {
      setTestResult({
        success: false,
        error: err.response?.data?.message || 'Test notification delivery failed.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Open Direct Message Modal
  const handleOpenDirectMsg = (student) => {
    setSelectedStudent(student);
    const existing = student.parentContact || {};
    setMsgForm({
      subject: 'Academic Progress Advisory',
      message: `Dear Parent, this is an update regarding ${student.user?.name}'s coursework and class engagement.`,
      urgency: 'Normal',
      channel: existing.preferredMethod || 'Automatic',
      language: existing.preferredLanguage || 'en',
    });
    setIsDirectMsgModalOpen(true);
  };

  // 8. Send Direct Message
  const handleSendDirectMsg = async (e) => {
    e.preventDefault();
    if (!selectedStudent || !msgForm.subject || !msgForm.message) return;

    setActionLoading(true);
    try {
      await apiService.sendFacultyParentMessage({
        studentId: selectedStudent._id,
        ...msgForm,
      });
      setFeedback({
        type: 'success',
        message: `Direct message dispatched to parent of ${selectedStudent.user?.name}!`,
      });
      setIsDirectMsgModalOpen(false);
      fetchData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to send message.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 9. Open Meeting Modal
  const handleOpenMeeting = (student) => {
    setSelectedStudent(student);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setMeetingForm({
      meetingDate: tomorrow.toISOString().split('T')[0],
      meetingTime: '10:30 AM',
      meetingType: 'In-Person',
      location: 'Department Faculty Room 204',
      agenda: `Academic advisory and attendance review for ${student.user?.name}.`,
      channel: student.parentContact?.preferredMethod || 'Automatic',
    });
    setIsMeetingModalOpen(true);
  };

  // 10. Schedule Meeting
  const handleScheduleMeeting = async (e) => {
    e.preventDefault();
    if (!selectedStudent || !meetingForm.meetingDate) return;

    setActionLoading(true);
    try {
      await apiService.scheduleParentMeeting({
        studentId: selectedStudent._id,
        ...meetingForm,
      });
      setFeedback({
        type: 'success',
        message: `Parent meeting scheduled and alert sent to ${selectedStudent.user?.name}'s parent!`,
      });
      setIsMeetingModalOpen(false);
      fetchData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to schedule meeting.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 11. Retry Failed Notification
  const handleRetry = async (notificationId) => {
    setActionLoading(true);
    try {
      await apiService.retryNotification(notificationId);
      setFeedback({
        type: 'success',
        message: 'Notification delivery retried successfully.',
      });
      fetchData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.message || 'Failed to retry notification.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 12. Browser Text-To-Speech Audition Tool
  const playVoiceAloud = (text, languageCode = 'en') => {
    if (!('speechSynthesis' in window)) {
      alert('Browser Text-To-Speech is not supported in this browser.');
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    // Language mapping
    if (languageCode === 'ta') {
      utterance.lang = 'ta-IN';
      utterance.rate = 0.9;
    } else if (languageCode === 'hi') {
      utterance.lang = 'hi-IN';
      utterance.rate = 0.9;
    } else {
      utterance.lang = 'en-IN';
      utterance.rate = 0.95;
    }

    utterance.onstart = () => setIsPlayingAudio(true);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
  };

  // Get sample voice message for audition
  const getAuditionText = () => {
    const studentName = 'Rohan';
    if (auditionLang === 'ta') {
      switch (auditionIssue) {
        case 'attendance_alert':
          return `வணக்கம். இது உங்கள் குழந்தையின் கல்லூரியிலிருந்து வரும் கல்வி அறிவிப்பு. உங்கள் குழந்தை ${studentName} வருகை பதிவு 62 சதவிகிதமாக குறைந்துள்ளது. வருகையை மேம்படுத்த வகுப்பு ஆசிரியரை தொடர்பு கொள்ளவும். நன்றி.`;
        case 'frequent_absent':
          return `வணக்கம். இது உங்கள் குழந்தையின் கல்லூரியிலிருந்து வரும் கல்வி அறிவிப்பு. உங்கள் குழந்தை ${studentName} இன்று கல்லூரிக்கு வரவில்லை. விவரங்களுக்கு கல்லூரியை தொடர்பு கொள்ளவும். நன்றி.`;
        case 'low_marks_warning':
          return `வணக்கம். இது உங்கள் குழந்தையின் கல்லூரியிலிருந்து வரும் கல்வி அறிவிப்பு. உங்கள் குழந்தை ${studentName} உள்மதிப்பீட்டு மதிப்பெண் தேர்ச்சி வரம்பிற்கு குறைவாக உள்ளது. ஆசிரியரை அணுகவும். நன்றி.`;
        case 'meeting_scheduled':
          return `வணக்கம். உங்கள் குழந்தை ${studentName} தொடர்பாக ஆசிரியர் சந்திப்பு திட்டமிடப்பட்டுள்ளது. விவரங்களுக்கு கல்லூரியை தொடர்பு கொள்ளவும். நன்றி.`;
        default:
          return `வணக்கம். உங்கள் குழந்தை ${studentName} கல்வி முன்னேற்றத்தில் கவனம் தேவை. ஆசிரியரை தொடர்பு கொள்ளவும். நன்றி.`;
      }
    } else if (auditionLang === 'hi') {
      switch (auditionIssue) {
        case 'attendance_alert':
          return `नमस्ते। यह आपके बच्चे के कॉलेज से एक शैक्षणिक सूचना है। आपके बच्चे ${studentName} की उपस्थिति 62 प्रतिशत है, जो कम है। कृपया शिक्षक से संपर्क करें। धन्यवाद।`;
        default:
          return `नमस्ते। आपके बच्चे ${studentName} के शैक्षणिक प्रदर्शन पर ध्यान देने की आवश्यकता है। कृपया कॉलेज से संपर्क करें। धन्यवाद।`;
      }
    } else {
      switch (auditionIssue) {
        case 'attendance_alert':
          return `Hello. This is an academic notification from your child's college. Your child ${studentName} has low attendance at 62 percent, which is below the mandatory 75 percent benchmark. Please contact the faculty member to discuss attendance improvement. Thank you.`;
        case 'frequent_absent':
          return `Hello. This is an academic notification from your child's college. Your child ${studentName} was absent today. Please contact the college for more information. Thank you.`;
        case 'low_marks_warning':
          return `Hello. This is an academic notification from your child's college. Your child ${studentName} scored below the passing benchmark in internal assessments. Remedial guidance is recommended. Thank you.`;
        case 'meeting_scheduled':
          return `Hello. This is an academic notification from your child's college. A meeting with faculty has been scheduled regarding your child ${studentName}. Please contact the college for details. Thank you.`;
        default:
          return `Hello. This is an academic advisory for your child ${studentName}. Please contact the faculty advisor. Thank you.`;
      }
    }
  };

  // Filtered Students
  const filteredStudents = students.filter((st) => {
    const parentContact = st.parentContact || {};
    const studentName = st.user?.name || '';
    const rollNumber = st.rollNumber || '';
    const parentName = parentContact.name || '';
    const phone = parentContact.phone || '';

    const matchesSearch =
      contactSearch === '' ||
      studentName.toLowerCase().includes(contactSearch.toLowerCase()) ||
      rollNumber.toLowerCase().includes(contactSearch.toLowerCase()) ||
      parentName.toLowerCase().includes(contactSearch.toLowerCase()) ||
      phone.toLowerCase().includes(contactSearch.toLowerCase());

    const matchesMethod =
      selectedMethodFilter === 'All' ||
      (parentContact.preferredMethod || 'Automatic') === selectedMethodFilter;

    const matchesConsent =
      selectedConsentFilter === 'All' ||
      (parentContact.consentStatus || 'Consented') === selectedConsentFilter;

    return matchesSearch && matchesMethod && matchesConsent;
  });

  // Filtered History Logs
  const filteredLogs = logs.filter((l) => {
    const searchLower = historySearch.toLowerCase();
    const studentName = l.academicDetails?.studentName || l.student?.user?.name || '';
    const roll = l.academicDetails?.rollNumber || l.student?.rollNumber || '';
    const title = l.title || '';

    const matchesSearch =
      historySearch === '' ||
      studentName.toLowerCase().includes(searchLower) ||
      roll.toLowerCase().includes(searchLower) ||
      title.toLowerCase().includes(searchLower);

    const matchesStatus =
      historyStatusFilter === 'All' ||
      l.status?.toLowerCase() === historyStatusFilter.toLowerCase();

    const matchesChannel =
      historyChannelFilter === 'All' ||
      l.channel?.toLowerCase() === historyChannelFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesChannel;
  });

  // Statistics Computations
  const totalConfigured = students.filter((s) => s.parentContact?.phone).length;
  const totalConsented = students.filter(
    (s) => (s.parentContact?.consentStatus || 'Consented') === 'Consented'
  ).length;
  const totalVoiceAccessibility = students.filter(
    (s) =>
      s.parentContact?.preferredMethod === 'Voice Call' ||
      s.parentContact?.preferredLanguage === 'ta'
  ).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm font-medium text-slate-400">Loading parent communication directory...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Phone className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Direct Parent Communication & Accessibility
              </h1>
            </div>
            <p className="text-sm text-slate-400 max-w-2xl">
              Equip faculty to manage parent mobile contacts, dispatch multi-lingual notifications
              (English & Tamil), and deliver automated voice calls for parents with limited digital literacy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-xl border border-slate-700/80 transition-all flex items-center gap-2 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback.message && (
        <AlertBanner
          type={feedback.type}
          message={feedback.message}
          onClose={() => setFeedback({ type: '', message: '' })}
        />
      )}

      {/* 2. Key Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Students</span>
            <span className="p-2 rounded-xl bg-slate-800 text-slate-300">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-white mt-2">{students.length}</p>
          <span className="text-xs text-slate-500 block mt-0.5">Enrolled batch</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contacts Configured</span>
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Phone className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-indigo-400 mt-2">{totalConfigured}</p>
          <span className="text-xs text-indigo-400/80 block mt-0.5">
            {students.length > 0 ? Math.round((totalConfigured / students.length) * 100) : 0}% coverage
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Consented Parents</span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-emerald-400 mt-2">{totalConsented}</p>
          <span className="text-xs text-emerald-400/80 block mt-0.5">Opted-in for alerts</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Voice Accessibility</span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Volume2 className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-amber-400 mt-2">{totalVoiceAccessibility}</p>
          <span className="text-xs text-amber-400/80 block mt-0.5">Tamil / Voice Spoken</span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Alerts Dispatched</span>
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Send className="w-4 h-4" />
            </span>
          </div>
          <p className="text-2xl font-extrabold text-purple-400 mt-2">{logSummary.total || logs.length}</p>
          <span className="text-xs text-purple-400/80 block mt-0.5">
            {logSummary.delivered || 0} delivered / {logSummary.simulated || 0} simulated
          </span>
        </div>
      </div>

      {/* 3. Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-1 sm:space-x-3">
        <button
          onClick={() => setActiveTab('contacts')}
          className={`py-3 px-4 font-semibold text-sm rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'contacts'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Parent Directory & Contact Management
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`py-3 px-4 font-semibold text-sm rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'history'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
          }`}
        >
          <Clock className="w-4 h-4" />
          Notification History & Status
          {logs.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-slate-800 text-indigo-400 rounded-full font-bold">
              {logs.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('voice-center')}
          className={`py-3 px-4 font-semibold text-sm rounded-t-xl transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'voice-center'
              ? 'border-indigo-500 text-indigo-400 bg-slate-900/50'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
          }`}
        >
          <Volume2 className="w-4 h-4" />
          Voice Calls & Accessibility Center
        </button>
      </div>

      {/* =====================================================================
          TAB 1: PARENT DIRECTORY & CONTACT MANAGEMENT
          ===================================================================== */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search student, roll number, or phone..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Method:</span>
                <select
                  value={selectedMethodFilter}
                  onChange={(e) => setSelectedMethodFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Methods</option>
                  <option value="Automatic">Automatic Routing</option>
                  <option value="SMS">SMS Only</option>
                  <option value="Email">Email Only</option>
                  <option value="Voice Call">Voice Call (Spoken)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Consent:</span>
                <select
                  value={selectedConsentFilter}
                  onChange={(e) => setSelectedConsentFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Consent</option>
                  <option value="Consented">Consented</option>
                  <option value="Opted Out">Opted Out</option>
                  <option value="Pending">Pending</option>
                </select>
              </div>
            </div>
          </div>

          {/* Student Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Student Name & ID</th>
                    <th className="py-3.5 px-4 font-semibold">Parent / Guardian</th>
                    <th className="py-3.5 px-4 font-semibold">Mobile Number</th>
                    <th className="py-3.5 px-4 font-semibold">Preferred Channel & Lang</th>
                    <th className="py-3.5 px-4 font-semibold">Consent Status</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-500">
                        No students match the specified filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st) => {
                      const parentContact = st.parentContact || {};
                      const hasPhone = Boolean(parentContact.phone);
                      const isConsented = (parentContact.consentStatus || 'Consented') === 'Consented';
                      const isOptedOut = parentContact.consentStatus === 'Opted Out';

                      return (
                        <tr key={st._id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-4 px-4">
                            <div className="font-bold text-white">{st.user?.name || 'Unnamed Student'}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-mono text-indigo-400 font-semibold">
                                {st.rollNumber}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                Sem {st.semester} • Sec {st.section}
                              </span>
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            <div className="font-medium text-slate-200">
                              {parentContact.name || 'Not Recorded'}
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {parentContact.relationship || 'Parent / Guardian'}
                            </span>
                          </td>

                          <td className="py-4 px-4">
                            {hasPhone ? (
                              <div>
                                <span className="font-mono text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-semibold inline-flex items-center gap-1.5">
                                  <Phone className="w-3 h-3" />
                                  {parentContact.phone}
                                </span>
                                {parentContact.email ? (
                                  <span className="text-[11px] text-slate-400 block mt-1 truncate max-w-[180px]">
                                    {parentContact.email}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-500 italic block mt-1">
                                    No email (Voice/SMS only)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-amber-400 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Needs Mobile Number
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 text-xs rounded-full font-medium border ${
                                  parentContact.preferredMethod === 'Voice Call'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                    : parentContact.preferredMethod === 'SMS'
                                    ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                                    : parentContact.preferredMethod === 'Email'
                                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                                    : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                                }`}
                              >
                                {parentContact.preferredMethod || 'Automatic'}
                              </span>

                              <span className="px-2 py-0.5 text-[11px] rounded-md bg-slate-800 text-slate-300 font-mono">
                                {parentContact.preferredLanguage === 'ta'
                                  ? 'தமிழ் (ta)'
                                  : parentContact.preferredLanguage === 'hi'
                                  ? 'हिंदी (hi)'
                                  : 'English (en)'}
                              </span>
                            </div>
                          </td>

                          <td className="py-4 px-4">
                            {isConsented ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                Consented
                              </span>
                            ) : isOptedOut ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <ShieldAlert className="w-3 h-3" />
                                Opted Out
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Clock className="w-3 h-3" />
                                Pending
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit Contact Button */}
                              <button
                                onClick={() => handleOpenEdit(st)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-200 text-xs font-medium rounded-lg transition-colors border border-slate-700/80"
                                title="Edit Parent Contact Details"
                              >
                                Edit
                              </button>

                              {/* Test Notification Button */}
                              <button
                                onClick={() => handleOpenTest(st)}
                                disabled={!hasPhone}
                                className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                                  hasPhone
                                    ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 hover:bg-indigo-600 hover:text-white'
                                    : 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed'
                                }`}
                                title="Send Diagnostic Test Notification"
                              >
                                Test
                              </button>

                              {/* Direct Message Button */}
                              <button
                                onClick={() => handleOpenDirectMsg(st)}
                                disabled={!hasPhone}
                                className={`p-1.5 text-xs font-medium rounded-lg transition-colors border ${
                                  hasPhone
                                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                    : 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed'
                                }`}
                                title="Send Faculty Direct Message"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>

                              {/* Schedule Meeting Button */}
                              <button
                                onClick={() => handleOpenMeeting(st)}
                                disabled={!hasPhone}
                                className={`p-1.5 text-xs font-medium rounded-lg transition-colors border ${
                                  hasPhone
                                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                    : 'bg-slate-800/40 text-slate-600 border-slate-800 cursor-not-allowed'
                                }`}
                                title="Schedule Parent Meeting"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: NOTIFICATION HISTORY & STATUS
          ===================================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* History Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search notification title or student..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Status:</span>
                <select
                  value={historyStatusFilter}
                  onChange={(e) => setHistoryStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Statuses</option>
                  <option value="delivered">Delivered</option>
                  <option value="simulated">Simulated (Dev Mode)</option>
                  <option value="failed">Failed</option>
                  <option value="queued">Queued / Pending</option>
                  <option value="skipped">Skipped (Opt-out)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Channel:</span>
                <select
                  value={historyChannelFilter}
                  onChange={(e) => setHistoryChannelFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="All">All Channels</option>
                  <option value="sms">SMS</option>
                  <option value="voice">Voice Call</option>
                  <option value="email">Email</option>
                  <option value="automatic">Automatic Routing</option>
                </select>
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Student Name</th>
                    <th className="py-3.5 px-4 font-semibold">Contact & Channel</th>
                    <th className="py-3.5 px-4 font-semibold">Notification Title & Reason</th>
                    <th className="py-3.5 px-4 font-semibold">Date & Time</th>
                    <th className="py-3.5 px-4 font-semibold">Delivery Status</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Action / Listen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-500">
                        No notification records found in history log.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const studentName =
                        log.academicDetails?.studentName || log.student?.user?.name || 'Student';
                      const rollNumber = log.academicDetails?.rollNumber || log.student?.rollNumber || '';
                      const isSimulated = log.status === 'simulated' || log.deliveryStatus?.simulated;
                      const isFailed = log.status === 'failed';
                      const isDelivered = log.status === 'delivered';
                      const isAcceptedOrSent = (log.status === 'sent' || log.status === 'accepted') && !isSimulated;
                      const isSkipped = log.status === 'skipped';

                      const dateFormatted = new Date(log.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      const voiceTranscript =
                        log.voiceDetails?.transcript ||
                        log.voiceMessage?.en ||
                        log.voiceMessage?.ta ||
                        log.message;

                      return (
                        <tr key={log._id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-4 px-4">
                            <span className="font-bold text-white block">{studentName}</span>
                            {rollNumber && (
                              <span className="text-xs font-mono text-indigo-400">{rollNumber}</span>
                            )}
                          </td>

                          <td className="py-4 px-4">
                            <div className="flex items-center gap-1.5 mb-1">
                              {log.channel === 'sms' && (
                                <span className="p-1 rounded bg-sky-500/10 text-sky-400">
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </span>
                              )}
                              {(log.channel === 'voice' || log.channel === 'voice_call') && (
                                <span className="p-1 rounded bg-amber-500/10 text-amber-400">
                                  <Phone className="w-3.5 h-3.5" />
                                </span>
                              )}
                              {log.channel === 'email' && (
                                <span className="p-1 rounded bg-indigo-500/10 text-indigo-400">
                                  <Mail className="w-3.5 h-3.5" />
                                </span>
                              )}
                              {(log.channel === 'all' || log.channel === 'automatic') && (
                                <span className="p-1 rounded bg-purple-500/10 text-purple-400">
                                  <Radio className="w-3.5 h-3.5" />
                                </span>
                              )}
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                                {log.channel}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 block font-mono">
                              {log.smsDetails?.to || log.parentContactInfo?.phone || log.emailDetails?.to || 'Parent Contact'}
                            </span>
                          </td>

                          <td className="py-4 px-4 max-w-xs">
                            <span className="font-medium text-slate-200 block truncate" title={log.title}>
                              {log.title}
                            </span>
                            <span className="text-xs text-slate-400 block truncate mt-0.5" title={log.message}>
                              {log.message}
                            </span>
                          </td>

                          <td className="py-4 px-4 text-xs text-slate-400 whitespace-nowrap">
                            {dateFormatted}
                          </td>

                          <td className="py-4 px-4">
                            {isDelivered && (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Delivered
                                </span>
                                <span className="text-[10px] text-slate-500 block mt-0.5 font-mono">
                                  {log.smsDetails?.provider || log.voiceDetails?.provider || 'Confirmed DLR'}
                                </span>
                              </div>
                            )}

                            {isAcceptedOrSent && (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Accepted / Sent
                                </span>
                                <span className="text-[10px] text-sky-400/80 block mt-0.5 font-mono">
                                  {log.smsDetails?.provider?.toUpperCase() || 'TELECOM CARRIER'}
                                </span>
                              </div>
                            )}

                            {isSimulated && (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                  <Sparkles className="w-3 h-3" />
                                  Simulated
                                </span>
                                <span className="text-[10px] text-indigo-400/80 block mt-0.5">
                                  Dev Mode (No Real Bill)
                                </span>
                              </div>
                            )}

                            {isFailed && (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  <AlertTriangle className="w-3 h-3" />
                                  Failed
                                </span>
                                <span className="text-[11px] text-rose-400 block mt-0.5 max-w-[140px] truncate" title={log.deliveryStatus?.error || log.smsDetails?.error}>
                                  {log.deliveryStatus?.error || log.smsDetails?.error || 'Transmission Glitch'}
                                </span>
                              </div>
                            )}

                            {isSkipped && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                Opted Out
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Audition Spoken Audio Button */}
                              {voiceTranscript && (
                                <button
                                  onClick={() => playVoiceAloud(voiceTranscript, log.voiceDetails?.language || 'en')}
                                  className="p-1.5 text-xs rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 border border-slate-700 transition-colors"
                                  title="Listen Spoken Voice Alert (Accessibility TTS)"
                                >
                                  <Volume2 className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Retry Button for Failed Notifications */}
                              {isFailed && (
                                <button
                                  onClick={() => handleRetry(log._id)}
                                  disabled={actionLoading}
                                  className="px-2.5 py-1 text-xs font-medium rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-600 hover:text-white transition-colors flex items-center gap-1"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  Retry
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: VOICE CALLS & ACCESSIBILITY CENTER
          ===================================================================== */}
      {activeTab === 'voice-center' && (
        <div className="space-y-6">
          {/* Explanation Banner */}
          <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 shadow-xl">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-2xl shrink-0 mt-1">
                <Volume2 className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  Addressing the Non-Literacy Challenge for Parents
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
                  Many parents and guardians have limited literacy or cannot read English SMS and emails.
                  SAEPCS solves this by enabling automated programmable outbound phone calls that speak academic
                  alerts aloud in the parent's chosen language (<strong>Tamil தமிழ்</strong>, <strong>English</strong>, or <strong>Hindi</strong>).
                  Parents do not need to register, log in, or install any app—the telephone rings and speaks directly to them.
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Zero Parent Portal Login Required
                  </div>
                  <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Native Tamil & English Spoken Alerts
                  </div>
                  <div className="flex items-center gap-2 text-xs text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Twilio Voice Programmable Outbound Calls
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Voice Audition Tool & Provider Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Interactive Audition Tool */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h4 className="font-bold text-white text-base">Live Voice Spoken Preview</h4>
                  <p className="text-xs text-slate-400">
                    Audition exactly how automated telephone calls sound to parents.
                  </p>
                </div>
                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-xs font-semibold rounded-full border border-indigo-500/20">
                  Interactive Audio
                </span>
              </div>

              {/* Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Spoken Language
                  </label>
                  <select
                    value={auditionLang}
                    onChange={(e) => setAuditionLang(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="en">English (Indian English en-IN)</option>
                    <option value="ta">தமிழ் (Tamil ta-IN)</option>
                    <option value="hi">हिंदी (Hindi hi-IN)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Notification Scenario
                  </label>
                  <select
                    value={auditionIssue}
                    onChange={(e) => setAuditionIssue(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="attendance_alert">Low Attendance Warning (&lt; 75%)</option>
                    <option value="frequent_absent">Consecutive Daily Absence</option>
                    <option value="low_marks_warning">Internal Assessment Score Warning</option>
                    <option value="meeting_scheduled">Parent-Faculty Meeting Scheduled</option>
                  </select>
                </div>
              </div>

              {/* Spoken Text Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 relative">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                  Spoken Script (Read Aloud by Outbound Voice Gateway)
                </span>
                <p className="text-sm font-medium text-slate-200 leading-relaxed italic">
                  "{getAuditionText()}"
                </p>
              </div>

              {/* Play / Stop Button */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => playVoiceAloud(getAuditionText(), auditionLang)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg flex items-center gap-2 ${
                    isPlayingAudio
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                  }`}
                >
                  {isPlayingAudio ? (
                    <>
                      <Square className="w-4 h-4 fill-current" />
                      Stop Speaking
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      Play Spoken Voice Preview
                    </>
                  )}
                </button>

                {isPlayingAudio && (
                  <span className="text-xs text-indigo-400 flex items-center gap-2 animate-pulse font-medium">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    SpeechSynthesis active...
                  </span>
                )}
              </div>
            </div>

            {/* Provider Configuration Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h4 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center gap-2">
                <Radio className="w-4 h-4 text-indigo-400" />
                Voice Provider Status
              </h4>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Active Gateway Provider:</span>
                  <span className="font-mono text-white text-sm font-bold block mt-0.5">
                    {voiceConfig?.automatedPhoneCalls?.configured ? 'Twilio Voice API' : 'Simulation Mode (Dev Gateway)'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block font-medium">Outbound Caller ID:</span>
                  <span className="font-mono text-emerald-400 text-xs block mt-0.5">
                    {voiceConfig?.automatedPhoneCalls?.callerIdConfigured || '+1 555-123-4567'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 block font-medium">Parental Consent Enforcement:</span>
                  <span className="text-emerald-400 font-semibold block mt-0.5">
                    Mandatory (Strict opt-out compliance)
                  </span>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
                  <span className="text-slate-300 font-semibold block text-[11px]">Notice on Real Calling:</span>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    When external Twilio credentials are not set in <code>.env</code>, calls execute in
                    Development Simulation Mode. Dispatches are logged with full TwiML scripts and marked
                    as <em>Simulated</em>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 1: EDIT PARENT CONTACT & PREFERENCES
          ===================================================================== */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Parent Contact & Accessibility Preferences"
        subtitle={`Student: ${selectedStudent?.user?.name || ''} (${selectedStudent?.rollNumber || ''})`}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveContact} className="space-y-4">
          {/* Student Identifiers (Read-Only) */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Student Name</span>
              <p className="text-sm font-bold text-white">{selectedStudent?.user?.name}</p>
            </div>
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase">Student ID / Roll No</span>
              <p className="text-sm font-mono font-bold text-indigo-400">{selectedStudent?.rollNumber}</p>
            </div>
          </div>

          {/* Parent Name & Relationship */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Parent / Guardian Name *
              </label>
              <input
                type="text"
                required
                value={contactForm.name}
                onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                placeholder="e.g., Rajesh Sharma"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Relationship
              </label>
              <select
                value={contactForm.relationship}
                onChange={(e) => setContactForm({ ...contactForm, relationship: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Guardian">Guardian</option>
                <option value="Parent / Guardian">Parent / Guardian</option>
              </select>
            </div>
          </div>

          {/* Mobile Number with Country Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Parent Mobile Number with Country Code *
            </label>
            <input
              type="text"
              required
              value={contactForm.phone}
              onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
              placeholder="+91 9876543210 or +1 555-0101"
              className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 font-mono text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${
                validationErrors.phone ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
              }`}
            />
            {validationErrors.phone ? (
              <span className="text-xs text-rose-400 mt-1 block">{validationErrors.phone}</span>
            ) : (
              <span className="text-[11px] text-slate-500 mt-1 block">
                Required for SMS & Automated Voice Call delivery.
              </span>
            )}
          </div>

          {/* Parent Email Address (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Parent Email Address <span className="text-slate-500 font-normal">(Optional)</span>
            </label>
            <input
              type="email"
              value={contactForm.email}
              onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
              placeholder="parent@example.com (Leave blank if parent has no email)"
              className={`w-full bg-slate-950 border rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none ${
                validationErrors.email ? 'border-rose-500' : 'border-slate-800 focus:border-indigo-500'
              }`}
            />
            {validationErrors.email ? (
              <span className="text-xs text-rose-400 mt-1 block">{validationErrors.email}</span>
            ) : (
              <span className="text-[11px] text-slate-500 mt-1 block">
                Optional: Parents without email will receive direct SMS & Voice Calls automatically.
              </span>
            )}
          </div>

          {/* Preferred Language & Preferred Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Preferred Communication Language
              </label>
              <select
                value={contactForm.preferredLanguage}
                onChange={(e) => setContactForm({ ...contactForm, preferredLanguage: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="en">English (Default)</option>
                <option value="ta">தமிழ் (Tamil - Voice & SMS)</option>
                <option value="hi">हिंदी (Hindi)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Preferred Notification Method
              </label>
              <select
                value={contactForm.preferredMethod}
                onChange={(e) => setContactForm({ ...contactForm, preferredMethod: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="Automatic">Automatic (Intelligent Routing)</option>
                <option value="SMS">SMS Only</option>
                <option value="Email">Email Only</option>
                <option value="Voice Call">Voice Call (Spoken - Non-Literate Accessibility)</option>
              </select>
            </div>
          </div>

          {/* Consent Status */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Parent Consent / Permission Status
            </label>
            <select
              value={contactForm.consentStatus}
              onChange={(e) => setContactForm({ ...contactForm, consentStatus: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="Consented">Consented (Permit automated alerts & calls)</option>
              <option value="Opted Out">Opted Out (Block all outbound notifications)</option>
              <option value="Pending">Pending (Consent verification in progress)</option>
            </select>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              {actionLoading ? <LoadingSpinner size="sm" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Contact Details
            </button>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL 2: TEST NOTIFICATION DISPATCH
          ===================================================================== */}
      <Modal
        isOpen={isTestModalOpen}
        onClose={() => setIsTestModalOpen(false)}
        title="Send Diagnostic Test Notification"
        subtitle={`Verify delivery to parent of ${selectedStudent?.user?.name || ''}`}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          {/* Destination Parent Mobile with editable override */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2">
            <label className="block text-slate-300 font-semibold">
              Recipient Parent Mobile Number (with country code):
            </label>
            <input
              type="text"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="+91 86100 85477"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-mono font-bold text-emerald-400 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Saved in Student Record: <strong className="text-slate-300 font-mono">{selectedStudent?.parentContact?.phone || 'None'}</strong></span>
              {selectedStudent?.parentContact?.email && (
                <span className="font-mono text-slate-400">{selectedStudent?.parentContact?.email}</span>
              )}
            </div>
          </div>

          {/* Live Gateway Diagnostics Status */}
          {diagnostics?.sms && (
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-indigo-400" />
                  Backend SMS Gateway:
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase font-mono ${
                    !diagnostics.sms.isMock
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                  }`}
                >
                  {diagnostics.sms.activeProvider} {!diagnostics.sms.isMock ? '● Live Gateway' : '○ Mock Mode'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {diagnostics.sms.statusDescription}
              </p>
            </div>
          )}

          {/* Parent Consent Warning if Opted Out */}
          {selectedStudent?.parentContact?.consentStatus === 'Opted Out' && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Parent Consent is "Opted Out"
              </div>
              <p className="text-[11px] text-slate-300">
                Outbound notifications to this contact are currently blocked by consent policy. Click "Edit Contact" and change consent to <strong>Consented</strong> before testing.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Channel to Test</label>
              <select
                value={testForm.channel}
                onChange={(e) => setTestForm({ ...testForm, channel: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="SMS">SMS Only</option>
                <option value="Automatic">Automatic (All channels)</option>
                <option value="Voice Call">Voice Call</option>
                <option value="Email">Email</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Language</label>
              <select
                value={testForm.language}
                onChange={(e) => setTestForm({ ...testForm, language: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="en">English (en)</option>
                <option value="ta">தமிழ் Tamil (ta)</option>
                <option value="hi">हिंदी Hindi (hi)</option>
              </select>
            </div>
          </div>

          {/* Test Result Display */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                testResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                {testResult.success
                  ? (testResult.simulated ? 'Test Dispatched (Simulation Mode)' : 'Diagnostic Request Accepted by Provider')
                  : 'Delivery Error / Skipped'}
              </div>

              {testResult.error && (
                <p className="text-xs text-rose-300 font-mono bg-rose-950/40 p-2 rounded-lg border border-rose-500/20">
                  {testResult.error}
                </p>
              )}

              {testResult.message && (
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {testResult.message}
                </p>
              )}

              {/* Provider Acceptance Details */}
              {!testResult.simulated && testResult.channels?.sms?.status && testResult.channels.sms.status !== 'none' && (
                <div className="text-[11px] text-sky-300 bg-sky-500/10 p-2.5 rounded-lg border border-sky-500/20 space-y-1">
                  <p className="font-semibold flex items-center gap-1 text-sky-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Telecom Provider Status: Accepted & Queued
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    Provider <strong>{testResult.channels.sms.provider?.toUpperCase()}</strong> accepted the dispatch with Request ID <code className="bg-slate-900 px-1 py-0.5 rounded text-white font-mono">{testResult.channels.sms.messageId}</code> and submitted it to the cellular network for delivery to <span className="font-mono text-emerald-300">{testPhone}</span>.
                  </p>
                  <p className="text-[10px] text-slate-400">
                    * Cellular arrival on handset depends on carrier routing, network signal, and DND status.
                  </p>
                </div>
              )}

              {testResult.simulated && (
                <div className="text-[11px] text-purple-300 bg-purple-500/10 p-2.5 rounded-lg border border-purple-500/20 space-y-1">
                  <p className="font-semibold flex items-center gap-1 text-purple-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    Development Simulation Active
                  </p>
                  <p className="text-slate-300 leading-relaxed">
                    The backend simulated this dispatch and logged it to MongoDB without contacting cellular towers because credentials are in simulation mode.
                  </p>
                </div>
              )}

              {testResult.channels?.sms && (
                <div className="font-mono text-[11px] bg-slate-950/50 p-2 rounded border border-slate-800">
                  SMS Status: <span className="font-semibold text-white">{testResult.channels.sms.status}</span> (Provider: {testResult.channels.sms.provider || 'fast2sms'})
                  {testResult.channels.sms.messageId && (
                    <span className="block text-slate-400 mt-0.5">ID: {testResult.channels.sms.messageId}</span>
                  )}
                </div>
              )}
              {testResult.channels?.voice && (
                <div className="font-mono text-[11px] bg-slate-950/50 p-2 rounded border border-slate-800">
                  Voice Status: <span className="font-semibold text-white">{testResult.channels.voice.status}</span> (Provider: {testResult.channels.voice.provider || 'mock'})
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsTestModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSendTestNotification}
              disabled={actionLoading}
              className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-600/30"
            >
              {actionLoading ? <LoadingSpinner size="sm" /> : <Send className="w-3.5 h-3.5" />}
              Send Test Notification
            </button>
          </div>
        </div>
      </Modal>

      {/* =====================================================================
          MODAL 3: DIRECT FACULTY MESSAGE
          ===================================================================== */}
      <Modal
        isOpen={isDirectMsgModalOpen}
        onClose={() => setIsDirectMsgModalOpen(false)}
        title="Direct Message to Parent"
        subtitle={`Student: ${selectedStudent?.user?.name || ''}`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSendDirectMsg} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Subject</label>
            <input
              type="text"
              required
              value={msgForm.subject}
              onChange={(e) => setMsgForm({ ...msgForm, subject: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Message Text</label>
            <textarea
              required
              rows="3"
              value={msgForm.message}
              onChange={(e) => setMsgForm({ ...msgForm, message: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Urgency</label>
              <select
                value={msgForm.urgency}
                onChange={(e) => setMsgForm({ ...msgForm, urgency: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Language</label>
              <select
                value={msgForm.language}
                onChange={(e) => setMsgForm({ ...msgForm, language: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="en">English</option>
                <option value="ta">Tamil (தமிழ்)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsDirectMsgModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-2 shadow-lg"
            >
              {actionLoading ? <LoadingSpinner size="sm" /> : <Send className="w-3.5 h-3.5" />}
              Dispatch Message
            </button>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL 4: SCHEDULE PARENT MEETING
          ===================================================================== */}
      <Modal
        isOpen={isMeetingModalOpen}
        onClose={() => setIsMeetingModalOpen(false)}
        title="Schedule Parent-Faculty Meeting"
        subtitle={`Ward: ${selectedStudent?.user?.name || ''}`}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleScheduleMeeting} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Meeting Date *</label>
              <input
                type="date"
                required
                value={meetingForm.meetingDate}
                onChange={(e) => setMeetingForm({ ...meetingForm, meetingDate: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Meeting Time</label>
              <input
                type="text"
                value={meetingForm.meetingTime}
                onChange={(e) => setMeetingForm({ ...meetingForm, meetingTime: e.target.value })}
                placeholder="10:00 AM"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Meeting Type</label>
              <select
                value={meetingForm.meetingType}
                onChange={(e) => setMeetingForm({ ...meetingForm, meetingType: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="In-Person">In-Person at College</option>
                <option value="Phone Call">Telephone Call</option>
                <option value="Online Video">Online Video Conference</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Location / Venue</label>
              <input
                type="text"
                value={meetingForm.location}
                onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                placeholder="Faculty Room 204"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Agenda / Reason</label>
            <textarea
              rows="2"
              value={meetingForm.agenda}
              onChange={(e) => setMeetingForm({ ...meetingForm, agenda: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsMeetingModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-5 py-2 text-xs font-bold text-white rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-colors flex items-center gap-2 shadow-lg"
            >
              {actionLoading ? <LoadingSpinner size="sm" /> : <Calendar className="w-3.5 h-3.5" />}
              Send Meeting Invite
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default FacultyParentCommunication;

