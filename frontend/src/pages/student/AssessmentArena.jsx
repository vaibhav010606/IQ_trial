import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Flag, ChevronLeft, ChevronRight, AlertTriangle, Clock, CheckCircle, RotateCcw } from 'lucide-react';
import { apiClient } from '../../api/client';
import MathText from '../../components/MathText';
import './AssessmentArena.css';

/**
 * Live exam.
 *
 * Answer state is keyed by question id, not by position — that is what makes a
 * resumed attempt restorable, and it survives any future reordering. Time per
 * question is measured for real (it used to be a hardcoded 15 seconds).
 *
 * The countdown comes from the server's `expiresAt`; the client clock is only
 * used to tick it down. The backend rejects writes past the deadline and grades
 * abandoned attempts on its own, so nothing here is load-bearing for integrity.
 */
const AssessmentArena = () => {
  const navigate = useNavigate();
  const { testId } = useParams();

  const [test, setTest] = useState(null);
  const [testQuestions, setTestQuestions] = useState([]);
  const [attemptId, setAttemptId] = useState(null);

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});   // questionId -> { index } | { value }
  const [flagged, setFlagged] = useState(new Set()); // questionIds
  const [timeSpent, setTimeSpent] = useState({});    // questionId -> accumulated seconds
  const [timeLeft, setTimeLeft] = useState(null);

  const [loading, setLoading] = useState(true);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [submittedAttemptId, setSubmittedAttemptId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showAutoSubmit, setShowAutoSubmit] = useState(false);
  const [saveError, setSaveError] = useState('');

  const timerRef = useRef(null);
  const questionEnteredAt = useRef(Date.now());
  const submittedRef = useRef(false);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const initTest = async () => {
      try {
        setLoading(true);

        const testRes = await apiClient.get(`/tests/${testId}`);
        if (cancelled) return;
        setTest(testRes);

        const startRes = await apiClient.post(`/attempts/start/${testId}`);
        if (cancelled) return;
        setAttemptId(startRes.attemptId);

        // Rehydrate a resumed attempt. Without this, reopening a test showed a
        // blank paper even though the answers were safely in the database.
        if (startRes.savedAnswers?.length) {
          const restoredAnswers = {};
          const restoredFlags = new Set();
          const restoredTime = {};

          for (const saved of startRes.savedAnswers) {
            if (saved.selected_answer != null) {
              restoredAnswers[saved.question_id] = saved.selected_answer;
            }
            if (saved.flagged_for_doubt) restoredFlags.add(saved.question_id);
            if (saved.time_spent_seconds) restoredTime[saved.question_id] = saved.time_spent_seconds;
          }

          setAnswers(restoredAnswers);
          setFlagged(restoredFlags);
          setTimeSpent(restoredTime);
        }

        const endTime = new Date(startRes.expiresAt).getTime();
        const tick = () => {
          const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
          setTimeLeft(remaining);
          if (remaining <= 0) {
            clearInterval(timerRef.current);
            setShowAutoSubmit(true);
          }
        };
        tick();
        timerRef.current = setInterval(tick, 1000);

        const qRes = await apiClient.get(`/tests/${testId}/questions`);
        if (cancelled) return;
        setTestQuestions(qRes || []);
        questionEnteredAt.current = Date.now();
      } catch (err) {
        if (cancelled) return;
        const errMsg = err?.message || '';
        if (/already submitted|already completed|taken only once/i.test(errMsg)) {
          try {
            const myAttempts = await apiClient.get('/attempts/my');
            const found = (myAttempts || []).find(
              (a) => (a.test_id === testId || a.tests?.id === testId) && a.status === 'submitted'
            );
            if (found && !cancelled) setSubmittedAttemptId(found.id);
          } catch {}
          if (!cancelled) setAlreadySubmitted(true);
          return;
        }
        alert(errMsg || 'Error starting test');
        navigate('/student');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initTest();

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
    };
  }, [testId, navigate]);

  const currentQuestion = testQuestions[currentQ]?.questions;
  const currentQuestionId = currentQuestion?.id;

  /** Seconds spent on the current question since it was opened. */
  const consumeElapsed = useCallback(() => {
    const elapsed = Math.round((Date.now() - questionEnteredAt.current) / 1000);
    questionEnteredAt.current = Date.now();
    return Math.max(0, elapsed);
  }, []);

  /** Persists one answer, carrying the real accumulated time for that question. */
  const persistAnswer = useCallback(
    async (questionId, selectedAnswer, extraSeconds) => {
      if (!attemptId || !questionId) return;

      const total = (timeSpent[questionId] || 0) + (extraSeconds || 0);
      try {
        await apiClient.patch(`/attempts/${attemptId}/answer`, {
          question_id: questionId,
          selected_answer: selectedAnswer,
          time_spent_seconds: total,
        });
        setSaveError('');
      } catch (err) {
        // Past the deadline the server refuses writes — surface that clearly.
        setSaveError(err.message || 'Could not save your answer.');
      }
    },
    [attemptId, timeSpent],
  );

  const hasAnswer = useCallback((qid) => {
    const ans = answers[qid];
    if (ans === undefined || ans === null) return false;
    if (ans.index !== undefined && ans.index !== null) return true;
    if (Array.isArray(ans.indices) && ans.indices.length > 0) return true;
    if (ans.value !== undefined && ans.value !== null && String(ans.value).trim() !== '') return true;
    return false;
  }, [answers]);

  const handleClearResponse = async () => {
    if (!currentQuestionId) return;
    const elapsed = consumeElapsed();
    if (elapsed > 0) {
      setTimeSpent((prev) => ({
        ...prev,
        [currentQuestionId]: (prev[currentQuestionId] || 0) + elapsed,
      }));
    }
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[currentQuestionId];
      return next;
    });
    await persistAnswer(currentQuestionId, null, elapsed);
  };

  const updateNumericAnswer = async (val) => {
    if (!currentQuestionId) return;
    const trimmed = String(val).trim();
    const elapsed = consumeElapsed();
    if (elapsed > 0) {
      setTimeSpent((prev) => ({
        ...prev,
        [currentQuestionId]: (prev[currentQuestionId] || 0) + elapsed,
      }));
    }

    if (trimmed === '') {
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[currentQuestionId];
        return next;
      });
      await persistAnswer(currentQuestionId, null, elapsed);
    } else {
      const selected = { value: trimmed };
      setAnswers((prev) => ({ ...prev, [currentQuestionId]: selected }));
      await persistAnswer(currentQuestionId, selected, elapsed);
    }
  };

  const handleNumericInput = (val) => {
    if (val !== '' && !/^-?\d*\.?\d*$/.test(val)) return;
    updateNumericAnswer(val);
  };

  const handleKeypadPress = (key) => {
    const cur = String(answers[currentQuestionId]?.value ?? '');
    if (key === 'Clear') {
      return handleClearResponse();
    }
    if (key === '⌫' || key === 'Backspace') {
      const next = cur.slice(0, -1);
      return updateNumericAnswer(next);
    }
    if (key === '-') {
      const next = cur.startsWith('-') ? cur.slice(1) : '-' + cur;
      return updateNumericAnswer(next);
    }
    if (key === '.') {
      if (cur.includes('.')) return;
      return updateNumericAnswer(cur ? cur + '.' : '0.');
    }
    if (cur.length >= 15) return;
    updateNumericAnswer(cur + key);
  };

  // Bank the time spent whenever the student moves to a different question.
  const goToQuestion = useCallback(
    (index) => {
      if (index === currentQ) return;

      const elapsed = consumeElapsed();
      const leavingId = testQuestions[currentQ]?.questions?.id;

      if (leavingId && elapsed > 0) {
        setTimeSpent((prev) => ({ ...prev, [leavingId]: (prev[leavingId] || 0) + elapsed }));
        // Only re-save if the question actually has an answer to attach it to.
        if (hasAnswer(leavingId)) {
          persistAnswer(leavingId, answers[leavingId], elapsed);
        }
      }

      setCurrentQ(index);
    },
    [currentQ, testQuestions, answers, consumeElapsed, persistAnswer],
  );

  const handleAnswer = async (optIndex) => {
    if (!currentQuestionId) return;

    const selected = { index: optIndex };
    setAnswers((prev) => ({ ...prev, [currentQuestionId]: selected }));

    const elapsed = consumeElapsed();
    if (elapsed > 0) {
      setTimeSpent((prev) => ({
        ...prev,
        [currentQuestionId]: (prev[currentQuestionId] || 0) + elapsed,
      }));
    }
    await persistAnswer(currentQuestionId, selected, elapsed);
  };

  const toggleFlag = async () => {
    if (!currentQuestionId || !attemptId) return;

    const willFlag = !flagged.has(currentQuestionId);
    setFlagged((prev) => {
      const next = new Set(prev);
      if (willFlag) next.add(currentQuestionId);
      else next.delete(currentQuestionId);
      return next;
    });

    try {
      await apiClient.patch(`/attempts/${attemptId}/flag`, {
        question_id: currentQuestionId,
        flagged: willFlag,
      });
    } catch (err) {
      setSaveError(err.message || 'Could not update the flag.');
    }
  };

  const handleFinalSubmit = async (auto = false) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    clearInterval(timerRef.current);

    // Bank the time on the question the student is sitting on.
    const elapsed = consumeElapsed();
    if (currentQuestionId && answers[currentQuestionId] !== undefined && elapsed > 0) {
      await persistAnswer(currentQuestionId, answers[currentQuestionId], elapsed);
    }

    try {
      await apiClient.post(`/attempts/${attemptId}/submit`, { autoSubmitted: auto });
      navigate(`/student/result/${attemptId}`);
    } catch (err) {
      submittedRef.current = false;
      setSubmitting(false);
      alert('Error submitting test: ' + err.message);
    }
  };

  const formatTime = (secs) => {
    if (secs == null) return '--:--:--';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
  };

  const getQStatus = (idx) => {
    const qid = testQuestions[idx]?.questions?.id;
    if (qid && flagged.has(qid)) return 'flagged';
    if (qid && answers[qid] !== undefined) return 'answered';
    return 'unanswered';
  };

  const answeredCount = testQuestions.filter((tq) => answers[tq.questions?.id] !== undefined).length;
  const unansweredCount = testQuestions.length - answeredCount;
  const isWarning = timeLeft !== null && timeLeft < 300;

  if (alreadySubmitted) {
    return (
      <div className="arena-wrapper arena-noted-wrapper">
        <div className="arena-noted-card animate-fade-in">
          <div className="arena-noted-icon">
            <CheckCircle size={48} color="#059669" />
          </div>
          <span className="arena-noted-badge">Attempt Noted & Recorded</span>
          <h2>Your attempt has been noted</h2>
          <p className="arena-noted-lead">
            You have already completed and submitted <strong>{test?.title || 'this test'}</strong>.
          </p>
          <div className="arena-noted-box">
            <p>
              Each test can only be attempted once. Second attempts are strictly prohibited, so you cannot restart or retake this exam.
            </p>
            {test && (
              <div className="arena-noted-meta">
                <span>Duration: {test.duration_minutes} min</span>
                <span>•</span>
                <span>Total Marks: {test.total_marks}</span>
              </div>
            )}
          </div>
          <div className="arena-noted-actions">
            <button className="btn-noted-back" onClick={() => navigate('/student')}>
              Back to Dashboard
            </button>
            {submittedAttemptId && (
              <button
                className="btn-noted-view"
                onClick={() => navigate(`/student/result/${submittedAttemptId}`)}
              >
                View Submission
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading || !testQuestions.length) {
    return <div style={{ padding: 40, color: 'white' }}>Loading test…</div>;
  }

  const isNumerical = !currentQuestion?.options || currentQuestion.options.length === 0 || ['numerical', 'integer', 'nat', 'numeric'].includes(String(currentQuestion?.q_type || '').toLowerCase());
  const selectedIndex = answers[currentQuestionId]?.index;
  const numericValue = answers[currentQuestionId]?.value ?? '';

  return (
    <div className="arena-wrapper">
      <header className="arena-header">
        <div className="header-left">
          <span className="exam-title">{test?.title || 'Assessment'}</span>
          <span className="exam-meta">{currentQuestion?.subject || 'General'}</span>
        </div>
        <div className={`timer-block ${isWarning ? 'timer-warning' : ''}`}>
          <Clock size={20} />
          <span className="timer-display">{formatTime(timeLeft)}</span>
          {isWarning && <span className="warning-label">Under 5 minutes left</span>}
        </div>
        <div className="header-right">
          <div className="progress-summary">
            <span className="stat answered"><CheckCircle size={14} /> {answeredCount} Answered</span>
            <span className="stat unanswered">◯ {unansweredCount} Left</span>
            <span className="stat flagged-stat"><Flag size={14} /> {flagged.size} Flagged</span>
          </div>
          <button className="btn-submit-exam" onClick={() => setShowSubmitModal(true)}>
            Submit exam
          </button>
        </div>
      </header>

      {saveError && <div className="arena-save-error">{saveError}</div>}

      <div className="arena-body">
        <div className="question-panel">
          <div className="q-meta-row">
            <span className={`q-subject-badge subject-${(currentQuestion?.subject || '').toLowerCase()}`}>
              {currentQuestion?.subject || 'General'}
            </span>
            <span className="q-counter">Question {currentQ + 1} of {testQuestions.length}</span>
            <button
              className={`flag-btn ${flagged.has(currentQuestionId) ? 'flagged' : ''}`}
              onClick={toggleFlag}
            >
              <Flag size={16} />
              {flagged.has(currentQuestionId) ? 'Flagged' : 'Flag for Review'}
            </button>
          </div>

          <div className="question-text">
            <MathText as="p" text={currentQuestion?.question_text || ''} />
            {currentQuestion?.image_url && (
              <img className="arena-q-image" src={currentQuestion.image_url} alt="Question diagram" />
            )}
          </div>

          {isNumerical ? (
            <div className="arena-numerical-panel">
              <div className="arena-nat-header">
                <span className="arena-nat-badge">Section B · Numerical</span>
                <span className="arena-nat-hint">Enter your numeric answer using the on-screen keypad or keyboard:</span>
              </div>
              <div className="arena-nat-input-row">
                <input
                  type="text"
                  className="arena-nat-input"
                  value={numericValue}
                  onChange={(e) => handleNumericInput(e.target.value)}
                  placeholder="Enter value"
                />
                {hasAnswer(currentQuestionId) && (
                  <button
                    type="button"
                    className="arena-clear-btn"
                    onClick={handleClearResponse}
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="arena-keypad">
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '-', '⌫', 'Clear'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`arena-keypad-btn ${k === 'Clear' ? 'clear' : ''} ${k === '⌫' ? 'backspace' : ''}`}
                    onClick={() => handleKeypadPress(k)}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="options-list">
              {(currentQuestion?.options || []).map((opt, idx) => (
                <button
                  key={idx}
                  className={`option-btn ${selectedIndex === idx ? 'selected' : ''}`}
                  onClick={() => handleAnswer(idx)}
                >
                  <span className="opt-letter">{['A', 'B', 'C', 'D'][idx]}</span>
                  <span className="opt-text"><MathText text={String(opt)} /></span>
                  {selectedIndex === idx && <CheckCircle size={18} className="opt-check" />}
                </button>
              ))}
            </div>
          )}

          <div className="q-navigation">
            <button
              className="nav-btn"
              onClick={() => goToQuestion(Math.max(currentQ - 1, 0))}
              disabled={currentQ === 0}
            >
              <ChevronLeft size={20} /> Previous
            </button>
            {hasAnswer(currentQuestionId) && (
              <button
                type="button"
                className="nav-btn btn-clear-resp"
                onClick={handleClearResponse}
              >
                <RotateCcw size={16} /> Clear response
              </button>
            )}
            <button
              className="nav-btn primary"
              onClick={() => goToQuestion(Math.min(currentQ + 1, testQuestions.length - 1))}
              disabled={currentQ === testQuestions.length - 1}
            >
              Save &amp; Next <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <aside className="question-grid-panel">
          <h3 className="grid-title">Question navigator</h3>
          <div className="grid-legend">
            <span className="legend-item"><span className="dot answered-dot" /> Answered</span>
            <span className="legend-item"><span className="dot unanswered-dot" /> Not answered</span>
            <span className="legend-item"><span className="dot flagged-dot" /> Flagged</span>
          </div>

          <div className="q-grid">
            {testQuestions.map((_, idx) => (
              <button
                key={idx}
                className={`q-grid-btn ${getQStatus(idx)} ${currentQ === idx ? 'current' : ''}`}
                onClick={() => goToQuestion(idx)}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <div className="grid-stats">
            <div className="stat-row"><span>Total questions</span><strong>{testQuestions.length}</strong></div>
            <div className="stat-row"><span>Answered</span><strong className="text-green">{answeredCount}</strong></div>
            <div className="stat-row"><span>Not answered</span><strong className="text-red">{unansweredCount}</strong></div>
            <div className="stat-row"><span>Flagged</span><strong className="text-orange">{flagged.size}</strong></div>
          </div>
        </aside>
      </div>

      {showSubmitModal && (
        <div className="modal-overlay">
          <div className="submit-modal">
            <AlertTriangle size={40} className="modal-warning-icon" />
            <h2>Submit Exam?</h2>
            <p>You've answered <strong>{answeredCount}</strong> of <strong>{testQuestions.length}</strong> questions.</p>
            {unansweredCount > 0 && (
              <p className="unanswered-warning">{unansweredCount} question(s) are still unanswered.</p>
            )}
            <div className="modal-actions">
              <button className="btn-go-back" onClick={() => setShowSubmitModal(false)} disabled={submitting}>
                Go Back &amp; Review
              </button>
              <button className="btn-confirm-submit" onClick={() => handleFinalSubmit(false)} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Yes, Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAutoSubmit && (
        <div className="modal-overlay">
          <div className="submit-modal auto-submit">
            <Clock size={40} className="modal-warning-icon" />
            <h2>Time is up</h2>
            <p>Your exam is being submitted automatically.</p>
            <button className="btn-confirm-submit" onClick={() => handleFinalSubmit(true)} disabled={submitting}>
              {submitting ? 'Submitting…' : 'View Results'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentArena;
