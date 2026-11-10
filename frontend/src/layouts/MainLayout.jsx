import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Book, FlaskConical, Calculator, Settings, LogOut,
  Award, Layers, Users, MessageSquare, Database, FileText, Upload,
  UsersRound, Video, ClipboardCheck, ChevronLeft, ChevronRight, Trophy
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useAppData } from '../context/AppDataContext';
import { initials, setPortal } from '../utils/initials';
import './MainLayout.css';

const MainLayout = () => {
  const location = useLocation();
  const { sidebarCollapsed, setSidebarCollapsed } = useAppData();

  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : { role: 'student', full_name: 'Student' };
  const isTeacher = user.role === 'teacher' || user.role === 'admin';

  // Revokes the session server-side before clearing local state, so a captured
  // token cannot be replayed after the user has left.
  const handleLogout = () => apiClient.logout();

  // Automatically collapse sidebar into icon-only mode when on Test Constructor / Add Questions routes
  const isConstructorRoute = location.pathname.includes('/test-constructor');
  const [userToggledOpen, setUserToggledOpen] = useState(false);

  useEffect(() => {
    setUserToggledOpen(false);
  }, [location.pathname]);

  // Each portal writes in its own ink. An admin browsing teacher pages keeps
  // the admin ink, so it is always clear which console you are in.
  useEffect(() => {
    setPortal(user.role === 'admin' ? 'admin' : isTeacher ? 'teacher' : 'student');
  }, [user.role, isTeacher]);

  const isCollapsed = Boolean((isConstructorRoute && !userToggledOpen) || sidebarCollapsed);

  const toggleSidebar = () => {
    if (isCollapsed) {
      setUserToggledOpen(true);
      if (typeof setSidebarCollapsed === 'function') setSidebarCollapsed(false);
    } else {
      setUserToggledOpen(false);
      if (typeof setSidebarCollapsed === 'function') setSidebarCollapsed(true);
    }
  };

  const studentNav = [
    { name: 'Dashboard', path: '/student', icon: LayoutDashboard },
    { name: 'Physics', path: '/student/subject/physics', icon: Book },
    { name: 'Chemistry', path: '/student/subject/chemistry', icon: FlaskConical },
    { name: 'Mathematics', path: '/student/subject/math', icon: Calculator },
    { name: 'Lectures', path: '/student/lectures', icon: Video },
    { name: 'Test library', path: '/student/test-library', icon: FileText },
    { name: 'Analytics', path: '/student/analytics', icon: Layers },
    { name: 'Leaderboard', path: '/student/leaderboard', icon: Award },
    { name: 'Doubts', path: '/student/doubts', icon: MessageSquare },
  ];

  const isAdmin = user.role === 'admin';

  // Grouped the way a teacher's week runs: papers, questions, students.
  const teacherNav = [
    { name: 'Dashboard', path: '/teacher', icon: LayoutDashboard },
    { section: 'Papers' },
    // Building a paper from scratch is an admin action; teachers fill in the
    // questions for their subject from Test Library instead.
    ...(isAdmin
      ? [{ name: 'Test constructor', path: '/teacher/test-constructor', icon: Layers }]
      : []),
    { name: 'Test library', path: '/teacher/test-library', icon: FileText },
    { name: 'Test results', path: '/teacher/test-results', icon: Trophy },
    { section: 'Questions' },
    { name: 'Question bank', path: '/teacher/question-bank', icon: Database },
    { name: 'Review queue', path: '/teacher/review-queue', icon: ClipboardCheck },
    { name: 'CSV upload', path: '/teacher/csv-upload', icon: Upload },
    { section: 'Students' },
    { name: 'Batches', path: '/teacher/batch-management', icon: UsersRound },
    { name: 'Students', path: '/teacher/crm', icon: Users },
    { name: 'Cohort analytics', path: '/teacher/analytics', icon: Award },
    { name: 'Doubt queue', path: '/teacher/doubt-queue', icon: MessageSquare },
    { name: 'Lectures', path: '/teacher/lectures', icon: Video },
  ];

  const navItems = isTeacher ? teacherNav : studentNav;

  return (
    <div className={`app-layout ${isTeacher ? 'teacher-theme' : 'student-theme'} ${isCollapsed ? 'sidebar-collapsed-mode' : ''}`}>
      <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`} aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark" aria-hidden="true" />
          <span>EduCommand</span>
        </div>
        <div className="sidebar-header">
          <div className="user-profile" title={user.full_name || (isTeacher ? 'Teacher' : 'Student')}>
            <div className="avatar" aria-hidden="true">{initials(user.full_name || (isTeacher ? 'Teacher' : 'Student'))}</div>
            <div className="user-info">
              <h4>{user.full_name || (isTeacher ? 'Teacher' : 'Student')}</h4>
              <span>{isAdmin ? 'Admin' : isTeacher ? (user.subject && user.subject !== 'All' ? `${user.subject} teacher` : 'Teacher') : 'Student'}</span>
            </div>
          </div>
          <button
            type="button"
            className="sidebar-toggle-btn"
            onClick={toggleSidebar}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            if (item.section) {
              return <div key={`section-${item.section}`} className="nav-section">{item.section}</div>;
            }
            const Icon = item.icon;
            
            // Logic for active state, checking exact match OR specific sub-routes
            let isActive = location.pathname === item.path;
            
            // Special sub-route handling for teacher portal
            if (item.path === '/teacher/crm' && location.pathname.startsWith('/teacher/student/')) {
              isActive = true;
            }
            if (item.path === '/teacher/doubt-queue' && location.pathname.startsWith('/teacher/doubt-chat/')) {
              isActive = true;
            }
            if (item.path === '/teacher/test-results' && location.pathname.startsWith('/teacher/test-results')) {
              isActive = true;
            }

            return (
              <Link
                key={item.name}
                to={item.path}
                className={`nav-item ${isActive ? 'active' : ''}`}
                title={item.name}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <Link
            to={isTeacher ? "/teacher/settings" : "/student/settings"}
            className={`nav-item ${location.pathname === (isTeacher ? '/teacher/settings' : '/student/settings') ? 'active' : ''}`}
            title="Settings"
          >
            <Settings size={18} />
            <span>Settings</span>
          </Link>
          <button className="nav-item text-danger" onClick={handleLogout} title="Sign out">
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

export default MainLayout;
