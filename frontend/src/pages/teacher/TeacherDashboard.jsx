import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MessageSquare, FileText, Upload, Database, TrendingUp, ClipboardCheck, AlertTriangle, ChevronRight,
} from 'lucide-react';
import { apiClient, getStoredUser, toList } from '../../api/client';
import './TeacherDashboard.css';

/**
 * Teacher home.
 *
 * Every KPI here used to be a hardcoded literal ("245 students", "12 doubts").
 * They are now derived from the same endpoints the individual pages use.
 */
const TeacherDashboard = () => {
  const navigate = useNavigate();
  const user = getStoredUser() || {};

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [students, batches, tests, doubts, cohort, review] = await Promise.allSettled([
        apiClient.get('/users/students'),
        apiClient.get('/batches'),
        apiClient.get('/tests'),
        apiClient.get('/doubts'),
        apiClient.get('/analytics/cohort'),
        apiClient.get('/questions/review-queue?limit=1'),
      ]);

      if (cancelled) return;

      const val = (r, fallback) => (r.status === 'fulfilled' ? r.value : fallback);
      // List endpoints answer `{ data, total, ... }`; `total` is the count across
      // every page, which is what a dashboard tile should show.
      const rows = (r) => (r.status === 'fulfilled' ? toList(r.value) : []);
      const count = (r) =>
        r.status === 'fulfilled' ? (r.value?.total ?? toList(r.value).length) : 0;

      const testList = rows(tests);
      const doubtList = rows(doubts);

      setStats({
        students: count(students),
        batches: rows(batches).length,
        published: testList.filter((t) => t.status === 'published').length,
        drafts: testList.filter((t) => t.status !== 'published').length,
        pendingDoubts: doubtList.filter((d) => d.status !== 'resolved').length,
        avgScore: val(cohort, {})?.avgScore ?? 0,
        atRisk: val(cohort, {})?.atRiskCount ?? 0,
        pendingReview: val(review, {})?.total ?? 0,
      });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  const show = (v) => (loading ? '—' : v);

  const kpis = [
    { label: 'Students', value: show(stats?.students), to: '/teacher/crm' },
    { label: 'Active batches', value: show(stats?.batches), to: '/teacher/batch-management' },
    { label: 'Published tests', value: show(stats?.published), to: '/teacher/test-library' },
    { label: 'Open doubts', value: show(stats?.pendingDoubts), to: '/teacher/doubt-queue', tone: stats?.pendingDoubts ? 'warning' : '' },
    { label: 'Average cohort score', value: show(stats?.avgScore), to: '/teacher/analytics' },
  ];

  const actions = [
    { to: '/teacher/test-library', icon: FileText, title: 'Test library', text: 'Open a test to add your subject’s questions or see its results' },
    { to: '/teacher/csv-upload', icon: Upload, title: 'Upload questions', text: 'Import a CSV, or extract questions from a PDF paper' },
    { to: '/teacher/review-queue', icon: ClipboardCheck, title: 'Review queue', text: 'Check extracted questions before they can go on a paper' },
    { to: '/teacher/doubt-queue', icon: MessageSquare, title: 'Doubt queue', text: 'Answer students’ doubts as they come in' },
    { to: '/teacher/question-bank', icon: Database, title: 'Question bank', text: 'Browse, edit and tag questions by topic and type' },
    { to: '/teacher/analytics', icon: TrendingUp, title: 'Cohort analytics', text: 'Scores and weak topics across your batches' },
  ];

  const subjectLabel = user.subject && user.subject !== 'All' ? `${user.subject} faculty` : 'Faculty';

  return (
    <div className="teacher-dashboard">
      <header className="page-head">
        <h1>Dashboard</h1>
        <p>{user.full_name || 'Teacher'} · {subjectLabel}</p>
      </header>

      {/* Things that need attention, only when they exist. */}
      {!loading && (stats?.pendingReview > 0 || stats?.atRisk > 0) && (
        <section className="td-alerts">
          {stats.pendingReview > 0 && (
            <button className="td-alert" onClick={() => navigate('/teacher/review-queue')}>
              <ClipboardCheck size={16} />
              <span>
                <strong className="num">{stats.pendingReview}</strong> extracted {stats.pendingReview === 1 ? 'question needs' : 'questions need'} review
              </span>
            </button>
          )}
          {stats.atRisk > 0 && (
            <button className="td-alert warn" onClick={() => navigate('/teacher/analytics')}>
              <AlertTriangle size={16} />
              <span>
                <strong className="num">{stats.atRisk}</strong> {stats.atRisk === 1 ? 'student' : 'students'} flagged at risk
              </span>
            </button>
          )}
        </section>
      )}

      <section className="kpi-grid ink-cycle">
        {kpis.map((kpi) => (
          <button key={kpi.label} type="button" className="kpi-card marks-box" onClick={() => navigate(kpi.to)}>
            <span className="kpi-label">{kpi.label}</span>
            <span className={`kpi-value figure ${kpi.tone || ''}`}>{kpi.value}</span>
          </button>
        ))}
      </section>

      <section className="quick-actions">
        <h2>Shortcuts</h2>
        <div className="action-grid ink-cycle">
          {actions.map(({ to, icon: Icon, title, text }, i) => (
            <Link key={to} to={to} className="action-card">
              <span className="action-qno num">{String(i + 1).padStart(2, '0')}</span>
              <Icon size={18} className="action-icon" />
              <span className="action-text">
                <h3>{title}</h3>
                <p>{text}</p>
              </span>
              <ChevronRight size={16} className="action-chevron" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default TeacherDashboard;
