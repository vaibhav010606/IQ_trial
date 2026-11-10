import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Plus, Edit, Copy, Trash2, X, Image as ImageIcon,
  ChevronLeft, ChevronRight, Loader2, LayoutGrid, List,
  CheckCircle2, ChevronDown, ChevronUp, Check, Database, Upload
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { useAppData } from '../../context/AppDataContext';
import MathText from '../../components/MathText';
import './QuestionBank.css';

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const CHAPTERS = {
  Chemistry: [
    'Atomic Structure', 'Chemical Bonding', 'Chemical Equilibrium', 'Chemical Kinetics',
    'Colligative Properties of Solutions', 'Coordination Compounds', 'd-Block Elements',
    'Electrochemistry', 'Gaseous State', 'Hydrogen and s-Block Elements',
    'IOC and Hydrocarbons', 'Ionic Equilibrium', 'Metallurgy',
    'Nitrogen Containing Organic Compounds', 'Organic Halides and Organic Concepts',
    'Oxygen Containing Organic Compound-I', 'Oxygen Containing Organic Compound-II',
    'Oxygen Containing Organic Compounds-III', 'p-Block Element-II', 'p-Block Elements-I',
    'Qualitative Analysis', 'Solid State', 'Stoichiometry-I and II',
    'Surf., Bio., Practical Org. Chem. and Polymers', 'Thermodynamics and Thermochemistry',
  ],
  Physics: [
    'Conductors and Dielectrics in an Electric Field',
    'Constant Electric Field in Vacuum',
    'DC Circuits and Capacitors',
    'Dynamics of a Particle',
    'Dynamics of a Solid Body',
    'EMI and AC Circuits',
    'Elastic Deformations of a Solid Body',
    'Electric Capacitance. Energy of an Electric Field',
    'Electric Current',
    'Electrostatics',
    'Energy and Momentum',
    'Equation of the Gas State. Processes',
    'Gaseous State and Thermodynamics',
    'Hydrodynamics',
    'Kinematics',
    'Kinematics of a particle',
    "Kinetic Theory of Gases. Boltzmann's Law and Maxwell's Distribution",
    'Laws of Conservation of Energy, Momentum, and Angular Momentum',
    'Liquids',
    'Liquids. Capillary Effects',
    'Magnetic Effects of Current',
    'Modern Physics',
    'Phase Transformations',
    'Properties of Matter',
    'Ray Optics and Wave Optics',
    'Relativistic Mechanics',
    'Rotation and Gravitation',
    'SHM',
    'The First Law of Thermodynamics. Heat Capacity',
    'The Fundamental Equation of Dynamics',
    'The Second Law of Thermodynamics. Entropy',
    'Thermodynamics',
    'Transport Phenomena',
    'Universal Gravitation',
    'Wave Motion',
    'Work, Power and Energy',
  ],
  Mathematics: [
    'Application of Derivatives',
    'Area Under Curves',
    'Binomial Theorem',
    'Circle',
    'Complex Numbers',
    'Compound Angles',
    'Conic Sections',
    'Continuity, Differentiability and Differentiation',
    'Determinants',
    'Differential Calculus-1',
    'Differential Calculus-2',
    'Differential Equations',
    'Ellipse',
    'Function',
    'Functions',
    'Hyperbola',
    'Indefinite and Definite Integration',
    'Integral Calculus-1',
    'Integral Calculus-2',
    'Inverse Trigonometric Functions',
    'Limit',
    'Matrices',
    'Matrices and Determinants',
    'Parabola',
    'Permutation and Combination',
    'Permutation and Combinations',
    'Probability',
    'Quadratic Equations',
    'Sequence and Series',
    'Sets Relations Functions',
    'Solution of Triangles',
    'Straight Line',
    'Straight Lines',
    'Three Dimensional Geometry',
    'Trigonometric Equations',
    'Trigonometry',
    'Vector & 3Dimensional Geometry',
    'Vectors',
  ],
  Biology: [],
};

const emptyQuestion = () => ({
  subject: 'Mathematics',
  topic: '',
  q_type: 'single_correct',
  difficulty: 'medium',
  question_text: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  marks: 4,
  solution: '',
});

