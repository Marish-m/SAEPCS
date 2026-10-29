import React from 'react';

const StatCard = ({ title, value, subtext, icon: Icon, color = 'indigo', trend = null }) => {
  const colorStyles = {
    indigo: {
      bg: 'bg-indigo-500/10',
      text: 'text-indigo-400',
      border: 'border-indigo-500/20',
      glow: 'hover:border-indigo-500/40 hover:shadow-glow-indigo',
    },
    emerald: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/20',
      glow: 'hover:border-emerald-500/40 hover:shadow-glow-emerald',
    },
    amber: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/20',
      glow: 'hover:border-amber-500/40',
    },
    rose: {
      bg: 'bg-rose-500/10',
      text: 'text-rose-400',
      border: 'border-rose-500/20',
      glow: 'hover:border-rose-500/40 hover:shadow-glow-rose',
    },
    purple: {
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
      border: 'border-purple-500/20',
      glow: 'hover:border-purple-500/40',
    },
  }[color] || {
    bg: 'bg-indigo-500/10',
    text: 'text-indigo-400',
    border: 'border-indigo-500/20',
    glow: 'hover:border-indigo-500/40',
  };

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-slate-900/80 backdrop-blur-md p-6 border ${colorStyles.border} ${colorStyles.glow} transition-all duration-300 group`}
    >
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
          <div className="flex items-baseline space-x-2">
            <h3 className="text-3xl font-extrabold text-white tracking-tight">{value}</h3>
            {trend && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  trend.positive
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {trend.positive ? '+' : ''}
                {trend.label}
              </span>
            )}
          </div>
          {subtext && <p className="text-xs text-slate-400 font-medium">{subtext}</p>}
        </div>

        {Icon && (
          <div
            className={`p-3.5 rounded-xl ${colorStyles.bg} ${colorStyles.text} border ${colorStyles.border} transition-transform duration-300 group-hover:scale-110`}
          >
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>

      <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-gradient-to-br from-white/5 to-transparent rounded-full pointer-events-none blur-xl" />
    </div>
  );
};

export default StatCard;
