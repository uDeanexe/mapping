import React, { useEffect } from 'react';

export default function Modal({ open, title, children, onClose, width = 720 }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto" onMouseDown={onClose}>
      <div
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden w-full my-auto transition-all"
        style={{ maxWidth: width }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="text-lg font-bold text-slate-900">{title}</div>
          <button className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200" onClick={onClose} aria-label="Tutup">
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
