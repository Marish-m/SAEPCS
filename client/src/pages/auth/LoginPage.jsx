import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  GraduationCap,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';

const LoginPage = () => {
  const { login, isApiLive, apiChecking, verifyBackendHealth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Please provide both User ID (email) and password.');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your User ID and password.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillCredentials = (suggestedEmail) => {
    setEmail(suggestedEmail);
    setPassword('Password@123');
    setError('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 sm:px-6 relative overflow-hidden py-12 selection:bg-indigo-500 selection:text-white">
      {/* Ambient Background Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container Card */}
      <div className="relative w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl shadow-slate-950 z-10">
        {/* Brand Header */}
        <div className="text-center mb-7">
          <div className="inline-flex p-3.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-xl shadow-indigo-600/30 mb-3.5">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">SAEPCS Portal</h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
            Student Academic Engagement Monitoring & Parent Communication System
          </p>

          {/* Connection Status Pill */}
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold border bg-slate-950/60 border-slate-800 text-slate-300">
            <span
              className={`w-2 h-2 rounded-full ${
                isApiLive
                  ? 'bg-emerald-400 animate-pulse'
                  : apiChecking
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-400'
              }`}
            />
            <span>
              {isApiLive
                ? 'Live API Backend Connected'
                : apiChecking
                ? 'Connecting to Server...'
                : 'Server Offline'}
            </span>
            {!isApiLive && (
              <button
                type="button"
                onClick={() => verifyBackendHealth()}
                className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-normal ml-1 cursor-pointer"
              >
                {apiChecking ? 'Checking...' : 'Retry'}
              </button>
            )}
          </div>
        </div>

        {/* Error Alert Banner */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Authentication Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              User ID / Institutional Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. faculty@saepcs.edu"
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-10 py-2.5 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-sans"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 mt-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <span>{loading ? 'Authenticating Credentials...' : 'Sign In to Portal'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Authorized User ID & Password Reference Directory */}
        <div className="mt-6 pt-5 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 mb-2.5 text-[11px] font-bold text-slate-400">
            <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
            <span>Authorized User Accounts & Passwords</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div
              onClick={() => handleFillCredentials('admin@saepcs.edu')}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-indigo-500/40 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-[11px]">Admin</span>
                <span className="text-[10px] text-indigo-400 font-mono">Fill</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 truncate">admin@saepcs.edu</p>
            </div>

            <div
              onClick={() => handleFillCredentials('faculty@saepcs.edu')}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-indigo-500/40 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-[11px]">Faculty</span>
                <span className="text-[10px] text-indigo-400 font-mono">Fill</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 truncate">faculty@saepcs.edu</p>
            </div>

            <div
              onClick={() => handleFillCredentials('student@saepcs.edu')}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-indigo-500/40 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-[11px]">Student</span>
                <span className="text-[10px] text-indigo-400 font-mono">Fill</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 truncate">student@saepcs.edu</p>
            </div>

            <div
              onClick={() => handleFillCredentials('parent@saepcs.edu')}
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-indigo-500/40 cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-[11px]">Parent</span>
                <span className="text-[10px] text-indigo-400 font-mono">Fill</span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 truncate">parent@saepcs.edu</p>
            </div>
          </div>

          <div className="mt-2.5 flex items-center justify-between px-2 text-[10px] text-slate-500">
            <span>Default Password for all roles:</span>
            <span className="font-mono font-bold text-slate-300">Password@123</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
