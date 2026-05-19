import React from 'react';
import { NavLink } from 'react-router-dom';
import { roleLabel } from '../lib/auth.js';

export default function Sidebar({ navItems, user, isOpen, onClose, onLogout, canManageUsers }) {
  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-sm transition-opacity lg:hidden ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-slate-900 text-slate-100 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Mapping Jaringan</h1>
            <p className="text-xs font-medium text-slate-400 mt-1">ODC · PON · Box · Tiang</p>
          </div>
          <button
            type="button"
            className="lg:hidden p-2 -mr-2 text-slate-400 hover:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-600"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1" aria-label="Main Navigation">
          {navItems
            .filter((item) => !item.requiresAdmin || canManageUsers(user))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={isActive ? 'text-white' : 'text-slate-400'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
        </nav>

        <div className="p-4 border-t border-slate-800 mt-auto">
          <div className="bg-slate-800/50 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white font-bold shadow-sm">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{user?.name || 'Administrator'}</div>
                <div className="truncate text-xs text-slate-400">{roleLabel(user?.role)}</div>
              </div>
            </div>
            <button
              type="button"
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-700/50 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              onClick={onLogout}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
