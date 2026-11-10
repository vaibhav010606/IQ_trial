import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient, captureTokenFromUrl, getRefreshToken, getToken, getPortalUrl } from '../api/client';
import { normalisePaper, subjectsInPaper } from '../lib/questionFormat';
import { getPattern, patternIdOf, markingRows } from '../lib/examPatterns';
import '../index.css';

const PORTAL_URL = getPortalUrl();

/**
 * Offline demo papers. These two ids are not real tests — they exist so the
 * proctoring UI can be demonstrated without a live assessment.
 */
const previewConfigs = {
  'jee-main-preview': {
    title: 'JEE Main 2026 — Mock Test',
    duration: '3 Hours (180 minutes)',
    totalQuestions: 75,
    totalMarks: 300,
    sections: [
      { name: 'Section A (MCQ)', count: '20 per subject', marking: '+4 correct, −1 incorrect' },
      { name: 'Section B (Numerical)', count: '5 per subject', marking: '+4 correct, −1 incorrect (2026 pattern)' },
    ],
    subjects: 'Physics, Chemistry, Mathematics',
  },
  'jee-adv-preview': {
    title: 'JEE Advanced 2026 — Paper 1 Mock Test',
    duration: '3 Hours (180 minutes)',
    totalQuestions: 51,
    totalMarks: '~180 (varies by question type)',
    sections: [
      { name: 'MCQ (Single Correct)', count: '6 per subject', marking: '+3 correct, −1 incorrect' },
      { name: 'MSQ (Multiple Correct)', count: '6 per subject', marking: '+4 full, partial marks available' },
      { name: 'NAT (Numerical)', count: '5 per subject', marking: '+4 correct, no negative' },
    ],
    subjects: 'Physics, Chemistry, Mathematics',
  },
};

const TYPE_LABELS = {
  mcq: 'Objective — Single Correct',
  msq: 'Objective — Multiple Correct',
  nat: 'Numerical Answer',
};

/**
 * Turns the real test + its paper into the same shape the preview configs use,
 * so the instructions page describes the test the admin actually created.
 */
function buildConfig(test, paper) {
  // An official paper explains its real, section-by-section marking scheme —
  // the one the server grades by.
  const pattern = getPattern(patternIdOf(test));
  if (pattern) {
    const subjects = subjectsInPaper(paper);
    return {
      title: test.title || pattern.label,
      description: `${pattern.label} · official pattern (${pattern.edition}, ${pattern.authority})`,
      duration: `${test.duration_minutes || pattern.durationMinutes} minutes`,
      totalQuestions: paper.length,
      totalMarks: test.total_marks ?? '—',
      sections: markingRows(pattern),
      subjects: subjects.length ? subjects.join(', ') : Object.keys(pattern.subjects).join(', '),
    };
  }

  const negative = test.negative_marking
    ? `−${Number(test.negative_marks) || 0} per wrong answer`
    : 'no negative marking';

  // One row per question type actually present in the paper.
  const byType = new Map();
  for (const q of paper) {
    const entry = byType.get(q.type) || { count: 0, marks: new Set() };
    entry.count += 1;
    entry.marks.add(Number(q.marks) || 4);
    byType.set(q.type, entry);
  }

  const sections = [...byType.entries()].map(([type, entry]) => ({
    name: TYPE_LABELS[type] || type.toUpperCase(),
    count: `${entry.count} question${entry.count === 1 ? '' : 's'}`,
    marking: `+${[...entry.marks].sort((a, b) => a - b).join(' / ')} correct, ${negative}`,
  }));

  const subjects = subjectsInPaper(paper);

  return {
    title: test.title || 'Secure Assessment',
    description: test.description || '',
    duration: `${test.duration_minutes} minutes`,
    totalQuestions: paper.length,
    totalMarks: test.total_marks ?? '—',
    sections: sections.length ? sections : [{ name: 'Questions', count: '—', marking: negative }],
    subjects: subjects.length ? subjects.join(', ') : '—',
  };
}

