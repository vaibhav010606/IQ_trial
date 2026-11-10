import React, { useState, useEffect } from 'react';
import {
  Users,
  GraduationCap,
  BookOpen,
  ClipboardList,
  ArrowRight,
  Plus,
  Layers,
  UserPlus,
  FileQuestion,
  Database
} from 'lucide-react';
import { apiClient, toList } from '../../api/client';
import { getPattern, patternIdOf } from '../../utils/examPatterns';
import { Link } from 'react-router-dom';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : {};

  const [stats, setStats] = useState({
    students: 0,
    teachers: 0,
    batches: 0,
    tests: 0,
  });

  const [recentTests, setRecentTests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [allUsers, batches, testsRes] = await Promise.allSettled([
          apiClient.get('/users/admin/all'),
          apiClient.get('/batches'),
          apiClient.get('/tests?limit=20'),
        ]);

        const users = allUsers.status === 'fulfilled' ? toList(allUsers.value) : [];
        const batchList = batches.status === 'fulfilled' ? toList(batches.value) : [];

        let testList = [];
        let totalTests = 0;
        if (testsRes.status === 'fulfilled') {
          const val = testsRes.value;
          testList = toList(val);
          totalTests = val?.total ?? testList.length;
        }

        setStats({
          students: users.filter((u) => u.role === 'student').length,
          teachers: users.filter((u) => u.role === 'teacher').length,
          batches: batchList.length,
          tests: totalTests,
        });

        setRecentTests(testList.slice(0, 5));
      } catch (e) {
        console.error('Failed loading admin dashboard data', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const todayStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const kpis = [
    {
      label: 'Students',
      value: stats.students,
      sub: 'Enrolled across batches',
      icon: Users,
      color: 'var(--accent)',
      bg: 'var(--accent-soft)',
      pill: 'Active',
      pillBg: 'var(--accent-soft)',
      pillColor: 'var(--accent-strong)',
    },
    {
      label: 'Teachers',
      value: stats.teachers,
      sub: 'Across all subjects',
      icon: GraduationCap,
      color: '#2f6b3a',
      bg: '#e3ecd9',
      pill: 'Staff',
      pillBg: '#e3ecd9',
      pillColor: '#2f6b3a',
    },
    {
      label: 'Active batches',
      value: stats.batches,
      sub: 'Classroom cohorts',
      icon: BookOpen,
      color: '#8f5c0e',
      bg: '#f3e6c6',
      pill: 'Cohorts',
      pillBg: '#f3e6c6',
      pillColor: '#8f5c0e',
    },
    {
      label: 'Tests',
      value: stats.tests,
      sub: 'Published and drafts',
      icon: ClipboardList,
      color: 'var(--accent)',
      bg: 'var(--accent-soft)',
      pill: 'Assessments',
      pillBg: 'var(--accent-soft)',
      pillColor: 'var(--accent-strong)',
    },
  ];

  const quickActions = [
    {
      title: 'New test',
      desc: 'Set up a JEE or NEET paper and assign a teacher to each subject',
      to: '/admin/test-initiation',
      icon: ClipboardList,
      color: 'var(--accent)',
      bg: 'var(--accent-soft)',
    },
    {
      title: 'Question bank',
      desc: 'Search questions, preview solutions, upload PDF papers',
      to: '/admin/question-bank',
      icon: Database,
      color: 'var(--accent)',
      bg: 'var(--accent-soft)',
    },
    {
      title: 'Batches',
      desc: 'Group students and schedule tests for each batch',
      to: '/admin/batches',
      icon: Layers,
      color: '#8f5c0e',
      bg: '#f3e6c6',
    },
    {
      title: 'Users',
      desc: 'Add students and teachers, change roles',
      to: '/admin/users',
      icon: UserPlus,
      color: '#2f6b3a',
      bg: '#e3ecd9',
    },
  ];

  return (
    <div className="admin-page admin-dash-container">
      <header className="admin-dash-head">
        <div className="page-head">
          <h1>Dashboard</h1>
          <p>{user.full_name || 'Administrator'} · {todayStr}</p>
        </div>
        <div className="admin-dash-hero-btn-row">
          <Link to="/admin/users" className="btn-outline">
            <UserPlus size={16} />
            Add user
          </Link>
          <Link to="/admin/test-initiation" className="btn-primary">
            <Plus size={16} />
            New test
          </Link>
        </div>
      </header>

      {/* KPIs: label, figure, what it counts */}
      <div className="admin-dash-kpi-grid ink-cycle">
        {kpis.map((k) => (
          <div key={k.label} className="admin-kpi-box marks-box">
            <div className="admin-kpi-label">{k.label}</div>
            <div className="admin-kpi-value figure">{loading ? '—' : k.value.toLocaleString()}</div>
            <div className="admin-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Shortcuts */}
      <div className="admin-action-tiles-grid ink-cycle">
        {quickActions.map((act) => {
          const Icon = act.icon;
          return (
            <Link key={act.title} to={act.to} className="admin-action-tile">
              <Icon size={18} className="admin-tile-icon" />
              <div className="admin-tile-body">
                <h4>{act.title}</h4>
                <p>{act.desc}</p>
              </div>
              <ArrowRight size={16} className="admin-tile-arrow" />
            </Link>
          );
        })}
      </div>

      {/* ── 4. Recent Tests Pipeline (Full Width) ── */}
      <div className="admin-dash-card">
        <div className="admin-dash-card-header">
          <div className="admin-dash-card-title-wrap">
            <h3>Recent tests</h3>
            <span className="admin-dash-card-badge num">{recentTests.length}</span>
          </div>
          <Link to="/admin/test-initiation" className="admin-dash-view-all">
            View all tests <ArrowRight size={14} />
          </Link>
        </div>

        {loading ? (
          <div style={{ padding: '28px 0', textAlign: 'center', color: '#736b5f', fontSize: 13 }}>
            Loading tests…
          </div>
        ) : recentTests.length === 0 ? (
          <div style={{ padding: '36px 0', textAlign: 'center' }}>
            <FileQuestion size={36} color="#c6b99e" style={{ margin: '0 auto 12px auto' }} />
            <p style={{ margin: 0, color: '#736b5f', fontSize: 14 }}>No tests yet</p>
            <Link
              to="/admin/test-initiation"
              style={{ display: 'inline-block', marginTop: 12, fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}
            >
              Create the first test
            </Link>
          </div>
        ) : (
          <div className="test-pipeline-list">
            {recentTests.map((t) => {
              const qList = t.test_questions || [];
              const spec = getPattern(patternIdOf(t));
              const isNeet = patternIdOf(t) === 'neet';
              const physQ = qList.filter((q) => q.questions?.subject === 'Physics').length;
              const chemQ = qList.filter((q) => q.questions?.subject === 'Chemistry').length;
              const mathQ = qList.filter((q) => q.questions?.subject === 'Mathematics').length;
              const bioQ  = qList.filter((q) => q.questions?.subject === 'Biology').length;
              const PATTERN_LABELS = { custom: 'Custom', mock_test: 'Mock test', quiz: 'Quiz' };
              const rawPattern = t.paper_pattern || t.t_type || 'custom';
              const patternLabel = spec ? spec.label : (PATTERN_LABELS[rawPattern] || rawPattern.replace(/_/g, ' '));

              return (
                <div key={t.id} className="test-pipeline-item">
                  <div className="test-pipeline-header">
                    <div>
                      <div className="test-pipeline-title">{t.title}</div>
                      <div className="test-pipeline-meta">
                        <span className="test-pipeline-pattern-tag">{patternLabel}</span>
                        <span className="num">{t.duration_minutes || spec?.durationMinutes || 60} min</span>
                        <span className="num">{qList.length} questions</span>
                      </div>
                    </div>
                    <span
                      className={`test-status-pill stamp ${
                        t.status === 'published' ? 'test-status-published' : 'test-status-draft'
                      }`}
                    >
                      {t.status || 'Draft'}
                    </span>
                  </div>

                  <div className="test-subject-progress-row">
                    <div className="test-sub-chip">
                      <span className="test-sub-name">Phys:</span>
                      <span className="test-sub-count num" style={{ color: physQ > 0 ? '#1b1a17' : '#998f7d' }}>
                        {physQ}
                      </span>
                    </div>
                    <div className="test-sub-chip">
                      <span className="test-sub-name">Chem:</span>
                      <span className="test-sub-count num" style={{ color: chemQ > 0 ? '#1b1a17' : '#998f7d' }}>
                        {chemQ}
                      </span>
                    </div>
                    {isNeet ? (
                      <div className="test-sub-chip">
                        <span className="test-sub-name">Bio:</span>
                        <span className="test-sub-count num" style={{ color: bioQ > 0 ? '#1b1a17' : '#998f7d' }}>
                          {bioQ}
                        </span>
                      </div>
                    ) : (
                      <div className="test-sub-chip">
                        <span className="test-sub-name">Math:</span>
                        <span className="test-sub-count num" style={{ color: mathQ > 0 ? '#1b1a17' : '#998f7d' }}>
                          {mathQ}
                        </span>
                      </div>
                    )}
                    <Link to="/admin/test-initiation" className="test-pipeline-btn">
                      Manage <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
