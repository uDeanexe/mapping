import React, { useState, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MapPage from './pages/MapPage.jsx';
import TopologyPage from './pages/TopologyPage.jsx';
import NodesPage from './pages/NodesPage.jsx';
import LinksPage from './pages/LinksPage.jsx';
import IncidentsPage from './pages/IncidentsPage.jsx';
import WorkReportsPage from './pages/WorkReportsPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import Sidebar from './components/sidebar.jsx';
import Header from './components/header.jsx';
import { canManageUsers, clearAuth, getStoredUser, getToken } from './lib/auth.js';

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

  useEffect(() => {
    if (!isSidebarOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSidebarOpen]);

  const handleLogout = () => {
    clearAuth();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar
        navItems={navItems}
        user={user}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        canManageUsers={canManageUsers}
      />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onToggleSidebar={() => setIsSidebarOpen(true)}
          onLogout={handleLogout}
          user={user}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
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
            <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900">Halaman tidak ditemukan</h2>
              <p className="mt-1 text-sm text-slate-500">Cek menu di sidebar.</p>
            </div>
          </ProtectedPage>
        }
      />
    </Routes>
  );
}
