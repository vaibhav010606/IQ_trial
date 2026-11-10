import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Check, Sliders, BookOpen, RefreshCw, Layers, ChevronRight, Search, ListChecks
} from 'lucide-react';
import { apiClient } from '../../api/client';
import {
  getQuestionType, norm, selectQuestions, topicStats,
} from '../../utils/autoFill';
import {
  getPattern, canonicalSubject, subjectQuota, kindOfQuestion, KINDS, KIND_LABEL,
} from '../../utils/examPatterns';
import './AutoGenerateTestModal.css';

const DIFFICULTY_PRESETS = [
  { id: 'balanced', label: 'Balanced', sub: '30% E · 50% M · 20% H', easy: 30, medium: 50, hard: 20 },
  { id: 'rigor', label: 'High rigor / advanced', sub: '10% E · 40% M · 50% H', easy: 10, medium: 40, hard: 50 },
  { id: 'jeemain', label: 'Standard', sub: '20% E · 60% M · 20% H', easy: 20, medium: 60, hard: 20 },
  { id: 'foundation', label: 'Foundation', sub: '60% E · 30% M · 10% H', easy: 60, medium: 30, hard: 10 },
];

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];

// The list endpoint caps `limit` at 200. 25 pages = 5,000 questions per
// subject, far above the current bank, and still a bounded number of requests.
const BANK_PAGE_SIZE = 200;
const MAX_BANK_PAGES = 25;

/** Loads every active question of one subject, across all pages. */
async function fetchSubjectBank(subject) {
  const query = (page) =>
    `/questions?subject=${encodeURIComponent(subject)}&review_status=all&limit=${BANK_PAGE_SIZE}&page=${page}`;
  const first = await apiClient.get(query(1));
  const rows = Array.isArray(first) ? first : (first?.data ?? []);
  const totalPages = Math.min(Number(first?.totalPages) || 1, MAX_BANK_PAGES);
  if (totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) => apiClient.get(query(i + 2))),
    );
    rest.forEach((r) => rows.push(...(Array.isArray(r) ? r : (r?.data ?? []))));
  }
  // The API filters by subject already; this guards against a loose match.
  return rows.filter((q) => norm(q.subject) === norm(subject));
}

/**
 * Rendered only while open (the parent mounts it conditionally), so every
 * open starts from fresh state and the hooks below always run in the same
 * order.
 */
