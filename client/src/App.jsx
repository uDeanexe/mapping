import React, { useState, useEffect } from 'react';
import { Navigate, NavLink, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MapPage from './pages/MapPage.jsx';
import TopologyPage from './pages/TopologyPage.jsx';
import NodesPage from './pages/NodesPage.jsx';
import LinksPage from './pages/LinksPage.jsx';
import IncidentsPage from './pages/IncidentsPage.jsx';
import WorkReportsPage from './pages/WorkReportsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import { canManageUsers, clearAuth, getStoredUser, getToken, roleLabel } from './lib/auth.js';

const navItems = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h7" />
        <path d="M3 12h7" />
        <path d="M3 18h7" />
        <path d="M14 6h7" />
        <path d="M14 12h7" />
        <path d="M14 18h7" />
      </svg>
    ),
    end: true
  },
  {
    to: '/map',
    label: 'Map View',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6l7-2 7 2 7-2v14l-7 2-7-2-7 2V6z" />
        <path d="M10 4v14" />
        <path d="M18 6v14" />
      </svg>
    )
  },
  {
    to: '/topology',
    label: 'Topology View',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="2" />
        <circle cx="5" cy="19" r="2" />
        <circle cx="19" cy="19" r="2" />
        <path d="M12 7v10" />
        <path d="M12 7l-6 8" />
        <path d="M12 7l6 8" />
      </svg>
    )
  },
  {
    to: '/nodes',
    label: 'Data Node',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
        <path d="M8 4v16" />
      </svg>
    )
  },
  {
    to: '/links',
    label: 'Data Link',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 14a3 3 0 0 1 0-4" />
        <path d="M14 10a3 3 0 0 1 0 4" />
        <path d="M12 12h2" />
      </svg>
    )
  },
  {
    to: '/gangguan',
    label: 'Gangguan',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    )
  },
  {
    to: '/rekam-kerja',
    label: 'Rekam Kerja',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3h6" />
        <path d="M9 7h6" />
        <path d="M5 21h14" />
        <path d="M7 17h10" />
      </svg>
    )
  },
  {
    to: '/users',
    label: 'Akun User',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M4 21v-2a4 4 0 0 1 3-3.87" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    requiresAdmin: true
  }
];

function Layout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getStoredUser();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="app min-h-screen bg-slate-50 text-slate-900">
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
      <aside className={`sidebar fixed inset-y-0 left-0 z-40 w-72 transform overflow-y-auto bg-slate-950 p-6 text-slate-100 transition duration-300 lg:static lg:translate-x-0 lg:w-72 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="brand-title text-xl font-extrabold">Mapping Jaringan</div>
            <div className="brand-subtitle mt-2 text-sm text-slate-400">ODC | PON | Box | Tiang</div>
          </div>
          <button className="button-close-sidebar inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-slate-200 lg:hidden" onClick={() => setIsSidebarOpen(false)} aria-label="Tutup Menu">
            ×
          </button>
        </div>
        <nav className="nav" aria-label="Navigasi utama">
          {navItems
            .filter((item) => !item.requiresAdmin || canManageUsers(user))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                    isActive ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`
                }
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
        </nav>
        <div className="sidebar-footer">
          <div className="text-sm text-slate-400">
            {user?.name || '-'} | {roleLabel(user?.role)}
          </div>
          <button
            className="button mt-4 w-full rounded-2xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            onClick={() => {
              clearAuth();
              navigate('/login', { replace: true });
            }}
          >
            Logout
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="header sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur-sm shadow-sm shadow-slate-200/5">
          <div className="header-left">
            <button className="button-menu" onClick={() => setIsSidebarOpen(true)} aria-label="Buka Menu">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16"></path>
              </svg>
            </button>
            <div className="header-title text-lg font-bold">Sistem Mapping & Topology</div>
          </div>
          <div className="header-actions">
            <div className="header-profile">
              <div className="header-profile-avatar">{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</div>
              <div>
                <div className="header-profile-name">{user?.name || 'Administrator'}</div>
                <div className="header-profile-role">{roleLabel(user?.role)}</div>
              </div>
            </div>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}

function RequireAuth({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

function ProtectedPage({ children }) {
  return (
    <RequireAuth>
      <Layout>{children}</Layout>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ProtectedPage><DashboardPage /></ProtectedPage>} />
      <Route path="/map" element={<ProtectedPage><MapPage /></ProtectedPage>} />
      <Route path="/topology" element={<ProtectedPage><TopologyPage /></ProtectedPage>} />
      <Route path="/nodes" element={<ProtectedPage><NodesPage /></ProtectedPage>} />
      <Route path="/links" element={<ProtectedPage><LinksPage /></ProtectedPage>} />
      <Route path="/gangguan" element={<ProtectedPage><IncidentsPage /></ProtectedPage>} />
      <Route path="/rekam-kerja" element={<ProtectedPage><WorkReportsPage /></ProtectedPage>} />
      <Route path="/users" element={<ProtectedPage><UsersPage /></ProtectedPage>} />
      <Route
        path="*"
        element={
          <ProtectedPage>
            <div className="card">
              <h2>Halaman tidak ditemukan</h2>
              <p className="muted">Cek menu di sidebar.</p>
            </div>
          </ProtectedPage>
        }
      />
    </Routes>
  );
}
