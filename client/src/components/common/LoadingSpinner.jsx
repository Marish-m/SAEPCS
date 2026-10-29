import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = ({ text = 'Loading records...', size = 'md' }) => {
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  }[size] || 'w-8 h-8';

  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <div className="relative">
        <Loader2 className={`${sizeClass} text-indigo-500 animate-spin`} />
        <div className="absolute inset-0 rounded-full blur-md bg-indigo-500/30 animate-pulse pointer-events-none" />
      </div>
      {text && <p className="text-sm font-medium text-slate-400 tracking-wide animate-pulse">{text}</p>}
    </div>
  );
};

export default LoadingSpinner;
