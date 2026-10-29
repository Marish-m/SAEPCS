import React from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

const AlertBanner = ({ type = 'info', title, message, onDismiss, action }) => {
  const configs = {
    info: {
      bg: 'bg-indigo-950/50 border-indigo-500/30 text-indigo-300',
      icon: Info,
      iconColor: 'text-indigo-400',
    },
    success: {
      bg: 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300',
      icon: CheckCircle,
      iconColor: 'text-emerald-400',
    },
    warning: {
      bg: 'bg-amber-950/50 border-amber-500/30 text-amber-300',
      icon: AlertTriangle,
      iconColor: 'text-amber-400',
    },
    error: {
      bg: 'bg-rose-950/50 border-rose-500/30 text-rose-300',
      icon: AlertCircle,
      iconColor: 'text-rose-400',
    },
  }[type] || {
    bg: 'bg-slate-900 border-slate-700 text-slate-300',
    icon: Info,
    iconColor: 'text-slate-400',
  };

  const IconComp = configs.icon;

  return (
    <div
      className={`relative flex items-start gap-3 p-4 border rounded-xl backdrop-blur-md transition-all ${configs.bg}`}
    >
      <IconComp className={`w-5 h-5 mt-0.5 flex-shrink-0 ${configs.iconColor}`} />
      <div className="flex-1 text-sm">
        {title && <h4 className="font-semibold text-white tracking-wide mb-0.5">{title}</h4>}
        <div className="leading-relaxed opacity-95">{message}</div>
        {action && <div className="mt-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 -mr-1 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default AlertBanner;
