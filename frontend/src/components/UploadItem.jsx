import React from 'react';
import { X } from 'lucide-react';

export default function UploadItem({ item, onCancel }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center text-xs text-slate-300 mb-1">
        <span className="truncate max-w-[140px]">{item.filename}</span>
        <div className="flex items-center gap-2">
          <span>{item.progress}%</span>
          {item.status === 'uploading' && (
            <button onMouseDown={() => onCancel(item.filename)} className="text-slate-400 hover:text-red-400 p-0.5 rounded bg-slate-800 transition-colors">
              <X size={12} />
            </button>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full transition-all duration-300 rounded-full ${item.status === 'failed' || item.status === 'cancelled' ? 'bg-red-500' : 'bg-emerald-500'}`}
          style={{ width: `${item.progress}%` }} />
      </div>
      {item.status === 'complete' && <p className="text-xs text-emerald-400 mt-0.5">✓ Done</p>}
      {(item.status === 'failed' || item.status === 'cancelled') && <p className="text-xs text-red-400 mt-0.5">✗ {item.status === 'cancelled' ? 'Cancelled' : 'Failed'}</p>}
    </div>
  );
}