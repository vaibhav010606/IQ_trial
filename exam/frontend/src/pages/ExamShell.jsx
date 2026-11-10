import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { apiClient, captureTokenFromUrl, getToken, getPortalUrl } from '../api/client';
import ViolationMonitor from '../components/ViolationMonitor';
import ExamHeader from '../components/ExamHeader';
import QuestionPanel from '../components/QuestionPanel';
import QuestionPalette from '../components/QuestionPalette';
import ActionBar from '../components/ActionBar';
import SubmitConfirmModal from '../components/SubmitConfirmModal';
import { jeeMainMockQuestions, jeeAdvMockQuestions } from '../data/jeeMockData';
import { normalisePaper, subjectsInPaper, sectionsInSubject } from '../lib/questionFormat';
import '../index.css';

const ExamShell = () => {
  const { sessionId } = useParams();

  const [loading, setLoading] = useState(true);
  const [examData, setExamData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [responses, setResponses] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [violationWarning, setViolationWarning] = useState(null);
  const [isTerminated, setIsTerminated] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [fatalError, setFatalError] = useState('');

  const heartbeatRef = useRef(null);
  const submittingRef = useRef(false);
  const submittedRef = useRef(false);
  const deadlineRef = useRef(null);
  const autoSubmitRetryRef = useRef(null);
  const autoSubmitAttemptsRef = useRef(0);
  const questionEnteredAt = useRef(Date.now());
  const questionTimeSpentRef = useRef({});
  const [lockAcquired, setLockAcquired] = useState(false);
  // Tabs are built from the paper the teacher actually assembled, not from a
  // fixed Physics/Chemistry/Mathematics list — a single-subject or Biology test
  // used to render an empty palette because nothing matched the default tab.
  const [activeSubject, setActiveSubject] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [redirectCount, setRedirectCount] = useState(15);

  const PORTAL_URL = getPortalUrl();

  const handleReturnToDashboard = () => {
    try {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {}
    try {
      window.close();
    } catch {}
    window.location.assign(PORTAL_URL);
  };

  useEffect(() => {
    if (!isSubmitted) return;
    const timer = setInterval(() => {
      setRedirectCount((c) => {
        if (c <= 1) {
          clearInterval(timer);
          handleReturnToDashboard();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isSubmitted]);

  // Lift the access token out of the URL fragment before anything else runs.
  useEffect(() => {
    captureTokenFromUrl();
  }, []);

  useEffect(() => {
    // For local mock preview, skip lock to allow easier testing
    if (sessionId === 'jee-main-preview' || sessionId === 'jee-adv-preview') {
      setLockAcquired(true);
      return;
    }
    const lockKey = `examLock:${sessionId}`;
    const activeLock = localStorage.getItem(lockKey);
    const now = Date.now();
    
    // TEMPORARILY DISABLED FOR DEVELOPMENT
    // if (activeLock && now - parseInt(activeLock) < 5000) {
    //   alert("This exam is already running in another tab.");
    //   window.close();
    //   return;
    // }
    
    localStorage.setItem(lockKey, now.toString());
    setLockAcquired(true);

    const lockInterval = setInterval(() => localStorage.setItem(lockKey, Date.now().toString()), 2000);
    return () => { clearInterval(lockInterval); localStorage.removeItem(lockKey); };
  }, [sessionId]);

  const handleStartExam = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen request failed. Proceeding anyway.");
    }
    
    setHasStarted(true);

    try {
      // Offline demo papers, for showing the proctoring UI without a real test.
      if (sessionId === 'jee-main-preview' || sessionId === 'jee-adv-preview') {
        const isMain = sessionId === 'jee-main-preview';
        setExamData({
          realSessionId: isMain ? 'mock-session-main' : 'mock-session-adv',
          title: `JEE ${isMain ? 'Main' : 'Advanced'} Mock Test (Preview)`,
          duration_minutes: 180,
          total_questions: isMain ? 75 : 51,
          examType: isMain ? 'main' : 'advanced',
          isPreview: true,
        });
        const mockPaper = isMain ? jeeMainMockQuestions : jeeAdvMockQuestions;
        setQuestions(mockPaper);
        setActiveSubject(mockPaper[0]?.subject ?? null);
        setActiveSection(mockPaper[0]?.section ?? null);
        const previewSeconds = 180 * 60;
        deadlineRef.current = Date.now() + previewSeconds * 1000;
        setTimeLeft(previewSeconds);
        setLoading(false);
        return;
      }

      // Real exam. The token arrives in the URL fragment from the portal.
      if (!getToken()) {
        setFatalError('No active session. Please launch this exam from your dashboard.');
        setLoading(false);
        return;
      }

      // Call the real attempt start endpoint
      const startRes = await apiClient.post(`/attempts/start/${sessionId}`);
      const realSessionId = startRes.attemptId;

      // Fetch test details for UI
      const testDetails = await apiClient.get(`/tests/${sessionId}`);

      setExamData({
        ...testDetails,
        realSessionId,
        examType: testDetails.t_type || 'main',
        isPreview: false,
      });

      // Fetch questions using the testId. The bank speaks `q_type`
      // (single_correct / multi_correct / integer) while the UI renders on
      // `type` (mcq / msq / nat) — normalisePaper bridges the two, and without
      // it the answer options never rendered at all.
      const rawPaper = await apiClient.get(`/tests/${sessionId}/questions`);
      const paper = normalisePaper(rawPaper);

      if (!paper.length) {
        setFatalError('This test has no questions yet. Please contact your teacher.');
        setLoading(false);
        return;
      }

      setQuestions(paper);
      setActiveSubject(paper[0].subject);
      setActiveSection(paper[0].section);

      // Rehydrate a resumed session.
      if (startRes.savedAnswers?.length) {
        const indexByQuestionId = new Map(paper.map((q, idx) => [q.id, idx]));
        const restored = {};
        const restoredTime = {};
        for (const saved of startRes.savedAnswers) {
          const idx = indexByQuestionId.get(saved.question_id);
          if (idx !== undefined) {
            restored[idx] = { ...(saved.selected_answer || {}), status: saved.status || 'answered' };
          }
          restoredTime[saved.question_id] = Math.max(0, Number(saved.time_spent_seconds) || 0);
        }
        setResponses(restored);
        questionTimeSpentRef.current = restoredTime;
      }

      // Removed server heartbeat for now, rely on visual timer.
      if (startRes.timeLeftSeconds !== undefined) {
        const remainingSeconds = Math.max(0, Number(startRes.timeLeftSeconds) || 0);
        deadlineRef.current = Date.now() + remainingSeconds * 1000;
        setTimeLeft(Math.ceil(remainingSeconds));
      }
    } catch (err) {
      setFatalError(err.message || 'Error initializing exam');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      clearInterval(heartbeatRef.current);
      clearTimeout(autoSubmitRetryRef.current);
    };
  }, []);

  // Bank each visit so later answer saves include time from earlier visits.
  useEffect(() => {
    const questionId = questions[currentQ]?.id;
    questionEnteredAt.current = Date.now();
    return () => {
      if (questionId == null) return;
      const elapsed = Math.max(0, Math.round((Date.now() - questionEnteredAt.current) / 1000));
      questionTimeSpentRef.current[questionId] =
        (questionTimeSpentRef.current[questionId] || 0) + elapsed;
    };
  }, [currentQ, questions]);

  useEffect(() => {
    if (!hasStarted || loading || deadlineRef.current === null) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    tick();
    const visualTimer = setInterval(tick, 1000);
    return () => clearInterval(visualTimer);
  }, [hasStarted, loading]);

  // Bug #10 fix: auto-submit when timer reaches 0
  useEffect(() => {
    if (timeLeft === 0 && hasStarted && !loading && !isSubmitted && !isTerminated && !fatalError) {
      handleFinalSubmit(true);
    }
  }, [timeLeft, hasStarted, loading, isSubmitted, isTerminated, fatalError]);

  const handleResponseChange = async (questionId, responsePayload, status) => {
    // Bug #3 fix: when payload is null (clear), don't spread old keys
    setResponses(prev => ({
      ...prev,
      [currentQ]: responsePayload ? { ...responsePayload, status } : { status }
    }));
    if (examData?.isPreview) return; // Nothing to persist for a demo paper.
    if (!examData?.realSessionId) return;

    const elapsed = Math.max(0, Math.round((Date.now() - questionEnteredAt.current) / 1000));
    questionEnteredAt.current = Date.now();
    const totalSeconds = (questionTimeSpentRef.current[questionId] || 0) + elapsed;
    questionTimeSpentRef.current[questionId] = totalSeconds;

    try {
      await apiClient.patch(`/attempts/${examData.realSessionId}/answer`, {
        question_id: questionId,
        selected_answer: responsePayload,
        status: status,
        time_spent_seconds: totalSeconds,
      });
      setSaveError('');
    } catch (e) {
      console.error('Failed to save response', e);
      // A failed save used to be swallowed into the console: the student kept
      // answering a paper the server was no longer recording.
      setSaveError(
        e.status === 401
          ? 'Your session expired — this answer was NOT saved. Relaunch the test from your dashboard.'
          : 'This answer could not be saved. Check your connection and re-select it.',
      );
    }
  };

  const handleFinalSubmit = async (auto = false) => {
    if (submittedRef.current || submittingRef.current) return;
    submittingRef.current = true;
    if (auto && timeLeft === 0) autoSubmitAttemptsRef.current += 1;
    clearInterval(heartbeatRef.current);

    if (examData?.isPreview) {
      submittedRef.current = true;
      clearTimeout(autoSubmitRetryRef.current);
      autoSubmitRetryRef.current = null;
      setIsSubmitted(true);
      return;
    }

    try {
      const summary = await apiClient.post(
        `/attempts/${examData.realSessionId}/submit`,
        { autoSubmitted: auto },
      );
      submittedRef.current = true;
      clearTimeout(autoSubmitRetryRef.current);
      autoSubmitRetryRef.current = null;
      setResult(summary);
      setIsSubmitted(true);
    } catch (e) {
      submittingRef.current = false;
      if (auto && timeLeft === 0 && autoSubmitAttemptsRef.current < 5) {
        clearTimeout(autoSubmitRetryRef.current);
        autoSubmitRetryRef.current = setTimeout(() => {
          autoSubmitRetryRef.current = null;
          if (
            !submittedRef.current
            && deadlineRef.current !== null
            && Date.now() >= deadlineRef.current
          ) {
            handleFinalSubmit(true);
          }
        }, 15000);
      }
      setSaveError('Error submitting exam: ' + (e?.message || 'Server error') + '. Please try submitting again.');
    }
  };

  const handleViolationLimit = () => {
    handleFinalSubmit(true).finally(() => setIsTerminated(true));
  };

  // Navigation structure comes from the paper, so it matches whatever the
  // teacher assembled — one subject, four subjects, MCQ-only, mixed, anything.
  const subjects = useMemo(() => subjectsInPaper(questions), [questions]);
  const sections = useMemo(
    () => sectionsInSubject(questions, activeSubject),
    [questions, activeSubject],
  );

  // Consecutive sequential numbering within the active section/subject
  const sectionQIndex = useMemo(() => {
    const cur = questions[currentQ];
    if (!cur) return currentQ;
    const sameSectionQs = questions.filter(
      q => (!activeSubject || q.subject === cur.subject) && (!activeSection || q.section === cur.section)
    );
    const idx = sameSectionQs.findIndex(q => q.id === cur.id);
    return idx !== -1 ? idx : currentQ;
  }, [questions, currentQ, activeSubject, activeSection]);

  const handleNavigate = (idx) => {
    if (idx >= 0 && idx < questions.length) {
      setCurrentQ(idx);
      if (questions[idx]?.subject) setActiveSubject(questions[idx].subject);
      if (questions[idx]?.section) setActiveSection(questions[idx].section);
    }
  };

  if (!lockAcquired) return null;

  if (fatalError && /already submitted|already completed|taken only once/i.test(fatalError)) {
    return (
      <div className="exam-terminated exam-submitted-view">
        <div className="exam-submitted-card">
          <div className="exam-submitted-icon-wrap">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#2f6b3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="exam-pending-pill" style={{ marginBottom: 12 }}>
            <span className="exam-pending-dot"></span>
            Attempt Noted & Recorded
          </div>
          <h2>Your attempt has been noted</h2>
          <p className="exam-submitted-message">
            You have already submitted this exam. Each test can be taken only once, and second chances to start or retake this exam are not permitted.
          </p>
          <div className="exam-meta-grid" style={{ marginTop: 16, marginBottom: 20 }}>
            <div className="exam-meta-row">
              <span className="meta-k">Submission Status</span>
              <span className="meta-v meta-v-success">Recorded & Finalised</span>
            </div>
            <div className="exam-meta-row">
              <span className="meta-k">Policy</span>
              <span className="meta-v">Single Attempt Only</span>
            </div>
          </div>
          <button className="btn-close-exam" onClick={handleReturnToDashboard}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (fatalError) {
    return (
      <div className="exam-terminated error">
        <h2>Cannot start this exam</h2>
        <p>{fatalError}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
          <button onClick={handleReturnToDashboard}>Return to Dashboard</button>
          <button onClick={() => window.close()}>Close tab</button>
        </div>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div className="exam-terminated">
        <h2>Ready to Begin?</h2>
        <p>The exam will open in full screen. Do not exit fullscreen or switch tabs during the test.</p>
        <button onClick={handleStartExam}>Enter fullscreen & start exam</button>
      </div>
    );
  }
  if (loading) return <div className="exam-loading">Loading secure environment...</div>;
  // A terminated attempt is final too: it was graded on the spot and cannot be restarted.
  if (isTerminated) return <div className="exam-terminated error"><h2>Exam terminated</h2><p>You exceeded the limit of rule violations. Your attempt has been noted and submitted with the answers saved so far. Each test can be taken only once, so it cannot be restarted.</p><button onClick={handleReturnToDashboard}>Return to Dashboard</button></div>;
  if (isSubmitted) {
    const isApproved = result?.results_published === true && result?.score !== undefined;
    return (
      <div className="exam-terminated exam-submitted-view">
        <div className="exam-submitted-card">
          <div className="exam-submitted-icon-wrap">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#2f6b3a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2>Your attempt has been noted</h2>
          <p className="exam-submitted-message">
            Your responses have been securely recorded and verified. Each test can be taken only once — no second chance or retake is permitted.
          </p>

          {isApproved ? (
            <div className="exam-result-summary">
              <p className="exam-result-score">
                <strong>{result.score}</strong> / {result.maxScore}
              </p>
              <p>
                {result.correct} correct · {result.incorrect} incorrect · {result.unattempted} unattempted
              </p>
              <p>Accuracy: {result.accuracy}%</p>
              {result.autoSubmitted && <p className="exam-result-note">Submitted automatically — time expired.</p>}
            </div>
          ) : (
            <div className="exam-pending-box">
              <div className="exam-pending-pill">
                <span className="exam-pending-dot"></span>
                Results pending administrator approval
              </div>
              <p className="exam-pending-desc">
                Scores and question solutions are withheld until reviewed and officially approved by the examination administrator.
              </p>
              <div className="exam-meta-grid">
                <div className="exam-meta-row">
                  <span className="meta-k">Paper</span>
                  <span className="meta-v">{examData?.title || 'JEE Test'}</span>
                </div>
                <div className="exam-meta-row">
                  <span className="meta-k">Submission status</span>
                  <span className="meta-v meta-v-success">Attempt Noted & Recorded</span>
                </div>
                <div className="exam-meta-row">
                  <span className="meta-k">Mode</span>
                  <span className="meta-v">{result?.autoSubmitted ? 'Auto-submitted (Time limit reached)' : 'Normal Submission'}</span>
                </div>
                <div className="exam-meta-row">
                  <span className="meta-k">Results</span>
                  <span className="meta-v meta-v-amber">Awaiting admin release</span>
                </div>
              </div>
              <p className="exam-pending-portal-hint">
                Once the administrator approves the results, your detailed scorecard, percentile, and solutions will be available in the <strong>Student portal</strong>.
              </p>
            </div>
          )}

          <button className="btn-close-exam" onClick={handleReturnToDashboard}>
            Go to Student Home Screen ({redirectCount}s)
          </button>
          <span className="exam-close-sub">
            Redirecting automatically in {redirectCount}s…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="exam-shell">
      <ViolationMonitor 
        sessionId={examData.realSessionId} 
        onViolationLimitReached={handleViolationLimit}
        onViolationWarning={setViolationWarning}
      />
      {violationWarning && (
        <div className="violation-overlay">
          <div className="violation-modal">
            <h3>Warning: Rule Violation</h3>
            <p>We detected: {violationWarning}. Please remain in fullscreen and do not switch tabs.</p>
            <button onClick={() => {
              setViolationWarning(null);
              document.documentElement.requestFullscreen().catch(() => {});
            }}>Resume exam</button>
          </div>
        </div>
      )}
      <ExamHeader examData={examData} timeLeft={timeLeft} />

      {saveError && <div className="exam-save-error">{saveError}</div>}

      {/* Subject tabs, built from the paper itself, with Submit Exam button on the right */}
      <div className="subject-tabs">
        <div className="subj-tabs-group">
          {subjects.map(subj => (
            <button
              key={subj}
              className={`subj-tab ${activeSubject === subj ? 'active' : ''}`}
              onClick={() => {
                const firstQIdx = questions.findIndex(q => q.subject === subj);
                setActiveSubject(subj);
                if (firstQIdx !== -1) {
                  setCurrentQ(firstQIdx);
                  setActiveSection(questions[firstQIdx].section);
                }
              }}
            >
              {subj}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn-action submit-final btn-top-submit"
          onClick={() => setShowSubmitModal(true)}
          title="Submit your exam"
        >
          Submit exam
        </button>
      </div>

      {/* Section tabs only when this subject actually has more than one. */}
      {sections.length > 1 && (
        <div className="section-tabs">
          {sections.map(sec => (
            <button
              key={sec}
              className={`sec-tab ${activeSection === sec ? 'active' : ''}`}
              onClick={() => {
                setActiveSection(sec);
                const firstQIdx = questions.findIndex(q => q.subject === activeSubject && q.section === sec);
                if (firstQIdx !== -1) setCurrentQ(firstQIdx);
              }}
            >
              {sec}
            </button>
          ))}
        </div>
      )}

      <div className="exam-body">
        <div className="exam-main-panel">
          <QuestionPanel 
            question={questions[currentQ]} 
            qIndex={sectionQIndex}
            currentResponse={responses[currentQ]}
            onResponseChange={handleResponseChange}
          />
          <ActionBar 
            currentQ={currentQ} totalQ={questions.length} onNavigate={handleNavigate}
            currentResponse={responses[currentQ]} questionId={questions[currentQ]?.id}
            onResponseChange={handleResponseChange} onSubmitClick={() => setShowSubmitModal(true)}
          />
        </div>
        <QuestionPalette
          questions={questions}
          responses={responses}
          currentQ={currentQ}
          activeSubject={subjects.length > 1 ? activeSubject : null}
          activeSection={sections.length > 1 ? activeSection : null}
          onNavigate={handleNavigate}
        />
      </div>
      {showSubmitModal && <SubmitConfirmModal responses={responses} total={questions.length} onCancel={() => setShowSubmitModal(false)} onConfirm={() => handleFinalSubmit(false)} />}
    </div>
  );
};

export default ExamShell;
