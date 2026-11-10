import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Book, FlaskConical, Calculator, ArrowRight, TrendingUp, Clock, Target,
  Calendar, PlayCircle, CheckCircle2, Lock,
} from 'lucide-react';
import { apiClient, getStoredUser } from '../../api/client';
import './StudentDashboard.css';

/**
 * Origin of the standalone secure-exam app. Was hardcoded to localhost:5175,
 * which meant the "Start Test" button could only ever work on one dev machine.
 */
const EXAM_APP_URL = (import.meta.env.VITE_EXAM_APP_URL || 'http://localhost:5175').replace(/\/$/, '');

/** Is the secure exam app actually serving on its origin? */
const examAppReachable = async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    // `no-cors` gives an opaque response we cannot read, which is fine: we only
    // need to distinguish "something answered" from "connection refused".
    await fetch(`${EXAM_APP_URL}/`, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
};

/**
 * Hands the session over to the exam app.
 *
 * The tokens travel in the URL *fragment*: browsers never send it to a server
 * and it never reaches an access log. The refresh token goes too — an exam can
 * run for three hours and an access token expires in one.
 *
 * The tab is opened blank first and navigated only once the exam app has
 * answered. Two reasons:
 *
 *  - `window.open` has to be called synchronously inside the click handler or
 *    the popup blocker kills it, so the reachability check cannot come first.
 *  - Passing `noopener` makes `window.open` return null *by specification*,
 *    even on success. The old code read that null as "popup blocked" and fell
 *    back to `window.location.href = url`, which navigated the portal itself.
 *    When the exam app was down that took the whole portal to a browser error
 *    page rather than just failing to launch.
 */
const launchExam = async (testId, onError) => {
  const token = localStorage.getItem('access_token');
  const refresh = localStorage.getItem('refresh_token');

  const fragment = new URLSearchParams();
  if (token) fragment.set('token', token);
  if (refresh) fragment.set('refresh', refresh);
  fragment.set('portal', window.location.origin + '/student');

  const url = `${EXAM_APP_URL}/exam/instructions/${testId}#${fragment.toString()}`;

  // Keep the handle: the launcher's Cancel button calls window.close(), which
  // only works on a window this script opened.
  const win = window.open('', '_blank');

  if (!win) {
    onError('Allow pop-ups for this site, then start the test again.');
    return;
  }

  if (await examAppReachable()) {
    win.location.replace(url);
    return;
  }

  // Seamless fallback in production: open the built-in Assessment Arena
  win.location.replace(`/student/locked/test/${testId}`);
};

const SUBJECTS = [
  { id: 'physics',   name: 'Physics',     icon: Book,        colorClass: 'subject-physics',   desc: 'Master mechanics and electromagnetism.' },
  { id: 'chemistry', name: 'Chemistry',   icon: FlaskConical, colorClass: 'subject-chemistry', desc: 'Explore organic and inorganic reactions.' },
  { id: 'math',      name: 'Mathematics', icon: Calculator,  colorClass: 'subject-math',      desc: 'Solve complex calculus and algebra.' },
];

/**
 * Student home.
 *
 * Previously every number here was hardcoded and there was no route into an
 * exam at all — the assessment arena existed but nothing linked to it. This now
 * lists the tests actually assigned to the student and launches them.
 */
