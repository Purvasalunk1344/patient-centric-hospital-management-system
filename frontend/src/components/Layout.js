import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { billingAPI } from '../utils/api';
import { useAuth } from '../utils/AuthContext';

// Full nav includes a `roles` array — if omitted, it's visible to all roles
const NAV = [
  { section: 'Overview', roles: ['admin'] },
  { to: '/dashboard',        icon: '📊', label: 'Dashboard',      roles: ['admin'] },
  { section: 'Patients', roles: ['admin'] },
  { to: '/patients',         icon: '👤', label: 'Patients',       roles: ['admin'] },
  { to: '/appointments',     icon: '📅', label: 'Appointments' },
  { to: '/admissions',       icon: '🛏️',  label: 'Admissions',   roles: ['admin'] },
  { section: 'Clinical' },
  { to: '/doctors',          icon: '🩺', label: 'Doctors' },
  { to: '/prescriptions',    icon: '🩺', label: 'Prescriptions' },
  { to: '/labs',             icon: '🧪', label: 'Lab Tests',      roles: ['admin'] },
  { to: '/pharmacy',         icon: '💊', label: 'Pharmacy',       roles: ['admin'] },
  { to: '/reports',          icon: '📊', label: 'Reports',        roles: ['admin'] },
  { section: 'Finance', roles: ['admin'] },
  { to: '/billing',          icon: '🧾', label: 'Billing',        exact: true },
  { to: '/billing/alerts',   icon: '🔔', label: 'Billing Alerts', badge: true, roles: ['admin'] },
];

const PAGE_TITLES = {
  '/dashboard':       'Dashboard',
  '/patients':        'Patient Management',
  '/doctors':         'Doctors',
  '/appointments':    'Appointments',
  '/admissions':      'Admissions & Beds',
  '/labs':            'Lab Tests',
  '/pharmacy':        'Pharmacy',
  '/prescriptions':   'Prescriptions',
  '/billing/alerts':  'Billing Alerts',
  '/billing':         'Billing',
  '/reports':         'Hospital Intelligence / Reports',
};

export default function Layout() {
  const loc              = useLocation();
  const navigate         = useNavigate();
  const { user, logout } = useAuth();
  const [alertCount, setAlertCount] = useState(0);

  const isAdmin = user?.role === 'admin';

  // Find the most specific matching title
  const title = Object.entries(PAGE_TITLES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([k]) => loc.pathname.startsWith(k))?.[1] || 'Hospital';

  useEffect(() => {
    if (!isAdmin) return; // patients don't need alert count
    const fetchCount = () => {
      billingAPI.getAlertCount()
        .then(r => setAlertCount(r.data.count))
        .catch(() => {});
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter nav items by the current user's role
  const filteredNav = NAV.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role);
  });

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>🏥 HospitalMS</h1>
          <p>{isAdmin ? 'Admin Panel' : 'Patient Portal'}</p>
        </div>
        <nav className="sidebar-nav">
          {filteredNav.map((item, i) =>
            item.section ? (
              <div key={i} className="nav-section">{item.section}</div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.badge && alertCount > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: '99px',
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                    minWidth: 18,
                    textAlign: 'center',
                  }}>
                    {alertCount}
                  </span>
                )}
              </NavLink>
            )
          )}
        </nav>

        {/* User info + Logout at sidebar bottom */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
            👤 {user?.name}
            <span style={{
              marginLeft: 6,
              padding: '2px 8px',
              borderRadius: 99,
              fontSize: 11,
              fontWeight: 700,
              background: isAdmin ? '#dbeafe' : '#dcfce7',
              color: isAdmin ? '#1d4ed8' : '#15803d',
            }}>
              {user?.role}
            </span>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '8px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'transparent',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--text-2)',
            }}
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-right">
            <span className="badge badge-green">● System Online</span>
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {new Date().toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