function extractRealInteger(val) {
  if (val === null || val === undefined) return null;
  const raw = String(typeof val === 'object' ? (val.value ?? '') : val).trim();
  if (!raw) return null;
  if (/^-?\d+$/.test(raw)) return raw;
  const cleaned = raw
    .replace(/\\text\{[^}]*\}/g, '')
    .replace(/\\mathrm\{[^}]*\}/g, '')
    .replace(/[\$\s]/g, '')
    .replace(/(km\/h|m\/s|cm\/s|m\/s\^2|cm|mm|km|m|s|min|h|kg|g|N|J|W|V|A|C|T|Hz|rad\/s|rad|deg|degrees|°)/gi, '');
  if (/^-?\d+$/.test(cleaned)) return cleaned;
  if (/^-?\d+\.0+$/.test(cleaned)) return String(parseInt(cleaned, 10));
  return null;
}

function getAnswerDetails(q) {
  const options = Array.isArray(q.options) ? q.options : [];
  const rawAns = q.correct_answer;
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  // Numerical value: e.g. { value: "..." }
  if (rawAns?.value !== undefined && rawAns?.value !== null && rawAns?.value !== '') {
    const realInt = extractRealInteger(rawAns);
    const displayVal = realInt !== null ? realInt : String(rawAns.value);
    return {
      type: 'numerical',
      value: displayVal,
      display: displayVal,
      isCorrectIndex: () => false,
    };
  }

  // Multiple indices: { indices: [0, 2] }
  if (Array.isArray(rawAns?.indices) && rawAns.indices.length > 0) {
    const list = rawAns.indices.map(i => letters[i] ?? `Option ${i + 1}`);
    return {
      type: 'multiple',
      indices: rawAns.indices,
      display: list.join(', '),
      isCorrectIndex: (i) => rawAns.indices.includes(i),
    };
  }

  // Multiple letters: { letters: ['A', 'C'] }
  if (Array.isArray(rawAns?.letters) && rawAns.letters.length > 0) {
    return {
      type: 'multiple',
      letters: rawAns.letters,
      display: rawAns.letters.join(', '),
      isCorrectIndex: (i) => rawAns.letters.includes(letters[i]),
    };
  }

  // Single letter: { letter: 'B' }
  if (rawAns?.letter) {
    const l = String(rawAns.letter).toUpperCase().trim();
    const idx = letters.indexOf(l);
    return {
      type: 'single',
      index: idx >= 0 ? idx : null,
      letter: l,
      display: `Option ${l}`,
      isCorrectIndex: (i) => (idx >= 0 ? i === idx : letters[i] === l),
    };
  }

  // Single index: { index: 1 }
  const idx = rawAns?.index !== undefined && rawAns?.index !== null ? Number(rawAns.index) : null;
  if (idx !== null && !isNaN(idx)) {
    const letter = letters[idx] ?? `Option ${idx + 1}`;
    return {
      type: 'single',
      index: idx,
      letter: letters[idx] || null,
      display: `Option ${letter}`,
      isCorrectIndex: (i) => i === idx,
    };
  }

  // Primitive string or number
  if (typeof rawAns === 'string' || typeof rawAns === 'number') {
    const s = String(rawAns).trim();
    if (/^[A-F]$/i.test(s)) {
      const l = s.toUpperCase();
      const i = letters.indexOf(l);
      return {
        type: 'single',
        index: i,
        letter: l,
        display: `Option ${l}`,
        isCorrectIndex: (ind) => ind === i,
      };
    }
    return {
      type: 'numerical',
      value: s,
      display: s,
      isCorrectIndex: () => false,
    };
  }

  if (options.length > 0) {
    return {
      type: 'single',
      display: 'Not specified',
      isCorrectIndex: () => false,
    };
  }

  return {
    type: 'unknown',
    display: 'Not specified',
    isCorrectIndex: () => false,
  };
}

function formatType(t) {
  if (t === 'single_correct') return 'Single Choice';
  if (t === 'multi_correct') return 'Multiple Choice';
  if (t === 'numerical' || t === 'integer') return 'Numerical';
  if (t === 'subjective') return 'Subjective';
  return t ? t.replace(/_/g, ' ') : 'MCQ';
}

