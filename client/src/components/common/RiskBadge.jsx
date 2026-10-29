import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

const RiskBadge = ({ level = 'Low Risk', showIcon = true, size = 'md' }) => {
  const normalized = (level || '').toLowerCase();

  const isHigh = normalized.includes('high') || normalized.includes('critical');
  const isModerate = normalized.includes('moderate') || normalized.includes('warning');

  const config = isHigh
    ? {
        label: 'Critical / High Risk',
        bg: 'bg-rose-500/15',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        icon: AlertCircle,
        dot: 'bg-rose-400 animate-pulse',
      }
    : isModerate
    ? {
        label: 'Moderate Risk',
        bg: 'bg-amber-500/15',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        icon: AlertTriangle,
        dot: 'bg-amber-400',
      }
    : {
        label: 'Low Risk / Good Standing',
        bg: 'bg-emerald-500/15',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        icon: CheckCircle2,
        dot: 'bg-emerald-400',
      };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-xs',
    lg: 'px-4 py-1.5 text-sm font-semibold',
  }[size];

  const IconComponent = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${config.bg} ${config.text} ${config.border} ${sizeClasses} backdrop-blur-sm shadow-sm`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {showIcon && <IconComponent className="w-3.5 h-3.5 flex-shrink-0" />}
      <span>{config.label}</span>
    </span>
  );
};

export default RiskBadge;
