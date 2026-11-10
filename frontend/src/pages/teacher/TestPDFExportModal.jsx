import React, { useState, useMemo } from 'react';
import { X, Printer, FileText, Layers } from 'lucide-react';
import MathText from '../../components/MathText';
import './TestPDFExportModal.css';

const CANONICAL_SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

export const TestPDFExportModal = ({ isOpen, onClose, testData = {}, selectedQuestions = [] }) => {
  const [showAnswers, setShowAnswers] = useState(false);
  const [showSolutions, setShowSolutions] = useState(false);
  const [showTopicTags, setShowTopicTags] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState('ALL');

  const handlePrint = () => {
    window.print();
  };

  // Helper to get normalized subject name
  const getSubjectName = (q) => {
    const raw = q?.subject || q?.questions?.subject || 'General';
    const trimmed = String(raw).trim();
    const matched = CANONICAL_SUBJECTS.find(s => s.toLowerCase() === trimmed.toLowerCase());
    return matched || (trimmed.charAt(0).toUpperCase() + trimmed.slice(1));
  };

  // Extract answer string for display
  const getAnswerDisplay = (q) => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const ans = q.correct_answer;
    if (ans?.value !== undefined && ans?.value !== null && ans?.value !== '') {
      return String(ans.value);
    }
    if (Array.isArray(ans?.indices) && ans.indices.length > 0) {
      return ans.indices.map(i => letters[i] ?? `(${i + 1})`).join(', ');
    }
    if (Array.isArray(ans?.letters) && ans.letters.length > 0) {
      return ans.letters.join(', ');
    }
    if (ans?.letter) {
      return String(ans.letter).toUpperCase();
    }
    if (ans?.index !== undefined && ans?.index !== null) {
      return letters[ans.index] ?? `(${ans.index + 1})`;
    }
    if (typeof ans === 'string' || typeof ans === 'number') {
      return String(ans);
    }
    return '—';
  };

  const isOptionCorrect = (q, idx) => {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const ans = q.correct_answer;
    if (ans?.index !== undefined && ans?.index !== null) return ans.index === idx;
    if (ans?.letter) return ans.letter.toUpperCase() === letters[idx];
    if (Array.isArray(ans?.indices)) return ans.indices.includes(idx);
    if (Array.isArray(ans?.letters)) return ans.letters.includes(letters[idx]);
    if (typeof ans === 'string' && /^[A-F]$/i.test(ans.trim())) {
      return ans.trim().toUpperCase() === letters[idx];
    }
    return false;
  };

  // List of distinct subjects present in the questions
  const distinctSubjects = useMemo(() => {
    const set = new Set();
    selectedQuestions.forEach(q => {
      const s = getSubjectName(q);
      if (s) set.add(s);
    });
    return Array.from(set).sort((a, b) => {
      const ia = CANONICAL_SUBJECTS.indexOf(a);
      const ib = CANONICAL_SUBJECTS.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [selectedQuestions]);

  // Group questions by subject with continuous numbering
  const subjectGroups = useMemo(() => {
    if (!selectedQuestions || selectedQuestions.length === 0) return [];

    const map = new Map();
    distinctSubjects.forEach(s => map.set(s, []));

    selectedQuestions.forEach(q => {
      const s = getSubjectName(q);
      if (!map.has(s)) map.set(s, []);
      map.get(s).push(q);
    });

    const activeSubjects = subjectFilter === 'ALL'
      ? distinctSubjects
      : [subjectFilter];

    let globalCounter = 0;
    return activeSubjects
      .filter(s => map.has(s) && map.get(s).length > 0)
      .map((s, sIdx) => {
        const rawList = map.get(s);
        const qs = rawList.map(q => {
          globalCounter += 1;
          return {
            ...q,
            displayNum: globalCounter,
            marks: q.marks_override || q.marks || 4,
          };
        });
        const subMarks = qs.reduce((sum, q) => sum + (Number(q.marks) || 4), 0);
        return {
          subject: s,
          sectionNum: sIdx + 1,
          questions: qs,
          totalQuestions: qs.length,
          totalMarks: subMarks,
        };
      });
  }, [selectedQuestions, distinctSubjects, subjectFilter]);

  const displayedTotalQuestions = subjectGroups.reduce((sum, g) => sum + g.totalQuestions, 0);
  const displayedTotalMarks = subjectGroups.reduce((sum, g) => sum + g.totalMarks, 0);

  // Exam headings based on pattern
  const pattern = String(testData.paper_pattern || testData.t_type || '').toLowerCase();
  const getExamMainHeading = () => {
    if (pattern.includes('jee_adv') || pattern.includes('advanced')) {
      return 'JEE (ADVANCED) EXAMINATION';
    }
    if (pattern.includes('neet')) {
      return 'NATIONAL ELIGIBILITY CUM ENTRANCE TEST (UG)';
    }
    if (pattern.includes('jee') || pattern.includes('main')) {
      return 'JOINT ENTRANCE EXAMINATION (MAIN)';
    }
    return 'INSTITUTIONAL ASSESSMENT EXAMINATION';
  };

  const getExamSubHeading = () => {
    if (pattern.includes('jee_adv') || pattern.includes('advanced')) {
      return 'QUESTION PAPER BOOKLET WITH DETAILED MARKING';
    }
    if (pattern.includes('neet')) {
      return 'OFFICIAL QUESTION BOOKLET — ALL SUBJECTS';
    }
    if (pattern.includes('jee') || pattern.includes('main')) {
      return 'OFFICIAL QUESTION PAPER WITH DETAILED SCHEME';
    }
    return 'QUESTION PAPER BOOKLET';
  };

  const durationMins = testData.duration_minutes || testData.duration || 180;
  const durationHours = durationMins >= 60
    ? `${durationMins} Minutes (${(durationMins / 60).toFixed(durationMins % 60 === 0 ? 0 : 1)} Hours)`
    : `${durationMins} Minutes`;

  const subjectsFormatted = distinctSubjects.length > 0
    ? distinctSubjects.join(' • ')
    : (testData.subject || 'All Subjects');

  const paperTotalMarks = testData.total_marks || displayedTotalMarks;

  if (!isOpen) return null;

  return (
    <div className="tc-pdf-modal-overlay">
      {/* ── Top Toolbar (Hidden during print) ── */}
      <div className="tc-pdf-toolbar">
        <div className="tc-pdf-toolbar-left">
          <div className="tc-pdf-icon-wrap">
            <FileText size={20} />
          </div>
          <div>
            <h3>Question paper PDF export</h3>
            <span className="tc-pdf-meta-hint">
              {testData.title || 'Assessment'} · {displayedTotalQuestions} Questions · {displayedTotalMarks} Marks
              {subjectFilter !== 'ALL' && ` (${subjectFilter} only)`}
            </span>
          </div>
        </div>

        <div className="tc-pdf-toolbar-right">
          {/* Subject Filter selector */}
          {distinctSubjects.length > 1 && (
            <div className="tc-pdf-filter-wrap">
              <Layers size={14} className="tc-pdf-filter-icon" />
              <select
                className="tc-pdf-select-subject"
                value={subjectFilter}
                onChange={e => setSubjectFilter(e.target.value)}
                title="Filter questions by subject"
              >
                <option value="ALL">All Subjects (Subject-wise)</option>
                {distinctSubjects.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
          )}

          <label className="tc-pdf-toggle">
            <input
              type="checkbox"
              checked={showTopicTags}
              onChange={e => setShowTopicTags(e.target.checked)}
            />
            <span>Show topic tags</span>
          </label>

          <label className="tc-pdf-toggle">
            <input
              type="checkbox"
              checked={showAnswers}
              onChange={e => setShowAnswers(e.target.checked)}
            />
            <span>Include answer key</span>
          </label>

          <label className="tc-pdf-toggle">
            <input
              type="checkbox"
              checked={showSolutions}
              onChange={e => setShowSolutions(e.target.checked)}
            />
            <span>Include solutions</span>
          </label>

          <button
            type="button"
            className="tc-pdf-btn-print"
            onClick={handlePrint}
            title="Open browser print dialog to save as PDF or print"
          >
            <Printer size={16} />
            <span>Print / Save as PDF</span>
          </button>

          <button
            type="button"
            className="tc-pdf-btn-close"
            onClick={onClose}
            aria-label="Close PDF preview"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* ── Printable Document Container ── */}
      <div className="tc-pdf-doc-container">
        <div className="tc-pdf-page">
          {/* Formal Examination Header */}
          <div className="tc-exam-formal-header">
            <div className="tc-exam-main-title">{getExamMainHeading()}</div>
            <div className="tc-exam-sub-title">{getExamSubHeading()}</div>
            <div className="tc-exam-paper-name">{testData.title || 'Assessment Paper'}</div>

            {/* Test Metadata Grid */}
            <div className="tc-exam-meta-grid">
              <div className="tc-exam-meta-item">
                <strong>Subject(s):</strong> {subjectFilter === 'ALL' ? subjectsFormatted : subjectFilter}
              </div>
              <div className="tc-exam-meta-item">
                <strong>Time Allowed:</strong> {durationHours}
              </div>
              <div className="tc-exam-meta-item">
                <strong>Maximum Marks:</strong> {paperTotalMarks}
              </div>
              <div className="tc-exam-meta-item">
                <strong>Total Questions:</strong> {displayedTotalQuestions}
              </div>
              {testData.negative_marking !== false && (
                <div className="tc-exam-meta-item tc-negative">
                  <strong>Marking Scheme:</strong> +4 for Correct · −{testData.negative_marks || 1} for Incorrect
                </div>
              )}
            </div>

            {/* Official Candidate Particulars Box */}
            <div className="tc-exam-candidate-box">
              <div className="tc-cand-row">
                <div className="tc-cand-cell">
                  <span className="tc-cand-label">Candidate Name (in Capitals):</span>
                  <span className="tc-cand-line"></span>
                </div>
                <div className="tc-cand-cell" style={{ flex: '0 0 240px' }}>
                  <span className="tc-cand-label">Roll Number:</span>
                  <span className="tc-cand-line"></span>
                </div>
              </div>
              <div className="tc-cand-row">
                <div className="tc-cand-cell">
                  <span className="tc-cand-label">Centre of Examination:</span>
                  <span className="tc-cand-line"></span>
                </div>
                <div className="tc-cand-cell" style={{ flex: '0 0 160px' }}>
                  <span className="tc-cand-label">Date:</span>
                  <span className="tc-cand-line"></span>
                </div>
                <div className="tc-cand-cell" style={{ flex: '0 0 200px' }}>
                  <span className="tc-cand-label">Candidate's Signature:</span>
                  <span className="tc-cand-line"></span>
                </div>
              </div>
            </div>

            {/* General Instructions */}
            <div className="tc-exam-instructions">
              <div className="tc-instructions-heading">IMPORTANT INSTRUCTIONS FOR CANDIDATES</div>
              <ol className="tc-instructions-list">
                <li>
                  This question paper contains <strong>{displayedTotalQuestions} questions</strong> divided subject-wise into{' '}
                  <strong>{subjectGroups.length} Section{subjectGroups.length !== 1 ? 's' : ''}</strong> ({subjectsFormatted}).
                </li>
                <li>
                  All questions are compulsory. Maximum time allowed is <strong>{durationHours}</strong>.
                </li>
                <li>
                  <strong>Marking Scheme:</strong> Each question carries <strong>+4 marks</strong> for a correct response.
                  {testData.negative_marking !== false ? (
                    <span> An incorrect response results in deduction of <strong>−{testData.negative_marks || 1} mark</strong>.</span>
                  ) : (
                    <span> There is no negative marking for incorrect responses.</span>
                  )}
                  {' '}Unattempted questions receive zero marks.
                </li>
                <li>
                  Use of any mobile phone, smart watch, programmable calculator, or unauthorized paper is strictly prohibited.
                </li>
                <li>
                  Space for rough work is provided at the bottom of the examination paper.
                </li>
                {testData.instructions && <li>{testData.instructions}</li>}
              </ol>
            </div>
          </div>

          <div className="tc-exam-divider-double"></div>

          {/* Subject-wise Questions */}
          {subjectGroups.length === 0 ? (
            <div className="tc-pdf-empty">
              No questions have been added to this test yet.
            </div>
          ) : (
            subjectGroups.map((group) => (
              <div key={group.subject} className="tc-pdf-subject-section">
                {/* Formal Section Banner */}
                <div className="tc-pdf-section-title-box">
                  <div className="tc-pdf-sec-left">
                    <span className="tc-pdf-sec-badge">PART {String.fromCharCode(64 + group.sectionNum)}</span>
                    <h2 className="tc-pdf-sec-title">{group.subject.toUpperCase()}</h2>
                  </div>
                  <div className="tc-pdf-sec-right">
                    <span>{group.totalQuestions} Questions</span>
                    <span className="tc-pdf-sep">•</span>
                    <span>Max Marks: {group.totalMarks}</span>
                  </div>
                </div>

                {/* List of Questions in this Subject */}
                <div className="tc-pdf-questions-list">
                  {group.questions.map((q) => {
                    const rawOptions = Array.isArray(q.options) ? q.options : [];
                    const hasOptions = rawOptions.length > 0;
                    const qNum = q.displayNum;

                    return (
                      <div key={q.id || qNum} className="tc-pdf-q-item">
                        <div className="tc-pdf-q-header">
                          <span className="tc-pdf-q-num">Q.{qNum}</span>
                          <div className="tc-pdf-q-text">
                            <MathText text={q.question_text || q.text || ''} />
                          </div>
                          <span className="tc-pdf-q-marks">[{q.marks || 4} Marks]</span>
                        </div>

                        {showTopicTags && (q.topic || q.q_type) && (
                          <div className="tc-pdf-q-submeta">
                            {q.topic && <span className="tc-pdf-topic-tag">Topic: {q.topic}</span>}
                            {q.q_type && <span className="tc-pdf-qtype-tag">{String(q.q_type).replace('_', ' ')}</span>}
                          </div>
                        )}

                        {q.image_url && (
                          <div className="tc-pdf-q-image-wrap">
                            <img src={q.image_url} alt={`Diagram for Q.${qNum}`} className="tc-pdf-q-image" />
                          </div>
                        )}

                        {hasOptions && (
                          <div className="tc-pdf-options-grid">
                            {rawOptions.map((opt, optIdx) => {
                              const optLetter = ['(A)', '(B)', '(C)', '(D)', '(E)', '(F)'][optIdx] || `(${optIdx + 1})`;
                              const optText = typeof opt === 'string' ? opt : (opt?.text ?? String(opt));
                              const isCorrect = isOptionCorrect(q, optIdx);

                              return (
                                <div
                                  key={optIdx}
                                  className={`tc-pdf-opt ${showAnswers && isCorrect ? 'tc-pdf-opt-correct' : ''}`}
                                >
                                  <span className="tc-pdf-opt-label">{optLetter}</span>
                                  <div className="tc-pdf-opt-text">
                                    <MathText text={optText} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {showSolutions && q.solution && (
                          <div className="tc-pdf-solution-box">
                            <strong>Solution / Explanation:</strong>
                            <MathText text={q.solution} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Space for Rough Work */}
                <div className="tc-pdf-rough-work">
                  <span>SPACE FOR ROUGH WORK</span>
                </div>
              </div>
            ))
          )}

          {/* Answer Key Section (when checked) */}
          {showAnswers && subjectGroups.length > 0 && (
            <div className="tc-pdf-answer-key-section">
              <div className="tc-exam-divider-double"></div>
              <h2 className="tc-pdf-key-title">OFFICIAL ANSWER KEY & EVALUATION GUIDE</h2>
              <div className="tc-pdf-key-subtext">
                {testData.title || 'Assessment Paper'} · Marking Scheme: +4 / −1
              </div>

              {subjectGroups.map((group) => (
                <div key={group.subject} className="tc-pdf-key-subject-block">
                  <div className="tc-pdf-key-subject-header">
                    <span>PART {String.fromCharCode(64 + group.sectionNum)}: {group.subject.toUpperCase()}</span>
                    <span className="tc-pdf-key-sub-count">({group.totalQuestions} Questions)</span>
                  </div>
                  <div className="tc-pdf-key-grid">
                    {group.questions.map((q) => (
                      <div key={q.id || q.displayNum} className="tc-pdf-key-cell">
                        <span className="tc-key-q">Q.{q.displayNum}</span>
                        <strong className="tc-key-ans">
                          <MathText text={getAnswerDisplay(q)} />
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paper Footer */}
          <div className="tc-pdf-page-footer">
            <span>{testData.title || 'Assessment'}</span>
            <span>*** End of Question Paper ***</span>
            <span>Total Questions: {displayedTotalQuestions}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestPDFExportModal;