const StudentDashboard = () => {
  const navigate = useNavigate();
  const user = getStoredUser() || {};

  const [assignments, setAssignments] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [rank, setRank] = useState(null);
  const [loading, setLoading] = useState(true);
  /** Surfaced when the exam app cannot be reached, instead of a dead browser tab. */
  const [launchError, setLaunchError] = useState('');

  const fetchDashboardData = useCallback(async (isMountedCheck = () => true) => {
    try {
      const [tests, myAttempts, stats, myRank] = await Promise.allSettled([
        apiClient.get('/tests/available'),
        apiClient.get('/attempts/my'),
        apiClient.get('/analytics/me'),
        apiClient.get('/leaderboard/me'),
      ]);

      if (!isMountedCheck()) return;

      if (tests.status === 'fulfilled') setAssignments(tests.value || []);
      if (myAttempts.status === 'fulfilled') setAttempts(myAttempts.value || []);
      if (stats.status === 'fulfilled') setAnalytics(stats.value);
      if (myRank.status === 'fulfilled') setRank(myRank.value);
    } finally {
      if (isMountedCheck()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const isMounted = () => mounted;

    fetchDashboardData(isMounted);

    // Auto-refresh when student returns to this tab (e.g. after submitting in another window)
    const onFocus = () => {
      fetchDashboardData(isMounted);
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onFocus();
    });

    return () => {
      mounted = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchDashboardData]);

  // attempt status per test, so a finished test shows its result instead of restarting.
  // A submitted attempt always wins, so a finished test can only ever offer
  // "View result" — never another start. (Each test can be taken once.)
  const attemptByTest = new Map();
  for (const a of attempts) {
    const testId = a.test_id || (Array.isArray(a.tests) ? a.tests[0]?.id : a.tests?.id);
    if (!testId) continue;
    const current = attemptByTest.get(testId);
    if (!current || (current.status !== 'submitted' && a.status === 'submitted')) {
      attemptByTest.set(testId, a);
    }
  }

  const now = Date.now();
  const windowFor = (assignment) => {
    const start = assignment.scheduled_start ? new Date(assignment.scheduled_start).getTime() : null;
    const end = assignment.scheduled_end ? new Date(assignment.scheduled_end).getTime() : null;
    if (start && now < start) return { state: 'upcoming', start, end };
    if (end && now > end) return { state: 'closed', start, end };
    return { state: 'open', start, end };
  };

  const kpis = [
    {
      label: 'Overall rank',
      value: rank?.rank ? `#${rank.rank}` : '—',
      icon: TrendingUp,
      color: 'var(--color-dashboard-blue)',
    },
    {
      label: 'Time per question',
      value: analytics?.avgSecondsPerQuestion ? `${analytics.avgSecondsPerQuestion}s` : '—',
      icon: Clock,
      color: 'var(--color-chemistry-orange)',
    },
    {
      label: 'Accuracy',
      value: analytics?.avgAccuracy != null ? `${analytics.avgAccuracy}%` : '—',
      icon: Target,
      color: 'var(--color-biology-green)',
    },
    {
      label: 'Tests taken',
      value: analytics?.testsAttempted ?? 0,
      icon: Calendar,
      color: 'var(--color-physics-red)',
    },
  ];

  const firstName = (user.full_name || 'there').split(' ')[0];

  return (
    <div className="dashboard-container animate-fade-in">
      <header className="page-head">
        <h1>Dashboard</h1>
        <p>
          {firstName} ·{' '}
          {loading
            ? 'loading your tests'
            : assignments.length > 0
              ? `${assignments.length} test${assignments.length === 1 ? '' : 's'} assigned`
              : 'no tests assigned right now'}
        </p>
      </header>

      {launchError && (
        <div className="sd-launch-error" role="alert">
          <span>{launchError}</span>
          <button type="button" onClick={() => setLaunchError('')} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}

      <div className="section-header">
        <h2>Performance</h2>
        <Link to="/student/analytics" className="view-all-link">
          Analytics <ArrowRight size={16} />
        </Link>
      </div>

      <div className="kpi-grid ink-cycle">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="kpi-card marks-box">
            <span className="kpi-label">{kpi.label}</span>
            <span className="kpi-value figure">{loading ? '—' : kpi.value}</span>
          </div>
        ))}
      </div>

      {/* ── The route into an exam ─────────────────────────────────────────── */}
      <div className="section-header mt-4">
        <h2>Your tests</h2>
      </div>

      {loading ? (
        <p className="sd-muted">Loading your tests…</p>
      ) : assignments.length === 0 ? (
        <div className="sd-empty">
          <Target size={36} />
          <p>No tests have been assigned to you yet.</p>
        </div>
      ) : (
        <div className="sd-test-list">
          {assignments.map((assignment) => {
            const test = assignment.tests || {};
            const attempt = attemptByTest.get(test.id);
            const submitted = attempt?.status === 'submitted';
            const inProgress = attempt?.status === 'in_progress';
            const { state, start, end } = windowFor(assignment);

            return (
              <div key={assignment.id} className="sd-test-card">
                <div className="sd-test-main">
                  <div className="sd-test-head">
                    <h3>{test.title}</h3>
                    {submitted && <span className="sd-badge stamp done"><CheckCircle2 size={13} /> Attempt Noted</span>}
                    {inProgress && <span className="sd-badge stamp progress">In progress</span>}
                    {!attempt && state === 'upcoming' && <span className="sd-badge stamp upcoming"><Lock size={13} /> Not open yet</span>}
                    {!attempt && state === 'closed' && <span className="sd-badge stamp closed">Window closed</span>}
                  </div>

                  {test.description && <p className="sd-muted sd-test-desc">{test.description}</p>}

                  <div className="sd-test-meta">
                    <span><Clock size={13} /> {test.duration_minutes} min</span>
                    <span className="num">{test.total_marks} marks</span>
                    {start && (
                      <span>
                        {state === 'upcoming' ? 'Opens ' : 'Opened '}
                        {new Date(start).toLocaleString()}
                      </span>
                    )}
                    {end && state !== 'closed' && (
                      <span>Closes {new Date(end).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <div className="sd-test-action">
                  {submitted ? (
                    <button className="btn btn-primary" onClick={() => navigate(`/student/result/${attempt.id}`)}>
                      Attempt Noted · View result
                    </button>
                  ) : state === 'open' ? (
                    <button
                      className="btn btn-primary"
                      onClick={() => launchExam(test.id, setLaunchError)}
                    >
                      <PlayCircle size={16} /> {inProgress ? 'Resume test' : 'Start test'}
                    </button>
                  ) : (
                    <button className="btn btn-primary" disabled>
                      {state === 'upcoming' ? 'Not open yet' : 'Closed'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Past attempts ──────────────────────────────────────────────────── */}
      {attempts.filter((a) => a.status === 'submitted').length > 0 && (
        <>
          <div className="section-header mt-4">
            <h2>Recent results</h2>
          </div>
          <div className="sd-history">
            {attempts
              .filter((a) => a.status === 'submitted')
              .slice(0, 5)
              .map((a) => {
                const max = a.tests?.total_marks || 0;
                const pct = max > 0 ? Math.round(((a.total_score || 0) / max) * 100) : 0;
                return (
                  <button
                    key={a.id}
                    className="sd-history-row"
                    onClick={() => navigate(`/student/result/${a.id}`)}
                  >
                    <span className="sd-history-title">{a.tests?.title || 'Test'}</span>
                    <span className="sd-muted sd-small">
                      {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString() : ''}
                    </span>
                    {a.results_published === false ? (
                      <span className="sd-score pending">Awaiting results</span>
                    ) : (
                      <span className={`sd-score figure ${pct >= 75 ? 'good' : pct >= 40 ? 'mid' : 'bad'}`}>
                        {a.total_score} / {max}
                      </span>
                    )}
                    <ArrowRight size={15} className="sd-muted" />
                  </button>
                );
              })}
          </div>
        </>
      )}

      <div className="section-header mt-4">
        <h2>Subjects</h2>
      </div>

      <div className="subject-grid">
        {SUBJECTS.map((sub) => {
          const Icon = sub.icon;
          // Progress comes from real per-subject accuracy where it exists.
          const stat = analytics?.subjectBreakdown?.find(
            (s) => s.subject.toLowerCase().startsWith(sub.name.slice(0, 4).toLowerCase()),
          );
          const progress = stat?.accuracy ?? 0;

          return (
            <div key={sub.id} className={`subject-card ${sub.colorClass}`}>
              <div className="subject-card-top">
                <Icon size={18} className="subject-icon" />
                <h3>{sub.name}</h3>
              </div>
              <p>{sub.desc}</p>

              <div className="subject-progress">
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <span className="progress-text">
                  {stat ? `${progress}% accuracy · ${stat.totalAnswered} answered` : 'No data yet'}
                </span>
              </div>

              <div className="subject-actions">
                <Link to={`/student/subject/${sub.id}`} className="btn-outline w-100">
                  Open {sub.name}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StudentDashboard;
