import React, { useState, useEffect } from 'react';
import { SAMPLE_NOTIFICATIONS } from '../../data/mockData';
import {
  Bell,
  CheckCheck,
  Clock,
  Mail,
  MessageSquare,
  AlertTriangle,
  Volume2,
  Square,
  Languages,
  Info,
} from 'lucide-react';
import apiService from '../../api/apiService';

const StudentNotifications = () => {
  const [notifications, setNotifications] = useState(SAMPLE_NOTIFICATIONS);
  const [speechLanguage, setSpeechLanguage] = useState('en');
  const [playingNotifId, setPlayingNotifId] = useState(null);
  const [langSaving, setLangSaving] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await apiService.getNotifications();
        if (res.data?.notifications && res.data.notifications.length > 0) {
          setNotifications(res.data.notifications);
        }
      } catch (err) {
        console.warn('Using mock student notifications fallback:', err);
      }
    };
    fetchNotifications();
  }, []);

  const handleLanguageChange = async (newLang) => {
    setSpeechLanguage(newLang);
    setLangSaving(true);
    try {
      await apiService.updateNotificationPreferences({ languagePreference: newLang });
    } catch {
      // offline fallback
    } finally {
      setLangSaving(false);
    }
  };

  const handlePlayVoice = (notif) => {
    if (!('speechSynthesis' in window)) {
      alert('Browser Text-To-Speech is not supported in this browser.');
      return;
    }

    if (playingNotifId === notif._id) {
      window.speechSynthesis.cancel();
      setPlayingNotifId(null);
      return;
    }

    window.speechSynthesis.cancel();

    let textToSpeak = '';
    if (speechLanguage === 'ta') {
      textToSpeak =
        notif.voiceDetails?.language === 'ta' && notif.voiceDetails?.transcript
          ? notif.voiceDetails.transcript
          : `Vanakkam. You have an academic notification: ${notif.title}. ${notif.message}. Please meet your faculty advisor.`;
    } else {
      textToSpeak =
        notif.voiceMessage?.en ||
        notif.voiceDetails?.transcript ||
        `${notif.title}. ${notif.message}. Recommended action: ${
          notif.academicDetails?.recommendedAction || 'Please consult your faculty advisor.'
        }`;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    const voices = window.speechSynthesis.getVoices();

    if (speechLanguage === 'ta') {
      utterance.lang = 'ta-IN';
      const tamilVoice = voices.find(
        (v) => v.lang.includes('ta') || v.name.toLowerCase().includes('tamil')
      );
      if (tamilVoice) utterance.voice = tamilVoice;
    } else {
      utterance.lang = 'en-IN';
      const indianVoice = voices.find(
        (v) => v.lang.includes('en-IN') || v.name.toLowerCase().includes('india')
      );
      if (indianVoice) utterance.voice = indianVoice;
    }

    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setPlayingNotifId(notif._id);
    utterance.onend = () => setPlayingNotifId(null);
    utterance.onerror = () => setPlayingNotifId(null);

    window.speechSynthesis.speak(utterance);
  };

  const handleStopVoice = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setPlayingNotifId(null);
  };

  const markAllRead = async () => {
    try {
      await apiService.markAllNotificationsRead();
    } catch {
      // preview fallback
    }
    setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
  };

  const markSingleRead = async (id) => {
    try {
      await apiService.markNotificationRead(id);
    } catch {
      // preview fallback
    }
    setNotifications(notifications.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">
            Academic Notifications & Alerts
          </h2>
          <p className="text-xs text-slate-400">
            Real-time notifications for internal assessments, assignment updates, and attendance advisories.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Language Switcher */}
          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 text-xs">
            <Languages className="w-4 h-4 text-indigo-400" />
            <button
              onClick={() => handleLanguageChange('en')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                speechLanguage === 'en'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => handleLanguageChange('ta')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                speechLanguage === 'ta'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              தமிழ்
            </button>
            {langSaving && <span className="text-[10px] text-indigo-400">...</span>}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all"
            >
              <CheckCheck className="w-4 h-4" />
              <span>Mark All Read ({unreadCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Transparent Audio Note */}
      <div className="p-3 rounded-xl bg-indigo-950/25 border border-indigo-500/25 text-xs text-indigo-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <span>
            <strong>Voice Playback:</strong> Press <strong>Listen</strong> on any advisory for browser SpeechSynthesis. Audio is synthesized on your device (no automated phone call placed).
          </span>
        </div>
        {playingNotifId && (
          <button
            onClick={handleStopVoice}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600/30 text-rose-300 border border-rose-500/40 text-[11px] font-semibold"
          >
            <Square className="w-3 h-3 fill-rose-300" />
            <span>Stop</span>
          </button>
        )}
      </div>

      {/* Notifications Feed */}
      <div className="space-y-3">
        {notifications.map((notif) => {
          const isPlaying = playingNotifId === notif._id;
          const isAlert =
            notif.type.includes('alert') ||
            notif.type.includes('risk') ||
            notif.type.includes('warning');

          return (
            <div
              key={notif._id}
              className={`p-4 rounded-2xl border transition-all ${
                isPlaying
                  ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500 shadow-md'
                  : notif.isRead
                  ? 'bg-slate-900/50 border-slate-800/60 opacity-80'
                  : 'bg-indigo-950/20 border-indigo-500/30 shadow-md shadow-indigo-950/30'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className={`p-2.5 rounded-xl border mt-0.5 flex-shrink-0 ${
                      isAlert
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                    }`}
                  >
                    {isAlert ? <AlertTriangle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                  </div>
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-white tracking-tight">{notif.title}</h4>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0 animate-pulse" />
                      )}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{notif.message}</p>

                    {notif.academicDetails?.currentMetric && (
                      <div className="text-[11px] text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 inline-block mt-1">
                        Current Metric: {notif.academicDetails.currentMetric}
                      </div>
                    )}

                    <div className="flex items-center gap-3 pt-1 text-[10px] text-slate-400">
                      <span>Sender: {notif.sender?.name || notif.sender || 'Academic Advisory Cell'}</span>
                      <span>•</span>
                      <span>{new Date(notif.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Voice button */}
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => handlePlayVoice(notif)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isPlaying
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {isPlaying ? (
                      <>
                        <Square className="w-3 h-3 fill-white" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Listen ({speechLanguage === 'ta' ? 'தமிழ்' : 'EN'})</span>
                      </>
                    )}
                  </button>

                  {!notif.isRead && (
                    <button
                      onClick={() => markSingleRead(notif._id)}
                      className="text-[11px] text-indigo-400 hover:underline px-1 py-1"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StudentNotifications;
