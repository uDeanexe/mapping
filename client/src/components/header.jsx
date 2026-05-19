import React from 'react';
import { roleLabel } from '../lib/auth.js';

export default function Header({ onToggleSidebar, onLogout, user }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      <div className="flex items-center gap-4 lg:hidden">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-slate-700 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 rounded-lg"
          onClick={onToggleSidebar}
          aria-label="Open sidebar"
        >
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
        <div className="font-semibold text-slate-900 truncate">Dashboard</div>
      </div>
      
      <div className="hidden lg:flex lg:flex-1 lg:items-center lg:gap-3">
        <div className="text-xl font-semibold text-slate-800">Dashboard Operasional</div>
      </div>

      <div className="flex items-center gap-4 ml-auto">
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">{user?.name || 'Administrator'}</div>
            <div className="text-xs text-slate-500 truncate">{roleLabel(user?.role)}</div>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 border border-sky-200 text-sky-700 font-bold shadow-sm">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
          onClick={onLogout}
          aria-label="Logout"
          title="Logout"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="sr-only">Logout</span>
        </button>
      </div>
    </header>
  );
}