const QuestionBank = () => {
  const { setQuestions: setGlobalQuestions } = useAppData();

  // Read the logged-in user once; teachers are locked to their subject
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isTeacher = currentUser.role === 'teacher';
  const teacherSubject = isTeacher ? (currentUser.subject || '') : '';

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState(teacherSubject);
  const [chapterFilter, setChapterFilter] = useState('');
  const [topicInput, setTopicInput] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [qTypeFilter, setQTypeFilter] = useState('');
  const [diffFilter, setDiffFilter] = useState('');

  const [viewMode, setViewMode] = useState('cards'); // 'cards' | 'table'
  const [expandedSolutions, setExpandedSolutions] = useState({});

  const toggleSolution = (qId) => {
    setExpandedSolutions(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const [selected, setSelected] = useState([]);
  const [toast, setToast] = useState('');
  const [enlargedImage, setEnlargedImage] = useState(null);
  const [busy, setBusy] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyQuestion());
  const [modalError, setModalError] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Debounce the search box
  const debounceRef = useRef(null);
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setTopicFilter(topicInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput, topicInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        review_status: 'all',
      });
      if (search) params.set('search', search);
      if (subjectFilter) params.set('subject', subjectFilter);
      const effectiveTopic = chapterFilter || topicFilter;
      if (effectiveTopic) params.set('topic', effectiveTopic);
      if (qTypeFilter) params.set('q_type', qTypeFilter);
      if (diffFilter) params.set('difficulty', diffFilter);

      const res = await apiClient.get(`/questions?${params}`);
      setRows(res.data || []);
      setTotal(res.total || 0);
      setSelected([]);
    } catch (e) {
      showToast(e.message || 'Failed to load questions');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, subjectFilter, chapterFilter, topicFilter, qTypeFilter, diffFilter]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Mutations
  const openCreate = () => {
    setEditingId(null);
    setDraft(emptyQuestion());
    setModalError('');
    setModalOpen(true);
  };

  const openEdit = (q) => {
    setEditingId(q.id);
    const rawType = q.q_type || 'single_correct';
    const safeType = rawType === 'integer' ? 'numerical' : rawType;
    setDraft({
      subject: q.subject || 'Mathematics',
      topic: q.topic || '',
      q_type: safeType,
      difficulty: (q.difficulty || 'medium').toLowerCase(),
      question_text: q.question_text || '',
      options: Array.isArray(q.options) && q.options.length ? q.options : ['', '', '', ''],
      correctIndex: typeof q.correct_answer === 'object' && q.correct_answer?.index !== undefined
        ? q.correct_answer.index
        : 0,
      marks: q.marks || 4,
      solution: q.solution || '',
      image_url: q.image_url || '',
    });
    setModalError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      const isFreeText = draft.q_type === 'numerical' || draft.q_type === 'subjective';
      const options = isFreeText ? [] : draft.options;
      const correct_answer = isFreeText
        ? { value: draft.solution || '' }
        : { index: Number(draft.correctIndex) };

      const payload = {
        subject: draft.subject,
        topic: draft.topic,
        q_type: draft.q_type,
        difficulty: draft.difficulty,
        question_text: draft.question_text,
        options,
        correct_answer,
        marks: Number(draft.marks),
        solution: draft.solution,
      };

      if (editingId) {
        await apiClient.put(`/questions/${editingId}`, payload);
        showToast('Question updated.');
      } else {
        await apiClient.post('/questions', payload);
        showToast('Question added.');
      }
      setModalOpen(false);
      setModalError('');
      load();
    } catch (e) {
      const msg = e.message || 'Save failed — please try again.';
      setModalError(msg);
      showToast(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (q) => {
    if (!window.confirm('Delete this question? It will be removed from the bank.')) return;
    setBusy(true);
    try {
      await apiClient.delete(`/questions/${q.id}`);
      showToast('Question deleted.');
      load();
    } catch (e) {
      showToast(e.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicate = async (q) => {
    setBusy(true);
    try {
      await apiClient.post(`/questions/${q.id}/duplicate`, {});
      showToast('Question duplicated.');
      load();
    } catch (e) {
      showToast(e.message || 'Duplicate failed');
    } finally {
      setBusy(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!selected.length) return;
    if (!window.confirm(`Delete ${selected.length} selected question(s)?`)) return;
    setBusy(true);
    try {
      const res = await apiClient.post('/questions/bulk-delete', { ids: selected });
      showToast(`Deleted ${res.deleted} question(s).`);
      load();
    } catch (e) {
      showToast(e.message || 'Bulk delete failed');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (rows.length) setGlobalQuestions(rows); }, [rows, setGlobalQuestions]);

  const [uploadingPdf, setUploadingPdf] = useState(false);
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('examType', 'jee');
      await apiClient.post('/questions/bulk-upload-pdf', fd);
      showToast('PDF processed — questions added to queue.');
      load();
    } catch (err) {
      showToast(err.message || 'Upload failed');
    } finally {
      setUploadingPdf(false);
      e.target.value = '';
    }
  };

  const toggleRow = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const allSelected = rows.length > 0 && selected.length === rows.length;

  return (
    <div className="question-bank">
      {/* ── Page Header (Sleek & Uncluttered) ── */}
      <header className="page-header d-flex justify-between align-center">
        <div>
          <h1>Question Bank{teacherSubject ? ` — ${teacherSubject}` : ''}</h1>
        </div>
        <div className="qb-header-actions">
          <label className="qb-btn-upload-pdf" title="Upload question paper PDF">
            <Upload size={15} />
            <span>{uploadingPdf ? 'Uploading…' : 'Upload PDF'}</span>
            <input
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={handlePdfUpload}
              disabled={uploadingPdf}
            />
          </label>
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add new question
          </button>
        </div>
      </header>

      {toast && <div className="toast-notification">{toast}</div>}

      {/* ── Modern Controls & Filters Strip ── */}
      <div className="bank-controls">
        <div className="search-bar">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search questions by keyword or formula..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          {searchInput && (
            <button
              type="button"
              className="qb-search-clear"
              onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
              title="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        <div className="filters">
          {/* Subject: selectable only for admins without fixed subject */}
          {!isTeacher && (
            <select
              className="filter-select"
              value={subjectFilter}
              onChange={(e) => { setSubjectFilter(e.target.value); setChapterFilter(''); setPage(1); }}
            >
              <option value="">All subjects</option>
              {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {/* Chapter / Topic dropdown */}
          {subjectFilter && (CHAPTERS[subjectFilter] || []).length > 0 && (
            <select
              className="filter-select"
              value={chapterFilter}
              onChange={(e) => { setChapterFilter(e.target.value); setPage(1); }}
            >
              <option value="">All chapters</option>
              {(CHAPTERS[subjectFilter] || []).map(ch => (
                <option key={ch} value={ch}>{ch}</option>
              ))}
            </select>
          )}

          {/* Question Type Filter */}
          <select
            className="filter-select"
            value={qTypeFilter}
            onChange={(e) => { setQTypeFilter(e.target.value); setPage(1); }}
          >
            <option value="">All types</option>
            <option value="single_correct">Single choice</option>
            <option value="multi_correct">Multiple choice</option>
            <option value="numerical">Numerical</option>
            <option value="subjective">Subjective</option>
          </select>

          {/* Difficulty Filter */}
          <select
            className="filter-select"
            value={diffFilter}
            onChange={(e) => { setDiffFilter(e.target.value); setPage(1); }}
          >
            <option value="">All difficulties</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>

          {/* View Mode Toggle: Cards vs Table */}
          <div className="qb-view-toggle">
            <button
              type="button"
              className={`qb-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              title="Cards view with options and answers"
            >
              <LayoutGrid size={15} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              className={`qb-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
              title="Table view"
            >
              <List size={15} />
              <span>Table</span>
            </button>
          </div>

          <div className="qb-total-pill" title="Total active questions">
            <Database size={13} />
            <span>{total} Questions</span>
          </div>
        </div>
      </div>

      {/* ── Bulk Actions Bar ── */}
      {selected.length > 0 && (
        <div className="qb-bulk-bar">
          <span className="qb-bulk-count">{selected.length} question(s) selected</span>
          <button className="qb-bulk-danger" onClick={handleBulkDelete} disabled={busy}>
            <Trash2 size={15} /> Delete selected
          </button>
          <button className="qb-bulk-ghost" onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      {/* ── MAIN CONTENT AREA ── */}
      {viewMode === 'cards' ? (
        <div className="qb-cards-panel">
          {/* Top selection bar */}
          <div className="qb-cards-header-bar">
            <label className="qb-select-all-label">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => setSelected(e.target.checked ? rows.map(q => q.id) : [])}
              />
              <span>Select all on page ({rows.length})</span>
            </label>
            <span className="qb-cards-count-hint">Showing page {page} of {totalPages}</span>
          </div>

          {loading && (
            <div className="qb-state-box">
              <Loader2 size={24} className="qb-spin" />
              <p>Loading questions…</p>
            </div>
          )}

          {!loading && rows.length === 0 && (
            <div className="qb-state-box empty">
              <p className="qb-empty-title">No questions found</p>
              <p className="qb-empty-sub">Try adjusting your keyword search or filter criteria.</p>
            </div>
          )}

          {!loading && (
            <div className="qb-cards-list">
              {rows.map((q) => {
                const ansDetails = getAnswerDetails(q);
                const rawOptions = Array.isArray(q.options) ? q.options : [];
                const hasOptions = rawOptions.length > 0;
                const hasCorrectTicked = hasOptions && rawOptions.some((_, idx) => ansDetails.isCorrectIndex(idx));
                const isExpandedSol = !!expandedSolutions[q.id];
                const isSelected = selected.includes(q.id);

                return (
                  <div key={q.id} className={`qb-card ${isSelected ? 'selected' : ''}`}>
                    {/* ── Card Header: Badges & Actions ── */}
                    <div className="qb-card-header">
                      <div className="qb-card-badges">
                        <input
                          type="checkbox"
                          className="qb-card-checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(q.id)}
                          aria-label="Select question"
                        />
                        <span className="qb-badge-subject">{q.subject}</span>
                        <span className="qb-badge-type">{formatType(q.q_type)}</span>
                        {q.topic && <span className="qb-badge-topic" title={q.topic}>{q.topic}</span>}
                        <span className={`qb-badge-diff ${(q.difficulty || 'medium').toLowerCase()}`}>
                          {q.difficulty || 'Medium'}
                        </span>
                      </div>

                      <div className="qb-card-actions">
                        <button className="qb-btn-edit" title="Edit question" onClick={() => openEdit(q)}>
                          <Edit size={14} />
                          <span>Edit</span>
                        </button>
                        <button className="qb-btn-copy" title="Duplicate question" disabled={busy} onClick={() => handleDuplicate(q)}>
                          <Copy size={14} />
                          <span>Duplicate</span>
                        </button>
                        <button className="qb-btn-delete" title="Delete question" disabled={busy} onClick={() => handleDelete(q)}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* ── Question Body ── */}
                    <div className="qb-card-body">
                      {q.image_url && (
                        <div className="qb-image-wrap">
                          <img
                            src={q.image_url}
                            alt="Question diagram"
                            onClick={() => setEnlargedImage(q.image_url)}
                            className="qb-thumb"
                          />
                          <span className="qb-thumb-hint">Click image to enlarge</span>
                        </div>
                      )}
                      {q.question_text && (
                        <MathText as="div" className="qb-card-text" text={q.question_text || ''} />
                      )}
                    </div>

                    {/* ── Options Grid (Clear & Visible) ── */}
                    {hasOptions && (
                      <div className="qb-options-grid">
                        {rawOptions.map((opt, optIdx) => {
                          const isCorrect = ansDetails.isCorrectIndex(optIdx);
                          const optLetter = ['A', 'B', 'C', 'D', 'E', 'F'][optIdx] || String(optIdx + 1);
                          const optText = typeof opt === 'string' ? opt : (opt?.text ?? String(opt));

                          return (
                            <div
                              key={optIdx}
                              className={`qb-opt-item ${isCorrect ? 'is-correct' : ''}`}
                            >
                              <span className={`qb-opt-letter ${isCorrect ? 'is-correct' : ''}`}>
                                {optLetter}
                              </span>
                              <div className="qb-opt-content">
                                <MathText text={optText} />
                              </div>
                              {isCorrect && (
                                <span className="qb-opt-correct-tag">
                                  <Check size={12} /> Correct
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── Answer Callout Card (only for non-option questions or when no option was ticked) ── */}
                    {!hasCorrectTicked ? (
                      <div className="qb-answer-card">
                        <div className="qb-ans-row">
                          <div className="qb-ans-icon">
                            <CheckCircle2 size={15} />
                          </div>
                          <span className="qb-ans-label">Correct Answer:</span>
                          <div className="qb-ans-val-box">
                            {ansDetails.type === 'numerical' ? (
                              <span className="qb-ans-numerical">
                                <MathText text={ansDetails.display} />
                              </span>
                            ) : ansDetails.type === 'multiple' ? (
                              <span className="qb-ans-badge multiple">
                                Options: {ansDetails.display}
                              </span>
                            ) : (
                              <span className="qb-ans-badge single">
                                {ansDetails.display}
                              </span>
                            )}
                          </div>

                          {q.solution && (
                            <button
                              type="button"
                              className="qb-sol-toggle"
                              onClick={() => toggleSolution(q.id)}
                            >
                              {isExpandedSol ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                              <span>{isExpandedSol ? 'Hide Solution' : 'View Solution'}</span>
                            </button>
                          )}
                        </div>

                        {q.solution && isExpandedSol && (
                          <div className="qb-sol-content">
                            <div className="qb-sol-title">Solution / Explanation:</div>
                            <MathText text={q.solution} />
                          </div>
                        )}
                      </div>
                    ) : q.solution ? (
                      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button
                          type="button"
                          className="qb-sol-toggle"
                          style={{ alignSelf: 'flex-start' }}
                          onClick={() => toggleSolution(q.id)}
                        >
                          {isExpandedSol ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          <span>{isExpandedSol ? 'Hide Solution' : 'View Solution'}</span>
                        </button>
                        {isExpandedSol && (
                          <div className="qb-sol-content">
                            <div className="qb-sol-title">Solution / Explanation:</div>
                            <MathText text={q.solution} />
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ── Tabular Data View ── */
        <div className="table-container">
          <table className="bank-table">
            <thead>
              <tr>
                <th className="qb-check-col">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => setSelected(e.target.checked ? rows.map((q) => q.id) : [])}
                    aria-label="Select all questions on this page"
                  />
                </th>
                <th className="preview-col">Question preview</th>
                <th>Subject</th>
                <th>Topic</th>
                <th>Type</th>
                <th>Difficulty</th>
                <th>Answer</th>
                <th className="actions-col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="8" className="qb-state">
                    <Loader2 size={18} className="qb-spin" /> Loading questions…
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan="8" className="qb-state">No questions match your filters.</td>
                </tr>
              )}

              {!loading && rows.map((q) => {
                const ans = getAnswerDetails(q);
                return (
                  <tr key={q.id} className={selected.includes(q.id) ? 'qb-row-selected' : ''}>
                    <td className="qb-check-col">
                      <input
                        type="checkbox"
                        checked={selected.includes(q.id)}
                        onChange={() => toggleRow(q.id)}
                        aria-label="Select question"
                      />
                    </td>
                    <td className="preview-col">
                      {q.image_url ? (
                        <img
                          src={q.image_url}
                          alt="Question preview"
                          loading="lazy"
                          onClick={() => setEnlargedImage(q.image_url)}
                          className="qb-thumb"
                        />
                      ) : (
                        <MathText
                          as="p"
                          className="q-preview-text"
                          text={q.question_text || 'No content provided.'}
                        />
                      )}
                    </td>
                    <td>{q.subject}</td>
                    <td>{q.topic || 'General'}</td>
                    <td>{formatType(q.q_type)}</td>
                    <td>
                      <span className={`diff-badge ${(q.difficulty || 'medium').toLowerCase()}`}>
                        {q.difficulty || 'medium'}
                      </span>
                    </td>
                    <td>
                      <strong className="qb-answer">
                        <MathText text={ans.display} />
                      </strong>
                    </td>
                    <td className="actions-col">
                      <div className="row-actions">
                        <button className="action-btn" title="Edit" onClick={() => openEdit(q)}>
                          <Edit size={16} />
                        </button>
                        <button className="action-btn" title="Duplicate" disabled={busy} onClick={() => handleDuplicate(q)}>
                          <Copy size={16} />
                        </button>
                        <button className="action-btn danger" title="Delete" disabled={busy} onClick={() => handleDelete(q)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modern Pagination Bar ── */}
      <div className="qb-pagination-bar">
        <div className="qb-pagination-left">
          <span className="qb-rows-label">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="qb-page-size-select"
          >
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="qb-page-summary">
            {total === 0
              ? '0 questions'
              : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} questions`}
          </span>
        </div>

        <div className="qb-pagination-right">
          <button
            className={`qb-page-nav-btn ${page <= 1 ? 'disabled' : ''}`}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            title="Previous page"
          >
            <ChevronLeft size={16} />
            <span>Prev</span>
          </button>
          <span className="qb-page-indicator">
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </span>
          <button
            className={`qb-page-nav-btn ${page >= totalPages ? 'disabled' : ''}`}
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            title="Next page"
          >
            <span>Next</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Edit / Create Modal ── */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <h2>{editingId ? 'Edit Question' : 'Add New Question'}</h2>
              <button className="close-btn" onClick={() => setModalOpen(false)} aria-label="Close dialog" title="Close"><X size={20} /></button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Subject</label>
                  <select value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}>
                    {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>Topic</label>
                  <input
                    type="text"
                    placeholder="e.g. Kinematics"
                    value={draft.topic}
                    onChange={(e) => setDraft({ ...draft, topic: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Type</label>
                  <select value={draft.q_type} onChange={(e) => setDraft({ ...draft, q_type: e.target.value })}>
                    <option value="single_correct">Single MCQ</option>
                    <option value="multi_correct">Multi MCQ</option>
                    <option value="numerical">Numerical</option>
                    <option value="subjective">Subjective</option>
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>Difficulty</label>
                  <select value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })}>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>{d[0].toUpperCase() + d.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>Marks</label>
                  <input
                    type="number" min={1} max={20}
                    value={draft.marks}
                    onChange={(e) => setDraft({ ...draft, marks: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Question content</label>
                {draft.image_url ? (
                  <div style={{ background: '#f6f1e6', padding: 12, borderRadius: 8, border: '1px solid var(--border-color)', textAlign: 'center' }}>
                    <img src={draft.image_url} alt="Question" style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 4 }} />
                  </div>
                ) : (
                  <>
                    <div className="rich-editor">
                      <div className="editor-toolbar">
                        <span className="qb-latex-hint">
                          <ImageIcon size={14} /> LaTeX supported — wrap maths in $…$ or $$…$$
                        </span>
                      </div>
                      <textarea
                        className="editor-textarea"
                        placeholder="Type your question here. e.g. Find $\int_0^1 x^2\,dx$"
                        value={draft.question_text}
                        onChange={(e) => setDraft({ ...draft, question_text: e.target.value })}
                      />
                    </div>
                    {draft.question_text && (
                      <div className="qb-preview">
                        <span className="qb-preview-label">Preview</span>
                        <MathText text={draft.question_text} />
                      </div>
                    )}
                  </>
                )}
              </div>

              {draft.q_type === 'numerical' || draft.q_type === 'subjective' ? (
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label>Correct answer / solution</label>
                  <input
                    type="text"
                    placeholder="e.g. 42 or formula expression"
                    value={draft.solution}
                    onChange={(e) => setDraft({ ...draft, solution: e.target.value })}
                  />
                </div>
              ) : (
                <div className="options-section">
                  <label>Options (mark the correct answer)</label>
                  {['A', 'B', 'C', 'D'].map((opt, idx) => (
                    <div key={opt} className="option-row">
                      <input
                        type="radio"
                        name="correct-opt"
                        className="correct-radio"
                        checked={Number(draft.correctIndex) === idx}
                        onChange={() => setDraft({ ...draft, correctIndex: idx })}
                      />
                      <span className="opt-label">{opt}</span>
                      <input
                        type="text"
                        className="opt-input"
                        placeholder={`Option ${opt}`}
                        value={draft.options[idx]}
                        onChange={(e) => {
                          const options = [...draft.options];
                          options[idx] = e.target.value;
                          setDraft({ ...draft, options });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              {modalError && (
                <div style={{ color: '#b3352b', fontSize: 13, fontWeight: 500, flex: 1, textAlign: 'left' }}>{modalError}</div>
              )}
              <button className="btn-outline" onClick={() => { setModalOpen(false); setModalError(''); }}>Cancel</button>
              <button className="btn-primary" onClick={handleSave} disabled={busy}>
                {busy ? 'Saving…' : editingId ? 'Save Changes' : 'Save Question'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image Lightbox ── */}
      {enlargedImage && (
        <div className="qb-lightbox" onClick={() => setEnlargedImage(null)}>
          <img src={enlargedImage} alt="Enlarged question" onClick={(e) => e.stopPropagation()} />
          <button className="qb-lightbox-close" onClick={() => setEnlargedImage(null)}>
            <X size={34} />
          </button>
        </div>
      )}
    </div>
  );
};

export default QuestionBank;
