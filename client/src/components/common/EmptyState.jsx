import React from 'react';
import { FolderSearch, Plus } from 'lucide-react';

const EmptyState = ({
  title = 'No records found',
  description = 'Try adjusting your search criteria or filter options.',
  icon: Icon = FolderSearch,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/40">
      <div className="p-4 mb-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      <p className="max-w-sm mt-1 text-sm text-slate-400">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-4 py-2 mt-5 text-xs font-semibold text-white transition-all bg-indigo-600 rounded-xl hover:bg-indigo-500 shadow-md shadow-indigo-600/25 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
