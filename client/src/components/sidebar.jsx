import React from 'react';
import { NavLink } from 'react-router-dom';

export default function Sidebar({ navItems, user, isOpen, onClose, canManageUsers }) {
  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className={`fixed inset-0 z-[2000] bg-slate-900/80 backdrop-blur-sm transition-opacity lg:hidden ${
          isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-[2100] flex w-72 max-w-[85vw] flex-col bg-slate-900 text-slate-100 shadow-xl transition-transform duration-300 ease-in-out overscroll-contain ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:static lg:max-w-none lg:translate-x-0`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-white">Mapping Jaringan</h1>
            <p className="mt-1 text-xs font-medium text-slate-400">ODC · PON · Box · Tiang</p>
          </div>

          {/* Close (mobile only) */}
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

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overscroll-contain py-4 space-y-1 px-3" aria-label="Main Navigation">
          {navItems
            .filter((item) => !item.requiresAdmin || canManageUsers(user))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg text-sm font-medium transition-colors px-3 py-2.5 lg:py-3 ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'} group-hover:text-white`}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
        </nav>

        <div className="border-t border-slate-800 mt-auto h-3" />
      </aside>
    </>
  );
}

