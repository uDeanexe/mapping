import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastCtx = createContext(null);

function toastClass(type) {
  switch (type) {
    case 'success':
      return 'border-emerald-200 bg-white text-slate-900';
    case 'error':
      return 'border-red-200 bg-white text-slate-900';
    case 'info':
      return 'border-sky-200 bg-white text-slate-900';
    default:
      return 'border-slate-200 bg-white text-slate-900';
  }
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const remove = useCallback((id) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const push = useCallback((type, message) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const toast = { id, type, message };
    setItems((prev) => [toast, ...prev].slice(0, 4));
    window.setTimeout(() => remove(id), 3200);
  }, [remove]);

  const api = useMemo(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m)
    }),
    [push]
  );

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] w-[min(92vw,380px)] space-y-3">
        {items.map((t) => (
          <div
            key={t.id}
            className={`rounded-xl border px-4 py-3 shadow-lg shadow-slate-900/10 text-sm font-semibold ${toastClass(
              t.type
            )}`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 inline-flex h-2.5 w-2.5 shrink-0 rounded-full ${
                  t.type === 'success'
                    ? 'bg-emerald-500'
                    : t.type === 'error'
                      ? 'bg-red-500'
                      : t.type === 'info'
                        ? 'bg-sky-500'
                        : 'bg-slate-400'
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1 break-words">{t.message}</div>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('ToastProvider belum dipasang');
  return ctx;
}