const ExamLauncher = () => {
  const { testId } = useParams();
  const isPreview = Boolean(previewConfigs[testId]);

  const [config, setConfig] = useState(previewConfigs[testId] || null);
  const [loading, setLoading] = useState(!isPreview);
  const [error, setError] = useState('');
  /** Set when this test is already submitted: each test can be taken once. */
  const [doneAttemptId, setDoneAttemptId] = useState(null);

  useEffect(() => {
    captureTokenFromUrl();
  }, []);

  useEffect(() => {
    if (isPreview) return;

    let cancelled = false;
    (async () => {
      // captureTokenFromUrl has already run in the effect above.
      if (!getToken()) {
        if (!cancelled) {
          setError('No active session. Please launch this test from your dashboard.');
          setLoading(false);
        }
        return;
      }

      try {
        // Each test can be taken once. Check that first — before loading the
        // paper — and say so plainly, rather than bouncing the student back to
        // the dashboard with no explanation. (The server refuses a second
        // attempt regardless; this is so the student understands why.)
        const myAttempts = await apiClient.get('/attempts/my').catch(() => []);
        if (cancelled) return;
        const alreadySubmitted = (myAttempts || []).find(
          (a) => (a.test_id === testId || a.tests?.id === testId || (Array.isArray(a.tests) && a.tests[0]?.id === testId)) && a.status === 'submitted'
        );
        if (alreadySubmitted) {
          setDoneAttemptId(alreadySubmitted.id);
          return;
        }

        const [test, rawPaper] = await Promise.all([
          apiClient.get(`/tests/${testId}`),
          apiClient.get(`/tests/${testId}/questions`),
        ]);
        if (cancelled) return;

        setConfig(buildConfig(test, normalisePaper(rawPaper)));
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load this test.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [testId, isPreview]);

  const handleStartExam = () => {
    const token = getToken();
    const refresh = getRefreshToken();
    const fragment = new URLSearchParams();
    if (token) fragment.set('token', token);
    if (refresh) fragment.set('refresh', refresh);
    const query = fragment.toString();
    const url = `/exam/session/${testId}${query ? `#${query}` : ''}`;
    // Replace in current window so no duplicate/orphaned instructions tab remains behind
    window.location.replace(url);
  };

  const handleCancel = () => {
    try {
      window.close();
    } catch {}
    window.location.assign(PORTAL_URL);
  };

  if (loading) {
    return (
      <div className="exam-launcher-container">
        <div className="launcher-card"><p>Loading test details…</p></div>
      </div>
    );
  }

  const isAlreadyDone = Boolean(doneAttemptId) || /already submitted|already completed|taken only once/i.test(error);

  if (isAlreadyDone) {
    const resultUrl = doneAttemptId ? `${PORTAL_URL.replace(/\/$/, '')}/result/${doneAttemptId}` : PORTAL_URL;
    return (
      <div className="exam-launcher-container">
        <div className="launcher-card">
          <div style={{ width: 56, height: 56, background: '#ecfdf5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <span style={{ display: 'inline-block', padding: '4px 12px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#065f46', background: '#d1fae5', borderRadius: 9999, marginBottom: 12 }}>
            Attempt Noted & Recorded
          </span>
          <h2>Your attempt has been noted</h2>
          <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: 20 }}>
            You have already submitted this examination. Each test can be attempted only once — second chances or retakes are strictly prohibited.
          </p>
          <div className="launcher-actions">
            <button className="btn-cancel" onClick={handleCancel}>Back to dashboard</button>
            {doneAttemptId && (
              <button className="btn-start" onClick={() => window.location.assign(resultUrl)}>View result</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="exam-launcher-container">
        <div className="launcher-card">
          <h2>Cannot open this test</h2>
          <p>{error || 'Test not found.'}</p>
          <div className="launcher-actions">
            <button className="btn-cancel" onClick={handleCancel}>Back to Dashboard</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-launcher-container">
      <div className="launcher-card">
        <h2>{config.title}</h2>
        <div className="instructions-content">
          {config.description && <p>{config.description}</p>}
          <p><strong>Duration:</strong> {config.duration}</p>
          <p><strong>Total Questions:</strong> {config.totalQuestions}</p>
          <p><strong>Total Marks:</strong> {config.totalMarks}</p>
          <p><strong>Subjects:</strong> {config.subjects}</p>
          <hr />
          <h3>Marking scheme</h3>
          <table className="marking-table">
            <thead>
              <tr><th>Section</th><th>Questions</th><th>Marking</th></tr>
            </thead>
            <tbody>
              {config.sections.map((s, i) => (
                <tr key={i}><td>{s.name}</td><td>{s.count}</td><td>{s.marking}</td></tr>
              ))}
            </tbody>
          </table>
          <hr />
          <h3>Rules of the Exam</h3>
          <ul>
            <li>Do not switch tabs. This session is monitored.</li>
            <li>Do not exit fullscreen mode.</li>
            <li>Copy, paste, and right-click are disabled.</li>
            <li>If you violate these rules 3 times, your exam will be automatically terminated.</li>
          </ul>
          <p className="consent-text">By clicking below, you agree to these terms.</p>
        </div>
        <div className="launcher-actions">
          <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
          <button className="btn-start" onClick={handleStartExam}>I agree, begin test</button>
        </div>
      </div>
    </div>
  );
};

export default ExamLauncher;
