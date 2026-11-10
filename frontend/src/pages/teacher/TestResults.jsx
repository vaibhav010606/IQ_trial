import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft, Trophy, Users, TrendingUp, AlertTriangle, Download, Clock,
  Search, Filter, ChevronDown, CheckCircle2, Award, BookOpen
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { apiClient } from '../../api/client';
import MathText from '../../components/MathText';
import './TestResults.css';

/**
 * Comprehensive Test Results & Candidate Scoreboard.
 * Displays all results by all candidates across tests with score distributions,
 * search/filter controls, CSV export, and question difficulty analysis.
 */
const TestResults = () => {
  const { testId: routeTestId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = location.pathname.startsWith('/admin');
  const basePath = isAdmin ? '/admin/test-results' : '/teacher/test-results';
  const backPath = isAdmin ? '/admin/test-initiation' : '/teacher/test-library';

  const [allTests, setAllTests] = useState([]);
  const [selectedTestId, setSelectedTestId] = useState(routeTestId || '');
  const [testsLoading, setTestsLoading] = useState(true);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('students');

  // Candidate filters
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');

  // 1. Load list of all tests
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTestsLoading(true);
      try {
        const tests = await apiClient.getList('/tests');
        if (cancelled) return;
        setAllTests(tests || []);

        // Pick initial test id: route param first, then fallback to first test
        if (routeTestId) {
          setSelectedTestId(routeTestId);
        } else if (tests && tests.length > 0) {
          setSelectedTestId(tests[0].id);
        }
      } catch (err) {
        if (!cancelled) console.error('Failed to load tests list:', err);
      } finally {
        if (!cancelled) setTestsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [routeTestId]);

  // Keep selectedTestId synced if route param changes
  useEffect(() => {
    if (routeTestId && routeTestId !== selectedTestId) {
      setSelectedTestId(routeTestId);
    }
  }, [routeTestId, selectedTestId]);

  // 2. Load results for selected test
  const loadResults = useCallback(async (tId) => {
    if (!tId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiClient.get(`/tests/${tId}/results`);
      setData(res);
    } catch (e) {
      setError(e.message || 'Could not load results for this test.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedTestId) {
      loadResults(selectedTestId);
    }
  }, [selectedTestId, loadResults]);

  const [releasingResults, setReleasingResults] = useState(false);

  const handleToggleResultsRelease = async () => {
    if (!selectedTestId || !data) return;
    const targetStatus = !data.results_published;
    const msg = targetStatus
      ? 'Approve and release results to all candidates who took this test? Students will be able to see their scores immediately.'
      : 'Withhold results from students? Scores and solutions will be hidden from their view until re-approved.';
    if (!window.confirm(msg)) return;

    setReleasingResults(true);
    try {
      await apiClient.patch(`/tests/${selectedTestId}/publish-results`, { published: targetStatus });
      setData((prev) => ({
        ...prev,
        results_published: targetStatus,
        test: {
          ...(prev.test || {}),
          results_published: targetStatus,
        },
      }));
    } catch (e) {
      alert(e.message || 'Failed to update results release status');
    } finally {
      setReleasingResults(false);
    }
  };

  // Handle switching tests
  const handleTestChange = (newId) => {
    setSelectedTestId(newId);
    navigate(`${basePath}/${newId}`);
  };

  // Filter candidate results
  const filteredResults = useMemo(() => {
    if (!data?.results) return [];
    return data.results.filter((r) => {
      const name = (r.users?.full_name || '').toLowerCase();
      const email = (r.users?.email || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || name.includes(q) || email.includes(q);

      let matchesTier = true;
      if (tierFilter === 'TOP') matchesTier = r.percentage >= 75;
      else if (tierFilter === 'MID') matchesTier = r.percentage >= 40 && r.percentage < 75;
      else if (tierFilter === 'LOW') matchesTier = r.percentage < 40;

      return matchesSearch && matchesTier;
    });
  }, [data?.results, searchQuery, tierFilter]);

  // Client-side CSV export
  const exportCsv = () => {
    if (!data?.results?.length) return;

    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Rank', 'Candidate Name', 'Email', 'Score', 'Max Marks', 'Percentage', 'Submitted At', 'Auto Submitted'];
    const rows = data.results.map((r) => [
      r.rank,
      r.users?.full_name || 'Unknown',
      r.users?.email || '',
      r.total_score ?? 0,
      data.summary.maxMarks,
      `${r.percentage}%`,
      r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—',
      r.auto_submitted ? 'Yes' : 'No',
    ]);

    const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${(data.test?.title || 'test').replace(/[^a-z0-9]+/gi, '_')}_all_candidate_results.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return <span className="results-rank-badge rank-1 num" title="First">1</span>;
    if (rank === 2) return <span className="results-rank-badge rank-2 num" title="Second">2</span>;
    if (rank === 3) return <span className="results-rank-badge rank-3 num" title="Third">3</span>;
    return <span className="results-rank-badge rank-other">#{rank}</span>;
  };

  if (testsLoading && !data) {
    return <div className="results-page"><p className="results-muted">Loading test data…</p></div>;
  }

  if (allTests.length === 0) {
    return (
      <div className="results-page">
        <div className="results-empty">
          <BookOpen size={42} />
          <h3>No tests found</h3>
          <p>There are no tests in the system yet. Once tests are initiated and taken, results will appear here.</p>
          <button className="results-btn" onClick={() => navigate(backPath)}>
            Back to Tests
          </button>
        </div>
      </div>
    );
  }

  const { test, summary, results = [], questionStats = [] } = data || {};
  const attemptRate = summary?.assigned > 0
    ? Math.round((summary.submitted / summary.assigned) * 100)
    : 0;

  // Distribution in 10% bands
  const distribution = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}-${i * 10 + 10}%`,
    count: 0,
  }));

  // With negative marking a JEE score can go below zero (−2/300 is −1%), which
  // used to index band −1 and crash the whole page. Below zero counts in the
  // lowest band; anything non-numeric is skipped.
  if (results && results.length > 0) {
    for (const r of results) {
      const pct = Number(r.percentage);
      if (!Number.isFinite(pct)) continue;
      const idx = Math.max(0, Math.min(9, Math.floor(pct / 10)));
      distribution[idx].count += 1;
    }
  }

  const kpis = summary ? [
    { label: 'Candidates submitted', value: `${summary.submitted}/${summary.assigned}`, sub: `${attemptRate}% attendance rate`, icon: Users, color: '#2b44a6' },
    { label: 'Cohort average', value: `${summary.average}`, sub: `out of ${summary.maxMarks} marks`, icon: TrendingUp, color: '#2f6b3a' },
    { label: 'Highest score', value: `${summary.highest}`, sub: `median score: ${summary.median}`, icon: Trophy, color: '#8f5c0e' },
    { label: 'Auto-Submitted', value: `${summary.autoSubmitted}`, sub: 'ran out of test time', icon: Clock, color: '#2b44a6' },
  ] : [];

  return (
    <div className="results-page">
      {/* ── Top Header ── */}
      <header className="results-header">
        <div>
          <button className="results-back" onClick={() => navigate(backPath)}>
            <ArrowLeft size={17} /> {isAdmin ? 'Back to Test Initiation' : 'Back to Test Library'}
          </button>
          <h1>Candidate test results</h1>
          <p className="results-muted">
            Inspect performance scores, leaderboard rankings, and test metrics across all candidates.
          </p>
        </div>

        <div className="results-header-actions">
          {/* Test Selector Dropdown */}
          <div className="results-test-selector-card">
            <span className="results-selector-title">Test Paper:</span>
            <select
              className="results-test-select"
              value={selectedTestId}
              onChange={(e) => handleTestChange(e.target.value)}
              title="Select test to view results"
            >
              {allTests.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.subject || 'All Subjects'} · {t.status || 'draft'})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="results-btn"
            onClick={exportCsv}
            disabled={!results.length}
            title="Download candidate score records as CSV"
          >
            <Download size={16} /> Export CSV
          </button>
        </div>
      </header>

      {/* Loading state for switched test */}
      {loading && (
        <div className="results-card" style={{ textAlign: 'center', padding: '40px' }}>
          <p className="results-muted">Loading candidate results for this test…</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="results-card" style={{ borderColor: '#e2b6aa', background: '#f5e2da' }}>
          <p className="results-error" style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Results Content */}
      {!loading && data && (
        <>
          {isAdmin && (
            <div
              className="results-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '16px 20px',
                marginBottom: 20,
                border: data.results_published ? '1px solid #b6cba6' : '1px solid #dfc68f',
                background: data.results_published ? '#e3ecd9' : '#f3e6c6',
                borderRadius: 12,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: data.results_published ? '#2f6b3a' : '#8f5c0e',
                    }}
                  />
                  <strong style={{ fontSize: 14, color: data.results_published ? '#2f6b3a' : '#8f5c0e' }}>
                    {data.results_published
                      ? 'Student Visibility: Live & Released'
                      : 'Student Visibility: Withheld (Pending Admin Approval)'}
                  </strong>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#56504a' }}>
                  {data.results_published
                    ? 'Students who submitted this test can now see their score, accuracy, and detailed solutions in their portal.'
                    : 'Candidates who took this exam see a confirmation screen that results are pending approval. Scores are hidden until you release them.'}
                </p>
              </div>

              <button
                type="button"
                onClick={handleToggleResultsRelease}
                disabled={releasingResults}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  border: data.results_published ? '1px solid #c6b99e' : 'none',
                  background: data.results_published ? '#ffffff' : '#2f6b3a',
                  color: data.results_published ? '#56504a' : '#ffffff',
                  fontWeight: 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: data.results_published ? 'none' : '0 2px 8px rgba(47, 107, 58, 0.25)',
                  transition: 'var(--transition)',
                }}
              >
                {releasingResults
                  ? 'Updating...'
                  : data.results_published
                  ? 'Withhold Results from Students'
                  : 'Approve and release results'}
              </button>
            </div>
          )}

          {/* ── KPI Summary Cards ── */}
          <div className="results-kpi-grid ink-cycle ink-stats">
            {kpis.map((k) => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="results-kpi">
                  <div className="results-kpi-icon" style={{ background: `${k.color}18`, color: k.color }}>
                    <Icon size={22} />
                  </div>
                  <div>
                    <div className="results-kpi-label">{k.label}</div>
                    <div className="results-kpi-value">{k.value}</div>
                    <div className="results-kpi-sub">{k.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {summary.submitted === 0 ? (
            <div className="results-empty">
              <AlertTriangle size={38} color="#8f5c0e" />
              <h3>No candidate submissions yet</h3>
              <p>
                This test has <strong>{summary.assigned} assigned candidate{summary.assigned !== 1 ? 's' : ''}</strong>, but no submissions have been recorded yet.
              </p>
              <p className="results-muted results-small">
                Candidate results and scores will populate here in real-time as students submit their exam attempts.
              </p>
            </div>
          ) : (
            <>
              {/* Score Distribution Chart */}
              <div className="results-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h2 style={{ margin: 0 }}>Score Distribution (% Bracket)</h2>
                  <span className="results-muted results-small">
                    {results.length} candidate{results.length !== 1 ? 's' : ''} graded
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={distribution} margin={{ top: 8, right: 16, left: -16, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="range" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[5, 5, 0, 0]}>
                      {distribution.map((d, i) => (
                        <Cell key={d.range} fill={i < 4 ? '#b3352b' : i < 7 ? '#8f5c0e' : '#2f6b3a'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* View Tabs */}
              <div className="results-tabs">
                <button
                  type="button"
                  className={tab === 'students' ? 'active' : ''}
                  onClick={() => setTab('students')}
                >
                  All Candidates ({results.length})
                </button>
                <button
                  type="button"
                  className={tab === 'questions' ? 'active' : ''}
                  onClick={() => setTab('questions')}
                >
                  Question Difficulty & Accuracy ({questionStats.length})
                </button>
              </div>

              {/* ── Tab 1: All Candidates Scoreboard ── */}
              {tab === 'students' ? (
                <div className="results-card results-table-wrap">
                  {/* Candidate Search & Filter Toolbar */}
                  <div className="results-filter-bar">
                    <div className="results-search-box">
                      <Search size={16} className="results-search-icon" />
                      <input
                        type="text"
                        placeholder="Search candidate by name or email…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="results-search-input"
                      />
                    </div>

                    <div className="results-tier-buttons">
                      <button
                        type="button"
                        className={`results-tier-btn ${tierFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setTierFilter('ALL')}
                      >
                        All ({results.length})
                      </button>
                      <button
                        type="button"
                        className={`results-tier-btn ${tierFilter === 'TOP' ? 'active' : ''}`}
                        onClick={() => setTierFilter('TOP')}
                      >
                        High (≥75%)
                      </button>
                      <button
                        type="button"
                        className={`results-tier-btn ${tierFilter === 'MID' ? 'active' : ''}`}
                        onClick={() => setTierFilter('MID')}
                      >
                        Average (40-74%)
                      </button>
                      <button
                        type="button"
                        className={`results-tier-btn ${tierFilter === 'LOW' ? 'active' : ''}`}
                        onClick={() => setTierFilter('LOW')}
                      >
                        Low (&lt;40%)
                      </button>
                    </div>
                  </div>

                  {filteredResults.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-secondary)' }}>
                      No candidates match the specified filter or search query.
                    </div>
                  ) : (
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th style={{ width: 80 }}>Rank</th>
                          <th>Candidate</th>
                          <th>Total score</th>
                          <th>Percentage</th>
                          <th>Submitted at</th>
                          <th>Submission type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredResults.map((r) => {
                          const initials = (r.users?.full_name || 'Student')
                            .split(' ')
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase();

                          return (
                            <tr key={r.id}>
                              <td className="results-rank-col">
                                {getRankBadge(r.rank)}
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <div className="results-candidate-avatar">
                                    {initials}
                                  </div>
                                  <div>
                                    <div className="results-name">{r.users?.full_name || 'Candidate'}</div>
                                    <div className="results-muted results-small">{r.users?.email || '—'}</div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <strong style={{ fontSize: '1.05rem', color: '#1b1a17' }}>{r.total_score}</strong>
                                <span className="results-muted" style={{ fontSize: '0.82rem' }}> / {summary.maxMarks}</span>
                              </td>
                              <td>
                                <span className={`results-pill ${r.percentage >= 75 ? 'good' : r.percentage >= 40 ? 'mid' : 'bad'}`}>
                                  {r.percentage}%
                                </span>
                              </td>
                              <td className="results-muted results-small">
                                {r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}
                              </td>
                              <td>
                                {r.auto_submitted ? (
                                  <span className="results-flag" title="Submitted automatically when timer expired">
                                    <Clock size={13} /> Auto-timed
                                  </span>
                                ) : (
                                  <span className="results-flag-manual" title="Submitted manually by candidate">
                                    <CheckCircle2 size={13} color="#2f6b3a" /> Manual
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                /* ── Tab 2: Question Difficulty & Accuracy ── */
                <div className="results-card results-table-wrap">
                  <p className="results-muted results-small results-hint">
                    Questions sorted by difficulty (lowest accuracy first) to highlight concept weaknesses across candidates.
                  </p>
                  <table className="results-table">
                    <thead>
                      <tr>
                        <th style={{ minWidth: 260 }}>Question text</th>
                        <th>Subject</th>
                        <th>Topic</th>
                        <th style={{ textAlign: 'center' }}>Correct</th>
                        <th style={{ textAlign: 'center' }}>Incorrect</th>
                        <th style={{ textAlign: 'center' }}>Skipped</th>
                        <th>Accuracy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {questionStats.map((q, idx) => (
                        <tr key={q.questionId || idx}>
                          <td className="results-qtext">
                            <MathText text={q.questionText || '(Question content)'} />
                          </td>
                          <td>
                            <span className="results-sub-badge">{q.subject}</span>
                          </td>
                          <td className="results-muted">{q.topic || '—'}</td>
                          <td className="results-ok" style={{ textAlign: 'center' }}>{q.correct}</td>
                          <td className="results-bad" style={{ textAlign: 'center' }}>{q.incorrect}</td>
                          <td className="results-muted" style={{ textAlign: 'center' }}>{q.unattempted}</td>
                          <td>
                            <span className={`results-pill ${q.accuracy >= 75 ? 'good' : q.accuracy >= 40 ? 'mid' : 'bad'}`}>
                              {q.accuracy}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default TestResults;
