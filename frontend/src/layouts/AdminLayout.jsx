import React, { useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, UsersRound, Database,
  ClipboardList, BookOpen, Settings, LogOut, Trophy
} from 'lucide-react';
import { apiClient } from '../api/client';
import { initials, setPortal } from '../utils/initials';
import './MainLayout.css';
import './AdminLayout.css';

const AdminLayout = () => {
  const location = useLocation();

  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : { full_name: 'Admin' };

  // Same sign-out as the other portals: revoke the session server-side, then
  // clear local state (this used to leave the refresh token behind).
  const handleLogout = () => apiClient.logout();

  useEffect(() => { setPortal('admin'); }, []);

  const adminNav = [
    { name: 'Dashboard',        path: '/admin',                 icon: LayoutDashboard },
    { name: 'Users',            path: '/admin/users',           icon: Users },
    { name: 'Batches',          path: '/admin/batches',         icon: UsersRound },
    { name: 'Question bank',    path: '/admin/question-bank',   icon: Database },
    { name: 'New test',         path: '/admin/test-initiation', icon: ClipboardList },
    { name: 'Test library',     path: '/admin/test-library',    icon: BookOpen },
    { name: 'Test results',     path: '/admin/test-results',    icon: Trophy },
  ];

  return (
    <div className="app-layout admin-theme">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark" aria-hidden="true" />
          <span>EduCommand</span>
        </div>
        <div className="sidebar-header">
          <div className="user-profile">
            <div className="avatar" aria-hidden="true">{initials(user.full_name || 'Administrator')}</div>
            <div className="user-info">
              <h4>{user.full_name || 'Administrator'}</h4>
              <span>Admin</span>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {adminNav.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/admin'
                ? location.pathname === '/admin'
                : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <Link
            to="/admin/settings"
            className={`nav-item ${location.pathname === '/admin/settings' ? 'active' : ''}`}
          >
            <Settings size={18} />
            <span>Settings</span>
          </Link>
          <button className="nav-item text-danger" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