export default function AutoGenerateTestModal({
  onClose,
  subject = 'Physics',
  userSubject = null,
  availableTopics = [],
  currentSelected = [],
  targetTotal = 25,
  targetNat = 5,
  patternName = 'JEE Main Pattern',
  /** Official pattern id (jee_main, jee_advanced, ...) — null for a custom paper. */
  patternId = null,
  onApply,
  showToast
}) {
  // A subject-scoped teacher is locked to their subject; an admin can fill
  // each subject of a mixed paper in turn.
  const initialSubject = userSubject || (subject && subject !== 'Mixed' ? subject : 'Physics');
  const [targetSub, setTargetSub] = useState(initialSubject);

  // ── Question counts (default to the paper's quota) ──
  const [customCount, setQuestionCount] = useState(targetTotal || 25);
  const [customNat, setNatCount] = useState(Math.min(targetNat ?? 5, targetTotal || 25));

  // Under an official pattern the counts are not a choice: they are the
  // subject's share of the paper, kind by kind (JEE Advanced Paper 1 Physics:
  // 7 single-correct, 3 one-or-more-correct, 6 numerical).
  const pattern = getPattern(patternId);
  const patternSubject = pattern ? canonicalSubject(targetSub, pattern) : null;
  const officialQuota = pattern && patternSubject ? subjectQuota(pattern, patternSubject) : null;
  const kindOf = (q) => (pattern ? kindOfQuestion(q, pattern) : null);

  const questionCount = officialQuota ? officialQuota.total : customCount;
  const natCount = officialQuota ? officialQuota.numerical : customNat;
  const mcqCount = Math.max(0, questionCount - natCount);

  // ── Question bank for the subject ──
  const [bank, setBank] = useState([]);
  const [bankLoading, setBankLoading] = useState(true);
  const [bankError, setBankError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setBankLoading(true);
    setBankError(null);
    fetchSubjectBank(targetSub)
      .then((rows) => { if (!cancelled) setBank(rows); })
      .catch((err) => {
        if (!cancelled) {
          setBank([]);
          setBankError(err.message || 'Failed to load the question bank');
        }
      })
      .finally(() => { if (!cancelled) setBankLoading(false); });
    return () => { cancelled = true; };
  }, [targetSub]);

  // Topics = syllabus chapters ∪ topics that actually exist in the bank,
  // ordered by how many usable questions each has.
  const stats = useMemo(() => topicStats(bank), [bank]);
  const allTopics = useMemo(() => {
    const syllabus = norm(targetSub) === norm(initialSubject) ? availableTopics : [];
    const names = [...new Set([...stats.keys(), ...syllabus])];
    const usable = (t) => (stats.get(t)?.mcq || 0) + (stats.get(t)?.nat || 0);
    return names.sort((a, b) => usable(b) - usable(a) || a.localeCompare(b));
  }, [stats, availableTopics, targetSub, initialSubject]);
  const topicCount = (t) => (stats.get(t)?.mcq || 0) + (stats.get(t)?.nat || 0);

  // ── Topic selection & weights ──
  const [topicSearch, setTopicSearch] = useState('');
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [topicsTouched, setTopicsTouched] = useState(false);

  // Until the user picks topics, preselect the three best-stocked ones.
  useEffect(() => {
    if (topicsTouched || bankLoading) return;
    const stocked = allTopics.filter((t) => topicCount(t) > 0);
    setSelectedTopics((stocked.length ? stocked : allTopics).slice(0, 3));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTopics, bankLoading, topicsTouched]);

  const changeSubject = (next) => {
    setTargetSub(next);
    setTopicsTouched(false);
    setSelectedTopics([]);
  };

  const [topicWeights, setTopicWeights] = useState({});
  const equalWeights = (topics) => {
    const base = Math.floor(100 / (topics.length || 1));
    const remainder = 100 - base * topics.length;
    return Object.fromEntries(topics.map((t, i) => [t, base + (i === 0 ? remainder : 0)]));
  };
  useEffect(() => { setTopicWeights(equalWeights(selectedTopics)); }, [selectedTopics]);

  const handleWeightChange = (topic, val) => {
    const num = Math.max(0, Math.min(100, Number(val) || 0));
    setTopicWeights(prev => ({ ...prev, [topic]: num }));
  };

  const setTopics = (topics) => { setTopicsTouched(true); setSelectedTopics(topics); };
  const toggleTopic = (topic) => {
    if (selectedTopics.includes(topic)) {
      if (selectedTopics.length === 1) {
        showToast('At least 1 topic must remain selected.');
        return;
      }
      setTopics(selectedTopics.filter(t => t !== topic));
    } else {
      setTopics([...selectedTopics, topic]);
    }
  };

  const filteredTopics = useMemo(() => {
    if (!topicSearch.trim()) return allTopics;
    return allTopics.filter(t => t.toLowerCase().includes(topicSearch.toLowerCase()));
  }, [allTopics, topicSearch]);

  // ── Difficulty ──
  const [diffPreset, setDiffPreset] = useState('jeemain');
  const [easyPct, setEasyPct] = useState(20);
  const [medPct, setMedPct] = useState(60);
  const [hardPct, setHardPct] = useState(20);

  const applyDiffPreset = (preset) => {
    setDiffPreset(preset.id);
    setEasyPct(preset.easy);
    setMedPct(preset.medium);
    setHardPct(preset.hard);
  };

  // ── Mode: Replace vs Top-up ──
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const bankMcq = bank.filter(q => getQuestionType(q) === 'mcq').length;
  const bankNat = bank.filter(q => getQuestionType(q) === 'nat').length;
  const bankByKind = officialQuota
    ? Object.fromEntries(KINDS.map(k => [k, bank.filter(q => kindOf(q) === k).length]))
    : null;

  // ── Generation ──
  const handleGenerate = (proceedToReview = false) => {
    if (selectedTopics.length === 0) {
      showToast('Please select at least one topic.');
      return;
    }
    if (!bank.length) {
      showToast(`No questions found in the question bank for ${targetSub}.`);
      return;
    }

    setIsGenerating(true);
    try {
      const sameSubject = (q) => norm(q.subject) === norm(targetSub);
      // Other subjects on a mixed paper are never touched.
      const otherSubjects = currentSelected.filter(q => !sameSubject(q));
      const kept = replaceExisting ? [] : currentSelected.filter(sameSubject);

      // Top-up mode fills the gap to the target instead of adding a full set.
      const keptNat = kept.filter(q => getQuestionType(q) === 'nat').length;
      const keptMcq = kept.filter(q => getQuestionType(q) === 'mcq').length;
      const wantNat = Math.max(0, natCount - keptNat);
      const wantMcq = Math.max(0, mcqCount - keptMcq);

      // Official pattern: fill each section kind to exactly its quota.
      const wantKinds = officialQuota
        ? Object.fromEntries(KINDS.map(k => [k, Math.max(0, officialQuota[k] - kept.filter(q => kindOf(q) === k).length)]))
        : null;

      const { chosen, short } = selectQuestions(bank, {
        topics: selectedTopics,
        weights: topicWeights,
        ...(wantKinds ? { kinds: wantKinds, kindOf } : { mcq: wantMcq, nat: wantNat }),
        mix: { easy: easyPct, medium: medPct, hard: hardPct },
        excludeIds: new Set(currentSelected.map(q => q.id)),
      });

      const totalWanted = wantKinds ? Object.values(wantKinds).reduce((a, b) => a + b, 0) : wantMcq + wantNat;
      if (chosen.length === 0 && totalWanted > 0) {
        showToast(`No usable ${targetSub} questions left to add.`);
        return;
      }

      const added = chosen.map(q => ({ ...q, subject: q.subject || targetSub, marks: q.marks || 4 }));
      onApply([...otherSubjects, ...kept, ...added], proceedToReview);

      const pending = added.filter(q => q.review_status && q.review_status !== 'approved').length;
      const notes = [];
      for (const [kind, missing] of Object.entries(short || {})) {
        if (missing > 0) {
          const label = KIND_LABEL[kind] || (kind === 'nat' ? 'Numerical' : 'MCQ');
          notes.push(`${missing} ${label.toLowerCase()} short`);
        }
      }
      if (pending > 0) notes.push(`${pending} still pending review`);
      showToast(
        `Added ${added.length} ${targetSub} questions` +
        (notes.length ? ` — ${notes.join(', ')} (not enough in the bank).` : '.'),
      );
      onClose();
    } catch (err) {
      console.error('Auto-generation failed:', err);
      showToast('Auto-fill error: ' + (err.message || 'Failed to select questions'));
    } finally {
      setIsGenerating(false);
    }
  };

  const busy = isGenerating || bankLoading;

  return (
    <div className="agm-overlay" onClick={onClose}>
      <div className="agm-modal" onClick={e => e.stopPropagation()}>
        {/* ── Modal Header ── */}
        <div className="agm-header">
          <div className="agm-header-left">
            <div className="agm-badge-icon">
              <ListChecks size={22} />
            </div>
            <div>
              <h2>Auto-Generate Test Questions</h2>
              <p>
                Automate question selection for{' '}
                {userSubject ? (
                  <strong>{targetSub}</strong>
                ) : (
                  <select
                    value={targetSub}
                    onChange={e => changeSubject(e.target.value)}
                    disabled={busy}
                    aria-label="Subject to auto-fill"
                    style={{ padding: '2px 6px', borderRadius: '6px', border: '1px solid #c6b99e', fontWeight: 600 }}
                  >
                    {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}{' '}
                based on topic weightage & difficulty
              </p>
            </div>
          </div>
          <button className="agm-close-btn" onClick={onClose} title="Close">
            <X size={20} />
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div className="agm-body">
          {/* Target Count & Format Bar */}
          <div className="agm-section" style={{ padding: '12px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={18} color="var(--accent)" />
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#2a2722' }}>
                  Target Format: <span style={{ color: 'var(--accent)' }}>{patternName}</span>
                </span>
              </div>
              {officialQuota ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#56504a' }}>
                  <span><strong>{patternSubject}</strong> · {officialQuota.total} questions (official, fixed)</span>
                  {KINDS.filter(k => officialQuota[k] > 0).map(k => (
                    <span key={k} className="num">{KIND_LABEL[k]}: <strong>{officialQuota[k]}</strong></span>
                  ))}
                </div>
              ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 500, color: '#56504a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Total Questions:
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={questionCount}
                    onChange={e => {
                      const next = Math.max(1, Math.min(200, Number(e.target.value) || 1));
                      setQuestionCount(next);
                      setNatCount(n => Math.min(n, next));
                    }}
                    style={{ width: '56px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #c6b99e', fontWeight: 600, textAlign: 'center' }}
                  />
                </label>
                <label style={{ fontSize: '0.82rem', fontWeight: 500, color: '#56504a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  Numericals:
                  <input
                    type="number"
                    min="0"
                    max={questionCount}
                    value={natCount}
                    onChange={e => setNatCount(Math.max(0, Math.min(questionCount, Number(e.target.value) || 0)))}
                    style={{ width: '50px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #c6b99e', fontWeight: 600, textAlign: 'center' }}
                  />
                </label>
                <span style={{ fontSize: '0.82rem', fontWeight: 500, color: '#736b5f' }}>
                  (MCQs: <strong style={{ color: '#2a2722' }}>{mcqCount}</strong>)
                </span>
              </div>
              )}
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.78rem', color: bankError ? '#b3352b' : '#736b5f' }}>
              {bankLoading
                ? `Loading the ${targetSub} question bank…`
                : bankError
                  ? `Could not load the question bank: ${bankError}`
                  : bankByKind
                    ? `${targetSub} bank: ${KINDS.map(k => `${bankByKind[k]} ${KIND_LABEL[k].toLowerCase()}`).join(', ')} usable for ${pattern.label}.`
                    : `${targetSub} bank: ${bankMcq} MCQs and ${bankNat} integer numericals available.`}
            </div>
          </div>

          {/* 1. Topic Selection & Weightage */}
          <div className="agm-section">
            <div className="agm-section-title">
              <h3>
                <BookOpen size={20} color="var(--accent)" />
                <span>1. Syllabus Topics & Weightage Distribution</span>
              </h3>
              <div className="agm-title-actions">
                <span className="agm-pill-badge">{selectedTopics.length} Selected</span>
                <button
                  type="button"
                  className="agm-btn-quick-topic"
                  onClick={() => {
                    const stocked = allTopics.filter(t => topicCount(t) > 0);
                    setTopics(stocked.length ? stocked : allTopics);
                  }}
                  title="Select every chapter that has questions in the bank"
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="agm-btn-quick-topic"
                  onClick={() => {
                    if (allTopics.length > 0) setTopics([allTopics[0]]);
                  }}
                  title="Reset to 1 chapter"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="agm-topic-search-wrap">
              <Search size={18} className="agm-search-icon" />
              <input
                type="text"
                className="agm-topic-search-input"
                placeholder="Search chapters & topics (e.g., Kinematics, Thermodynamics, Electrostatics)..."
                value={topicSearch}
                onChange={e => setTopicSearch(e.target.value)}
              />
              {topicSearch && (
                <button
                  type="button"
                  className="agm-search-clear-btn"
                  onClick={() => setTopicSearch('')}
                  title="Clear search"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Topics Chips */}
            <div className="agm-topics-scroll">
              {filteredTopics.map(topic => {
                const isSelected = selectedTopics.includes(topic);
                const count = topicCount(topic);
                return (
                  <button
                    key={topic}
                    type="button"
                    className={`agm-topic-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleTopic(topic)}
                    title={`${stats.get(topic)?.mcq || 0} MCQs · ${stats.get(topic)?.nat || 0} numericals`}
                    style={count === 0 && !isSelected ? { opacity: 0.55 } : undefined}
                  >
                    {isSelected && <Check size={14} className="agm-chip-check-icon" />}
                    <span>{topic}</span>
                    {!bankLoading && <span style={{ marginLeft: 6, opacity: 0.7 }}>({count})</span>}
                  </button>
                );
              })}
            </div>

            {/* Topic Weightage Sliders */}
            {selectedTopics.length > 0 && (
              <div className="agm-weightage-container">
                <div className="agm-weightage-header">
                  <span>Topic Weightage (% of test questions allocated)</span>
                  <button
                    type="button"
                    className="agm-btn-equalize"
                    onClick={() => setTopicWeights(equalWeights(selectedTopics))}
                    title="Split 100% equally among selected topics"
                  >
                    <RefreshCw size={12} />
                    <span>Equalize weightage</span>
                  </button>
                </div>

                {selectedTopics.map(topic => {
                  const weight = topicWeights[topic] || 0;
                  const totalWeight = Object.values(topicWeights).reduce((a, b) => a + b, 0) || 100;
                  const estimatedQs = Math.round(questionCount * (weight / totalWeight));
                  return (
                    <div key={topic} className="agm-weight-row">
                      <div className="agm-weight-topic-name" title={topic}>
                        {topic}
                      </div>
                      <div className="agm-weight-slider-wrap">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={weight}
                          onChange={e => handleWeightChange(topic, e.target.value)}
                          className="agm-weight-slider"
                        />
                        <span className="agm-weight-pct">{weight}%</span>
                        <span className="agm-weight-qs-badge">~{estimatedQs} Qs</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Difficulty Target */}
          <div className="agm-section">
            <div className="agm-section-title">
              <h3>
                <Sliders size={18} color="var(--accent)" />
                <span>2. Question Difficulty Target</span>
              </h3>
            </div>

            <div className="agm-diff-presets">
              {DIFFICULTY_PRESETS.map(preset => {
                const isAct = diffPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={`agm-diff-btn ${isAct ? 'active' : ''}`}
                    onClick={() => applyDiffPreset(preset)}
                  >
                    <span className="agm-diff-title">{preset.label}</span>
                    <span className="agm-diff-sub">{preset.sub}</span>
                  </button>
                );
              })}
            </div>

            <div className="agm-diff-sliders">
              {[
                ['Easy', easyPct, setEasyPct],
                ['Medium', medPct, setMedPct],
                ['Hard', hardPct, setHardPct],
              ].map(([label, value, setValue]) => (
                <div key={label} className="agm-diff-slider-item">
                  <div className="agm-diff-slider-label">
                    <span>{label}</span>
                    <span>{value}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={value}
                    onChange={e => {
                      setValue(Number(e.target.value));
                      setDiffPreset('custom');
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#736b5f' }}>
              The mix is a target: when the bank has too few questions at a level, the rest are filled from other levels.
            </div>
          </div>

          {/* Live Summary Bar */}
          <div className="agm-summary-box">
            <div className="agm-summary-stat">
              <span className="label">Exam pattern</span>
              <span className="val">{patternName}</span>
            </div>
            <div className="agm-summary-divider" />
            <div className="agm-summary-stat">
              <span className="label">Total questions</span>
              <span className="val">{questionCount} Qs</span>
            </div>
            <div className="agm-summary-divider" />
            <div className="agm-summary-stat">
              <span className="label">MCQs / Numericals</span>
              <span className="val">{mcqCount} / {natCount}</span>
            </div>
            <div className="agm-summary-divider" />
            <div className="agm-summary-stat">
              <span className="label">Topics selected</span>
              <span className="val">{selectedTopics.length} Chapters</span>
            </div>
            <div className="agm-summary-divider" />
            <div className="agm-summary-stat">
              <span className="label">Estimated marks</span>
              <span className="val">{officialQuota ? (pattern.subjects[patternSubject] || []).reduce((t, sec) => t + sec.count * sec.marks, 0) : questionCount * 4} pts</span>
            </div>
          </div>
        </div>

        {/* ── Footer Actions ── */}
        <div className="agm-footer">
          <label className="agm-mode-toggle">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={e => setReplaceExisting(e.target.checked)}
            />
            <span>
              {replaceExisting
                ? `Clear existing ${targetSub} questions & replace with new auto-fill`
                : `Keep existing ${targetSub} questions & top up to the target`}
            </span>
          </label>

          <div className="agm-footer-actions">
            <button type="button" className="agm-btn-cancel" onClick={onClose} disabled={isGenerating}>
              Cancel
            </button>
            <button
              type="button"
              className="agm-btn-submit"
              onClick={() => handleGenerate(false)}
              disabled={busy || selectedTopics.length === 0}
              title="Auto-fill questions and stay on current step"
            >
              {busy ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>{bankLoading ? 'Loading bank...' : 'Selecting...'}</span>
                </>
              ) : (
                <>
                  <ListChecks size={16} />
                  <span>Auto-Fill Questions</span>
                </>
              )}
            </button>
            <button
              type="button"
              className="agm-btn-submit agm-btn-review"
              onClick={() => handleGenerate(true)}
              disabled={busy || selectedTopics.length === 0}
              title="Auto-fill questions and immediately proceed to Step 3 Review"
            >
              {busy ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>{bankLoading ? 'Loading bank...' : 'Selecting...'}</span>
                </>
              ) : (
                <>
                  <span>Auto-Fill & Review</span>
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
