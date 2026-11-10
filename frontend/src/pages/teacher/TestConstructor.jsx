import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Check, ChevronRight, ChevronLeft, Search, Plus, Trash2, FileText, Settings, ListChecks, CheckCircle2, Clock, AlertCircle, Layers, ChevronDown, ChevronUp, FileDown, Calendar, Users, Award, Info, ShieldAlert, Lock
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { apiClient } from '../../api/client';
import MathText from '../../components/MathText';
import TestPDFExportModal from './TestPDFExportModal';
import AutoGenerateTestModal from './AutoGenerateTestModal';
import { extractRealInteger, getQuestionType } from '../../utils/autoFill';
import {
  getPattern, patternIdOf, patternTotals, kindOfQuestion, canonicalSubject,
  subjectQuota, paperQuota, validatePaper, patternSummary, KIND_LABEL, STANDARD_PATTERN_IDS,
} from '../../utils/examPatterns';
import './TestConstructor.css';

// Chapter / topic list per subject — mirrors QuestionBank.jsx
const CHAPTERS = {
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

function getCleanSnippet(q, maxLen = 45) {
  const rawText = (typeof q === 'string') ? q : (q?.question_text || q?.text || '');
  if (!rawText) {
    if (q?.image_url) return 'Image question';
    return 'Question';
  }
  let clean = rawText
    .replace(/\s*\[\s*cite[^\]]*\]/gi, '') // AI citation leftovers
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\mathbf\{([^}]*)\}/g, '$1')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^}]*)\}/g, '√($1)')
    .replace(/\$+/g, '') // remove math dollar signs
    .replace(/\\[a-zA-Z]+/g, ' ') // remove other latex commands
    .replace(/\s+/g, ' ')
    .trim();

  if (clean.length > maxLen) {
    return clean.substring(0, maxLen).trim() + '…';
  }
  return clean || 'Question';
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

  // Fallback if options exist but correct_answer is missing
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

const TestConstructor = () => {
  const navigate = useNavigate();
  const { testId } = useParams();
  const [searchParams] = useSearchParams();
  const { questions, batches, refreshTests, setSidebarCollapsed } = useAppData();
  const [step, setStep] = useState(searchParams.get('step') === '2' ? 2 : 1);

  // Automatically collapse sidebar into icon-only mode when on Step 2 (Select Questions)
  // to maximize horizontal space for browsing and adding exam questions.
  useEffect(() => {
    if (step === 2) {
      if (typeof setSidebarCollapsed === 'function') {
        setSidebarCollapsed(true);
      }
    } else {
      if (typeof setSidebarCollapsed === 'function') {
        setSidebarCollapsed(false);
      }
    }
    return () => {
      if (typeof setSidebarCollapsed === 'function') {
        setSidebarCollapsed(false);
      }
    };
  }, [step, setSidebarCollapsed]);

  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [isPdfExportOpen, setIsPdfExportOpen] = useState(false);
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [expandedSolutions, setExpandedSolutions] = useState({});

  const toggleSolution = (qId) => {
    setExpandedSolutions(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';
  const userSubject = user.subject && user.subject !== 'All' ? user.subject : null;

  const [reviewSubjectTab, setReviewSubjectTab] = useState(userSubject || 'Physics');
  const [subjectFilter, setSubjectFilter] = useState(userSubject || '');
  const [topicFilter, setTopicFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortBy, setSortBy] = useState('default');

  // ── Server-side paginated question bank ──────────────────────────────────
  const [bankPage, setBankPage]         = useState(1);
  const [bankPageSize, setBankPageSize] = useState(10);
  const [bankTotal, setBankTotal]       = useState(0);
  const [bankPages, setBankPages]       = useState(1);
  const [bankLoading, setBankLoading]   = useState(false);
  const [bankData, setBankData]         = useState([]);
  const [bankError, setBankError]       = useState(null);
  const [bankReloadKey, setBankReloadKey] = useState(0);

  // Reset topic filter when subject changes

  // Fetch a page of questions from the server whenever filters/page changes
  useEffect(() => {
    let cancelled = false;
    const fetchBank = async () => {
      setBankLoading(true);
      setBankError(null);
      try {
        const params = new URLSearchParams({
          page: String(bankPage),
          limit: String(bankPageSize),
          review_status: 'all',
        });
        if (subjectFilter || userSubject) params.set('subject', subjectFilter || userSubject);
        if (topicFilter)  params.set('topic', topicFilter);
        if (typeFilter) {
          // Map UI value → possible raw db values so backend eq filter matches
          const typeMap = { mcq: 'single_correct', nat: 'numerical' };
          params.set('q_type', typeMap[typeFilter] || typeFilter);
        }
        if (searchQuery) params.set('search', searchQuery);
        const res = await apiClient.get(`/questions?${params}`);
        if (cancelled) return;
        const rows = Array.isArray(res) ? res : (res?.data ?? []);
        setBankData(rows);
        setBankTotal(res?.total ?? rows.length);
        setBankPages(res?.totalPages ?? 1);
      } catch (e) {
        console.error('Failed to fetch question bank:', e);
        if (!cancelled) {
          setBankError(e.message || 'Failed to load questions from server');
          setBankData([]);
        }
      } finally {
        if (!cancelled) setBankLoading(false);
      }
    };
    fetchBank();
    return () => { cancelled = true; };
  }, [bankPage, bankPageSize, subjectFilter, topicFilter, typeFilter, searchQuery, bankReloadKey]);

  // Reset to page 1 when filters change
  useEffect(() => { setBankPage(1); }, [subjectFilter, topicFilter, typeFilter, searchQuery, bankPageSize]);

  // Toast State
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Step 1 State
  const [testData, setTestData] = useState({
    title: '',
    subject: userSubject || 'Physics',
    duration: 180,
    totalMarks: 300,
    negativeMarking: true,
    negativeMarks: 1,
    date: '',
    time: '',
    targetBatches: [],
    paper_pattern: 'jee_main',
    t_type: 'jee_main'
  });

  // Topics come from the hardcoded chapter map (same source as QuestionBank).
  // Must sit below `testData`: reading it any earlier is a TDZ ReferenceError
  // that blanks the whole constructor.
  const activeSubject = userSubject || (testData.subject && testData.subject !== 'Mixed' ? testData.subject : (subjectFilter || 'Physics'));
  const availableTopics = CHAPTERS[activeSubject] || CHAPTERS[subjectFilter] || CHAPTERS['Physics'] || [];

  const [existingTest, setExistingTest] = useState(null);
  const isInitiator = !existingTest || existingTest.created_by === user.id;

  useEffect(() => {
    if (testId) {
      apiClient.get(`/tests/${testId}`).then(data => {
        // Same rule the server uses (utils/examPatterns): the paper_pattern
        // column, else the pattern written into the title / instructions.
        const inferredPattern = patternIdOf(data)
          || (data.paper_pattern === 'custom' || data.t_type === 'quiz' ? 'custom' : 'jee_main');
        const inferredSpec = getPattern(inferredPattern);

        setExistingTest(data);
        setTestData(prev => ({
          ...prev,
          title: data.title,
          subject: data.subject || prev.subject,
          paper_pattern: inferredPattern,
          t_type: inferredPattern,
          instructions: data.instructions || prev.instructions,
          duration: inferredSpec ? inferredSpec.durationMinutes : (data.duration_minutes || 60),
          totalMarks: inferredSpec ? patternTotals(inferredSpec).marks : (data.total_marks || 100),
          // Read from the real columns, falling back to the old description
          // convention for tests created before the migration.
          negativeMarking: data.negative_marking ?? !!data.description?.includes('Negative Marking'),
          negativeMarks: data.negative_marks ?? prev.negativeMarks,
        }));
        if (data.test_questions) {
          const qs = data.test_questions
            .filter(tq => tq.questions)
            .map(tq => {
              const qObj = Array.isArray(tq.questions) ? tq.questions[0] : tq.questions;
              return { ...qObj, marks: tq.marks_override || qObj?.marks || 4 };
            })
            .filter(q => q && q.id);
          if (userSubject) {
            setSelectedQuestions(qs.filter(q => String(q.subject || '').trim().toLowerCase() === userSubject.trim().toLowerCase()));
          } else {
            setSelectedQuestions(qs);
          }
        }
        // Collaborator teacher is entering this test to add questions for their subject!
        if (data.created_by && data.created_by !== user.id) {
          setStep(2);
        }
      }).catch(err => showToast('Failed to load test: ' + err.message));
    }
  }, [testId]);

  // Calculate total marks when questions change
  useEffect(() => {
    const newTotal = selectedQuestions.reduce((sum, q) => sum + (q.marks || 4), 0);
    setTestData(prev => ({ ...prev, totalMarks: newTotal }));
  }, [selectedQuestions]);

  const handleNext = () => setStep(prev => Math.min(prev + 1, 3));
  const handlePrev = () => setStep(prev => Math.max(prev - 1, 1));

  const saveToBackend = async (status) => {
    try {
      let scheduledStart = undefined;
      let scheduledEnd = undefined;

      if (testData.date && testData.time) {
        scheduledStart = new Date(`${testData.date}T${testData.time}`).toISOString();
      }

      // Default the close of the window to 7 days out when only a start is given,
      // so the backend's scheduled_end check has something meaningful to enforce.
      if (scheduledStart && !scheduledEnd) {
        scheduledEnd = new Date(
          new Date(scheduledStart).getTime() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString();
      }

      const payload = {
        title: testData.title || (isJeeAdv ? 'JEE Advanced Test' : isNeet ? 'NEET Test' : 'JEE Main Test'),
        description: testData.description || `Subject: ${testData.subject}`,
        instructions: testData.instructions,
        subject: testData.subject,
        // May be a plain kind ('quiz') or a pattern ('jee_main'); the API accepts
        // either here and splits them server-side.
        t_type: testData.t_type || 'jee_main',
        paper_pattern: testData.paper_pattern || testData.t_type || 'jee_main',
        duration_minutes: parseInt(testData.duration, 10) || 180,
        total_marks: testData.totalMarks || 300,
        status: status,
        // Real columns now — grading applies the penalty server-side.
        negative_marking: !!testData.negativeMarking,
        negative_marks: testData.negativeMarking ? Number(testData.negativeMarks) || 0 : 0,
        question_ids: selectedQuestions.map(q => q.id),
        batch_ids: testData.targetBatches,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd
      };

      if (status === 'published' && pattern) {
        // The official pattern, checked the same way the server checks it. A
        // subject teacher's share is checked for their subject only.
        const problems = validatePaper(pattern, selectedQuestions, isInitiator ? null : userSubject);
        if (problems.length) {
          showToast(`Cannot publish: this paper does not follow the official ${pattern.label} pattern — ${problems.slice(0, 3).join('; ')}${problems.length > 3 ? '…' : ''}`);
          return;
        }
      }

      if (testId) {
        // 1. Save questions first so that the paper has questions and marks are recalculated
        await apiClient.post(`/tests/${testId}/questions`, { question_ids: payload.question_ids });

        if (isInitiator) {
          await apiClient.patch(`/tests/${testId}`, {
            title: payload.title,
            description: payload.description,
            instructions: payload.instructions,
            subject: payload.subject,
            t_type: payload.t_type,
            paper_pattern: payload.paper_pattern,
            duration_minutes: payload.duration_minutes,
            total_marks: payload.total_marks,
            negative_marking: payload.negative_marking,
            negative_marks: payload.negative_marks
          });
          if (status === 'published' && existingTest.status === 'draft') {
            await apiClient.patch(`/tests/${testId}/publish`);
          }
          if (payload.batch_ids.length > 0 && scheduledStart) {
            await apiClient.post(`/tests/${testId}/assign`, {
              batch_ids: payload.batch_ids,
              scheduled_start: payload.scheduled_start,
              scheduled_end: payload.scheduled_end
            });
          }
        }
      } else {
        await apiClient.post('/tests/constructor', payload);
      }

      await refreshTests();

      showToast(`Test ${status === 'draft' ? 'saved as draft' : 'published'} successfully!`);
      const returnPath = isAdmin ? '/admin/test-initiation' : '/teacher/test-library';
      setTimeout(() => navigate(returnPath), 1500);
    } catch (err) {
      console.error(err);
      showToast(`Failed to ${status === 'draft' ? 'save draft' : 'publish'}: ` + err.message);
    }
  };

  const handleSaveDraft = () => saveToBackend('draft');
  const handlePublish = () => saveToBackend('published');

  // Quota & targets — all from the official blueprint (utils/examPatterns).
  const isCustom  = testData.paper_pattern === 'custom' || (testData.t_type === 'quiz' && !testData.paper_pattern);
  const patternId = isCustom
    ? null
    : (STANDARD_PATTERN_IDS.includes(testData.paper_pattern)
        ? testData.paper_pattern
        : patternIdOf({ ...existingTest, title: testData.title || existingTest?.title }) || 'jee_main');
  const pattern   = getPattern(patternId);
  const isJeeAdv  = Boolean(patternId && patternId.startsWith('jee_advanced'));
  const isNeet    = patternId === 'neet';
  const isJeeMain = patternId === 'jee_main';

  const isSingleSubject = Boolean(
    (userSubject && userSubject !== 'All' && userSubject !== 'Mixed') ||
    (testData.subject && testData.subject !== 'Mixed' && testData.subject !== 'All') ||
    (existingTest?.subject && existingTest?.subject !== 'Mixed' && existingTest?.subject !== 'All')
  );

  // The subject this screen is filling: a subject teacher's own, or a
  // single-subject paper's. Otherwise the whole paper.
  const scopeSubject = pattern
    ? canonicalSubject(userSubject || (isSingleSubject ? (testData.subject || existingTest?.subject) : null), pattern)
    : null;
  const quota = pattern
    ? (scopeSubject ? subjectQuota(pattern, scopeSubject) : paperQuota(pattern))
    : null;

  let targetTotal = 25;
  let targetMcq   = 20;
  let targetNat   = 5;
  let quotaPatternName = 'Custom Paper';

  if (pattern) {
    quotaPatternName = `${pattern.label} pattern`;
    targetTotal = quota.total;
    targetMcq   = quota.single + quota.multi;
    targetNat   = quota.numerical;
  } else {
    // Custom test: use the total written into its instructions if there is one.
    const descMatch = (existingTest?.instructions || existingTest?.description || '').match(/Total Questions:\s*(\d+)/i);
    if (descMatch) {
      targetTotal = parseInt(descMatch[1], 10);
      targetMcq   = Math.round(targetTotal * 0.8);
      targetNat   = targetTotal - targetMcq;
    }
  }

  /** Why a question cannot be added under the pattern (null when it can). */
  const patternBlockReason = (q, current = selectedQuestions) => {
    if (!pattern) return null;
    const subject = canonicalSubject(q.subject, pattern);
    if (!subject) return `${q.subject || 'This subject'} is not part of ${pattern.label}`;
    const kind = kindOfQuestion(q, pattern);
    if (!kind) {
      return pattern.numericAnswer === 'integer' && /numer|integer|nat/i.test(String(q.q_type || ''))
        ? `${pattern.label} numericals need a whole-number answer`
        : `${pattern.label} does not use this question type`;
    }
    const want = subjectQuota(pattern, subject)[kind];
    const have = current.filter(sq => canonicalSubject(sq.subject, pattern) === subject && kindOfQuestion(sq, pattern) === kind).length;
    if (want === 0) return `${pattern.label} has no ${KIND_LABEL[kind].toLowerCase()} questions`;
    if (have >= want) return `${subject} ${KIND_LABEL[kind].toLowerCase()} full (${have}/${want})`;
    return null;
  };

  const toggleQuestion = (q) => {
    if (userSubject && userSubject !== q.subject) {
      showToast(`You can only modify ${userSubject} questions.`);
      return;
    }

    const isSelected = selectedQuestions.find(sq => sq.id === q.id);

    if (isSelected) {
      setSelectedQuestions(selectedQuestions.filter(sq => sq.id !== q.id));
    } else {
      const blocked = patternBlockReason(q);
      if (blocked) {
        showToast(`Cannot add: ${blocked}.`);
        return;
      }

      setSelectedQuestions([...selectedQuestions, q]);
    }
  };

  const StepIndicator = () => (
    <div className="step-indicator">
      {[1, 2, 3].map(s => (
        <React.Fragment key={s}>
          <div className={`step-circle ${step >= s ? 'active' : ''} ${step > s ? 'completed' : ''}`}>
            {step > s ? <Check size={16} /> : s}
          </div>
          {s < 3 && <div className={`step-line ${step > s ? 'active' : ''}`}></div>}
        </React.Fragment>
      ))}
    </div>
  );

  // Count relevant selected questions
  const relevantSelected = userSubject
    ? selectedQuestions.filter(q => q.subject === userSubject)
    : selectedQuestions;

  const addedCount    = relevantSelected.length;
  const questionsLeft = Math.max(0, targetTotal - addedCount);
  const progressPct   = Math.min(100, Math.round((addedCount / targetTotal) * 100));

  const kindOf = (q) => (pattern
    ? kindOfQuestion(q, pattern)
    : (getQuestionType(q) === 'nat' ? 'numerical' : getQuestionType(q) === 'mcq' ? 'single' : null));
  const mcqAdded = relevantSelected.filter(q => ['single', 'multi'].includes(kindOf(q))).length;
  const natAdded = relevantSelected.filter(q => kindOf(q) === 'numerical').length;
  const mcqLeft  = Math.max(0, targetMcq - mcqAdded);
  const natLeft  = Math.max(0, targetNat - natAdded);

  return (
    <>
      <div className="test-constructor">
        <header className="page-header d-flex justify-between align-center">
          <div>
            {/* A teacher only ever reaches this page to fill in an assigned
                paper; building one from scratch is an admin action. */}
            <h1>{isInitiator ? 'Test Constructor' : 'Add Questions'}</h1>
          </div>
          <div className="header-actions">
            {step === 2 && (
              <button
                type="button"
                className="btn-autofill"
                onClick={() => setIsAutoModalOpen(true)}
                title="Auto-fill questions using JEE Advanced / Main patterns & topic weightages"
              >
                <ListChecks size={16} />
                <span>Auto-Fill Test</span>
              </button>
            )}
            <button className="btn-outline" onClick={handleSaveDraft}>
              {isInitiator ? 'Save Draft' : 'Save Questions'}
            </button>
            {step < 3 ? (
              <button className="btn-primary" onClick={handleNext}>Next step <ChevronRight size={18} /></button>
            ) : (
              isInitiator ? (
                <button className="btn-primary success-bg" onClick={handlePublish}>Publish test</button>
              ) : (
                <button className="btn-primary success-bg" onClick={handleSaveDraft}>Save questions</button>
              )
            )}
          </div>
        </header>

      {toast && <div className="toast-notification">{toast}</div>}

      <div className="constructor-container">
        <div className="constructor-sidebar">
          <div className="tc-stepper-rail">
            {[
              { num: 1, label: 'Metadata', icon: Settings, title: '1. Test Metadata' },
              { num: 2, label: 'Questions', icon: ListChecks, title: '2. Add Questions' },
              { num: 3, label: 'Review', icon: FileText, title: '3. Review & Publish' },
            ].map(({ num, label, icon: Icon, title }, idx) => (
              <React.Fragment key={num}>
                <button
                  type="button"
                  className={`tc-rail-step ${step === num ? 'active' : ''} ${step > num ? 'completed' : ''}`}
                  onClick={() => setStep(num)}
                  title={title}
                >
                  <div className="tc-rail-circle">
                    {step > num ? <Check size={16} /> : <Icon size={16} />}
                  </div>
                  <span className="tc-rail-label">{label}</span>
                </button>
                {idx < 2 && <div className={`tc-rail-line ${step > num ? 'active' : ''}`} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="constructor-content">
          {step === 1 && (
            <div className="step-pane step-1 tc-meta-pane">
              {/* Header Title & Subtitle */}
              <div className="tc-meta-intro">
                <div className="tc-meta-intro-left">
                  <div className="tc-meta-badge-tag">
                    <Settings size={14} />
                    <span>Configuration phase</span>
                  </div>
                  <h2 className="tc-meta-main-title">Assessment metadata & settings</h2>
                  <p className="tc-meta-main-desc">
                    Review paper details, scoring rules, and assigned cohorts before building your question paper.
                  </p>
                </div>
                {(isJeeMain || isJeeAdv || isNeet) && (
                  <div className="tc-meta-pattern-badge">
                    <FileText size={14} />
                    <span>{pattern ? pattern.label : 'Custom'}</span>
                  </div>
                )}
              </div>

              {!isInitiator && (
                <div className="tc-collab-banner">
                  <div className="tc-collab-icon-box">
                    <Users size={20} />
                  </div>
                  <div className="tc-collab-body">
                    <strong>Collaborator Mode: Subject Question Contributor</strong>
                    <p>
                      This paper was initialized by an administrator. Metadata and scheduling are locked. You can proceed to Step 2 to add or edit questions for <strong>{userSubject || testData.subject || 'your subject'}</strong>.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-primary tc-collab-btn"
                    onClick={() => setStep(2)}
                  >
                    <span>Proceed to Questions</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* Grid of structured configuration cards */}
              <div className="tc-meta-cards-grid">
                {/* Card 1: Paper Configuration */}
                <div className="tc-meta-card">
                  <div className="tc-meta-card-head">
                    <div className="tc-meta-card-icon-box">
                      <FileText size={17} />
                    </div>
                    <div>
                      <h3 className="tc-meta-card-title">Paper details</h3>
                      <span className="tc-meta-card-sub">Title, duration, and assessment format</span>
                    </div>
                    {userSubject && (
                      <span className="tc-subject-badge-pill">
                        {userSubject}
                      </span>
                    )}
                  </div>

                  <div className="tc-meta-field">
                    <label className="tc-meta-label">
                      <span>Test title</span>
                      <span className="tc-req">*</span>
                    </label>
                    <input
                      type="text"
                      className="tc-meta-input"
                      placeholder="e.g. Full Syllabus Mock Test #3"
                      value={testData.title}
                      onChange={e => setTestData({ ...testData, title: e.target.value })}
                      disabled={!isInitiator}
                    />
                  </div>

                  <div className="tc-meta-field">
                    <label className="tc-meta-label">
                      <span>Duration (Minutes)</span>
                    </label>
                    <div className="tc-input-unit-wrap">
                      <input
                        type="number"
                        min="5"
                        max="360"
                        className="tc-meta-input tc-input-has-unit"
                        value={testData.duration}
                        onChange={e => setTestData({ ...testData, duration: Math.max(1, parseInt(e.target.value) || 0) })}
                        disabled={!isInitiator}
                      />
                      <span className="tc-input-unit">mins</span>
                    </div>
                    {isInitiator && (
                      <div className="tc-presets-row">
                        {[30, 45, 60, 90, 180].map(mins => (
                          <button
                            key={mins}
                            type="button"
                            className={`tc-preset-chip ${Number(testData.duration) === mins ? 'active' : ''}`}
                            onClick={() => setTestData({ ...testData, duration: mins })}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="tc-meta-field">
                    <label className="tc-meta-label">Assessment pattern</label>
                    <div className="tc-pattern-tabs">
                      {STANDARD_PATTERN_IDS.map(id => {
                        const spec = getPattern(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            className={`tc-pattern-tab ${patternId === id ? 'active' : ''}`}
                            onClick={() => isInitiator && setTestData({ ...testData, t_type: id, paper_pattern: id, duration: spec.durationMinutes, totalMarks: patternTotals(spec).marks })}
                            disabled={!isInitiator}
                            title={`${spec.authority} · ${spec.edition}`}
                          >
                            <span className="tc-pt-title">{spec.label}</span>
                            <span className="tc-pt-desc">{patternSummary(id)}</span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        className={`tc-pattern-tab ${isCustom ? 'active' : ''}`}
                        onClick={() => isInitiator && setTestData({ ...testData, t_type: 'quiz', paper_pattern: 'custom', duration: 60, totalMarks: 100 })}
                        disabled={!isInitiator}
                      >
                        <span className="tc-pt-title">Custom / quiz</span>
                        <span className="tc-pt-desc">Flexible question mix & custom quotas</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card 2: Scheduling & Target Batches */}
                <div className="tc-meta-card">
                  <div className="tc-meta-card-head">
                    <div className="tc-meta-card-icon-box">
                      <Calendar size={17} />
                    </div>
                    <div>
                      <h3 className="tc-meta-card-title">Schedule & target batches</h3>
                      <span className="tc-meta-card-sub">Window availability and assigned student cohorts</span>
                    </div>
                  </div>

                  <div className="tc-meta-two-col">
                    <div className="tc-meta-field">
                      <label className="tc-meta-label">Schedule Date (Optional)</label>
                      <input
                        type="date"
                        className="tc-meta-input"
                        value={testData.date}
                        onChange={e => setTestData({ ...testData, date: e.target.value })}
                        disabled={!isInitiator}
                      />
                    </div>
                    <div className="tc-meta-field">
                      <label className="tc-meta-label">Schedule Time (Optional)</label>
                      <input
                        type="time"
                        className="tc-meta-input"
                        value={testData.time}
                        onChange={e => setTestData({ ...testData, time: e.target.value })}
                        disabled={!isInitiator}
                      />
                    </div>
                  </div>

                  <div className="tc-meta-field" style={{ marginTop: '12px' }}>
                    <div className="tc-batches-head">
                      <label className="tc-meta-label" style={{ marginBottom: 0 }}>Target batches</label>
                      <span className="tc-batches-count">
                        {(testData.targetBatches || []).length} of {batches?.length || 0} Batches Selected
                      </span>
                    </div>

                    <div className="tc-batch-pills-list">
                      {!batches || batches.length === 0 ? (
                        <div className="tc-batch-empty-hint">No batches created in system.</div>
                      ) : (
                        batches.map(b => {
                          const isAssigned = (testData.targetBatches || []).includes(b.id);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              className={`tc-batch-tag ${isAssigned ? 'selected' : ''}`}
                              onClick={() => {
                                if (!isInitiator) return;
                                const current = testData.targetBatches || [];
                                const next = current.includes(b.id)
                                  ? current.filter(id => id !== b.id)
                                  : [...current, b.id];
                                setTestData({ ...testData, targetBatches: next });
                              }}
                              disabled={!isInitiator}
                              title={isInitiator ? 'Click to toggle assignment' : 'Assignment locked by initiator'}
                            >
                              <div className={`tc-batch-tag-box ${isAssigned ? 'checked' : ''}`}>
                                {isAssigned && <Check size={12} strokeWidth={3} />}
                              </div>
                              <span className="tc-batch-tag-name">{b.name}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Navigation CTA strip */}
              <div className="tc-meta-footer-cta">
                <div className="tc-meta-footer-info">
                  <Info size={16} className="tc-meta-footer-icon" />
                  <span>
                    {isInitiator
                      ? 'Settings configured? Move to Step 2 to add questions from your repository.'
                      : 'You can now proceed to Step 2 to manage questions for your subject.'}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-primary tc-meta-next-btn"
                  onClick={handleNext}
                >
                  <span>Proceed to Select Questions</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="step-pane step-2">
              {/* ── Compact Squeezed Header & Live Quota Tracker Strip ── */}
              <div className="tc-compact-tracker">
                <div className="tc-tracker-row-main">
                  {/* Left: Title + Context */}
                  <div className="tc-tracker-title-group">
                    <h2 className="tc-tracker-title">Select questions</h2>
                    <div className="tc-tracker-paper-badge">
                      <span className="tc-t-name">{testData.title || existingTest?.title || (userSubject ? `${userSubject} Test` : 'JEE Main Mock Test')}</span>
                      <span className="tc-t-pattern">{quotaPatternName}</span>
                      {userSubject && <span className="tc-t-subject">{userSubject}</span>}
                    </div>
                  </div>

                  {/* Center: Live Quota Metrics & Breakdown in one slim row! */}
                  <div className="tc-tracker-metrics-row">
                    {/* Added / Target metric */}
                    <div className="tc-metric-pill added" title="Questions added so far">
                      <span className="tc-pill-label">Added:</span>
                      <strong className="tc-pill-val">{addedCount} / {targetTotal}</strong>
                    </div>

                    {/* Questions Left metric */}
                    <div className={`tc-metric-pill remaining ${questionsLeft === 0 ? 'complete' : ''}`} title="Questions remaining">
                      <span className="tc-pill-label">Left:</span>
                      <strong className="tc-pill-val">{questionsLeft}</strong>
                    </div>

                    {/* Section A filter chip */}
                    {(isJeeMain || targetMcq > 0) && (
                      <button
                        type="button"
                        className={`tc-filter-pill ${typeFilter === 'mcq' ? 'active' : ''}`}
                        onClick={() => { setTypeFilter(typeFilter === 'mcq' ? '' : 'mcq'); setBankPage(1); }}
                        title="Filter to Section A (MCQs)"
                      >
                        <span className="tc-pill-sec">Sec A (MCQ):</span>
                        <strong>{mcqAdded}/{targetMcq}</strong>
                        <span className="tc-chip-sub">({mcqLeft} left)</span>
                      </button>
                    )}

                    {/* Section B filter chip */}
                    {(isJeeMain || targetNat > 0) && (
                      <button
                        type="button"
                        className={`tc-filter-pill ${typeFilter === 'nat' ? 'active' : ''}`}
                        onClick={() => { setTypeFilter(typeFilter === 'nat' ? '' : 'nat'); setBankPage(1); }}
                        title="Filter to Section B (Numericals)"
                      >
                        <span className="tc-pill-sec">Sec B (Numerical):</span>
                        <strong>{natAdded}/{targetNat}</strong>
                        <span className="tc-chip-sub">({natLeft} left)</span>
                      </button>
                    )}

                    {typeFilter && (
                      <button
                        type="button"
                        className="tc-filter-reset-pill"
                        onClick={() => { setTypeFilter(''); setBankPage(1); }}
                        title="Show all question types"
                      >
                        All types
                      </button>
                    )}

                    {/* Total Marks */}
                    <div className="tc-metric-pill marks" title="Total paper marks">
                      
                      <span>{selectedQuestions.reduce((sum, q) => sum + (q.marks || 4), 0)} pts</span>
                    </div>
                  </div>

                  {/* Right: Status Tag & View Selected button */}
                  <div className="tc-tracker-actions">
                    {questionsLeft === 0 ? (
                      <span className="tc-status-mini complete">
                        <CheckCircle2 size={13} /> Quota met
                      </span>
                    ) : addedCount > targetTotal ? (
                      <span className="tc-status-mini exceed">
                        <AlertCircle size={13} /> +{addedCount - targetTotal} Over
                      </span>
                    ) : (
                      <span className="tc-status-mini pending">
                        <Clock size={13} /> {questionsLeft} Needed
                      </span>
                    )}


                  </div>
                </div>

                {/* Sleek 3px Progress Line at the bottom */}
                <div className="tc-compact-progress-track">
                  <div
                    className={`tc-compact-progress-bar ${questionsLeft === 0 ? 'complete' : ''}`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              {/* ── Question Builder (Bank + Selected) with Increased Space ── */}
              <div className="question-builder">
                {/* ── Full-Width Question Bank Panel ── */}
                <div className="tc-bank-panel">
                  {/* Unified Compact 1-Line Search, Filter & Sort Toolbar */}
                  <div className="tc-compact-toolbar">
                    <div className="tc-search-input-wrap">
                      <Search size={15} className="tc-search-icon" />
                      <input
                        type="text"
                        className="tc-search-input"
                        placeholder="Search questions by keyword..."
                        value={searchQuery}
                        onChange={e => {
                          setSearchQuery(e.target.value);
                          setBankPage(1);
                        }}
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          className="tc-search-clear"
                          onClick={() => {
                            setSearchQuery('');
                            setBankPage(1);
                          }}
                          title="Clear search"
                        >
                          &times;
                        </button>
                      )}
                    </div>

                    <select
                      value={topicFilter}
                      onChange={e => { setTopicFilter(e.target.value); setBankPage(1); }}
                      className="tc-select tc-select-topic"
                      title="Filter by Topic"
                    >
                      <option value="">All topics</option>
                      {availableTopics.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>

                    <select
                      value={typeFilter}
                      onChange={e => { setTypeFilter(e.target.value); setBankPage(1); }}
                      className="tc-select tc-select-type"
                      title="Filter by Question Type"
                    >
                      <option value="">All types</option>
                      <option value="mcq">MCQ</option>
                      <option value="nat">Numerical</option>
                    </select>

                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                      className="tc-select tc-select-sort"
                      title="Sort questions"
                    >
                      <option value="default">Sort: Default</option>
                      <option value="diff_asc">Difficulty: Easy → Hard</option>
                      <option value="diff_desc">Difficulty: Hard → Easy</option>
                      <option value="topic_asc">Topic: A → Z</option>
                    </select>
                  </div>

                  {/* Question cards list */}
                  <div className="tc-question-list">
                    {bankLoading && (
                      <div className="tc-loading-state">
                        <div className="tc-spinner" />
                        <p>Loading questions…</p>
                      </div>
                    )}
                    {!bankLoading && bankError && (
                      <div className="tc-empty-state" style={{ borderColor: '#e2b6aa', background: '#f5e2da' }}>
                        <p className="tc-empty-title" style={{ color: '#b3352b' }}>Failed to load questions</p>
                        <p className="tc-empty-sub" style={{ color: '#b3352b', marginBottom: 12 }}>{bankError}</p>
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ fontSize: 13, padding: '6px 14px' }}
                          onClick={() => setBankReloadKey(k => k + 1)}
                        >
                          Retry
                        </button>
                      </div>
                    )}
                    {!bankLoading && !bankError && bankData.length === 0 && (
                      <div className="tc-empty-state">
                        <p className="tc-empty-title">No questions found</p>
                        <p className="tc-empty-sub">Try adjusting your filters or search keywords.</p>
                      </div>
                    )}
                    {!bankLoading && bankData
                      .filter(q => q.q_type !== 'subjective' && (q.options?.length > 0 || extractRealInteger(q.correct_answer) !== null))
                      .sort((a, b) => {
                        if (sortBy === 'diff_asc') {
                          const diffMap = { easy: 1, medium: 2, hard: 3 };
                          return (diffMap[a.difficulty?.toLowerCase()] || 2) - (diffMap[b.difficulty?.toLowerCase()] || 2);
                        }
                        if (sortBy === 'diff_desc') {
                          const diffMap = { easy: 1, medium: 2, hard: 3 };
                          return (diffMap[b.difficulty?.toLowerCase()] || 2) - (diffMap[a.difficulty?.toLowerCase()] || 2);
                        }
                        if (sortBy === 'topic_asc') {
                          return (a.topic || '').localeCompare(b.topic || '');
                        }
                        return 0;
                      })
                      .map(q => {
                      const isSelected = !!selectedQuestions.find(sq => sq.id === q.id);
                      const qType = getQuestionType(q);
                      const typeLabel = q.type === 'single_correct' ? 'Single Choice'
                        : q.type === 'multi_correct' ? 'Multiple Choice'
                        : q.type === 'numerical' ? 'Numerical'
                        : (qType === 'mcq' ? 'MCQ' : 'Numerical');

                      const ansDetails = getAnswerDetails(q);
                      const rawOptions = Array.isArray(q.options) ? q.options : [];
                      const hasOptions = rawOptions.length > 0;
                      const hasCorrectTicked = hasOptions && rawOptions.some((_, idx) => ansDetails.isCorrectIndex(idx));
                      const isExpandedSol = !!expandedSolutions[q.id];

                      // Same rule as adding: the official blueprint's per-section counts.
                      const quotaReason = !isSelected ? (patternBlockReason(q) || '') : '';
                      const isQuotaFull = Boolean(quotaReason);

                      return (
                        <div key={q.id} className={`tc-q-card ${isSelected ? 'selected' : ''}`}>
                          {/* ── Card Header ── */}
                          <div className="tc-q-card-header">
                            <div className="tc-q-badges">
                              {q.topic && <span className="tc-q-topic-badge" title={q.topic}>{q.topic}</span>}
                              <span className={`tc-q-diff ${q.difficulty ? q.difficulty.toLowerCase() : 'medium'}`}>
                                {q.difficulty || 'Medium'}
                              </span>
                            </div>

                            <div className="tc-q-header-actions">
                              <button
                                type="button"
                                className={`tc-btn-action ${isSelected ? 'tc-btn-remove' : isQuotaFull ? 'tc-btn-quota-full' : 'tc-btn-add'}`}
                                onClick={() => toggleQuestion(q)}
                                title={isQuotaFull ? quotaReason : isSelected ? 'Remove question' : 'Add question'}
                              >
                                {isSelected ? (
                                  <>
                                    <Check size={14} /> Added
                                  </>
                                ) : isQuotaFull ? (
                                  <>
                                    <Lock size={12} /> {quotaReason}
                                  </>
                                ) : (
                                  <>
                                    <Plus size={14} /> Add question
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* ── Question Content ── */}
                          <div className="tc-q-body">
                            {q.image_url && (
                              <div className="tc-q-image-container">
                                <img
                                  src={q.image_url}
                                  alt="Question diagram"
                                  onClick={() => setLightboxUrl(q.image_url)}
                                  className="tc-q-image"
                                />
                                <span className="tc-q-image-hint">Click image to enlarge</span>
                              </div>
                            )}
                            {q.question_text && (
                              <MathText as="div" className="tc-q-text" text={q.question_text || q.text || ''} />
                            )}
                          </div>

                          {/* ── Options Section (when available) ── */}
                          {hasOptions && (
                            <div className="tc-q-options-wrapper">
                              <div className="tc-q-options-grid">
                                {rawOptions.map((opt, optIdx) => {
                                  const isCorrect = ansDetails.isCorrectIndex(optIdx);
                                  const optLetter = ['A', 'B', 'C', 'D', 'E', 'F'][optIdx] || String(optIdx + 1);
                                  const optText = typeof opt === 'string' ? opt : (opt?.text ?? String(opt));

                                  return (
                                    <div
                                      key={optIdx}
                                      className={`tc-q-option-item ${isCorrect ? 'is-correct' : ''}`}
                                    >
                                      <span className={`tc-opt-letter ${isCorrect ? 'is-correct' : ''}`}>
                                        {optLetter}
                                      </span>
                                      <div className="tc-opt-content">
                                        <MathText text={optText} />
                                      </div>
                                      {isCorrect && (
                                        <span className="tc-opt-correct-tag">
                                          <Check size={12} /> Correct
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* ── Answer Section:
                               Only shown for non-option questions (numerical/subjective) where answer is not ticked in options.
                               For questions with options, the correct option is already highlighted in the options grid above.
                          ── */}
                          {!hasCorrectTicked ? (
                            <div className="tc-q-answer-card">
                              <div className="tc-ans-header-row">
                                <div className="tc-ans-icon-wrap">
                                  <CheckCircle2 size={16} />
                                </div>
                                <span className="tc-ans-label">Correct Answer:</span>
                                <div className="tc-ans-value-box">
                                  {ansDetails.type === 'numerical' ? (
                                    <span className="tc-ans-numerical">
                                      <MathText text={ansDetails.display} />
                                    </span>
                                  ) : ansDetails.type === 'multiple' ? (
                                    <span className="tc-ans-badge multiple">
                                      Options: {ansDetails.display}
                                    </span>
                                  ) : (
                                    <span className="tc-ans-badge single">
                                      {ansDetails.display}
                                    </span>
                                  )}
                                </div>
                                {q.solution && (
                                  <button
                                    type="button"
                                    className="tc-solution-toggle-btn"
                                    onClick={() => toggleSolution(q.id)}
                                  >
                                    {isExpandedSol ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    <span>{isExpandedSol ? 'Hide Solution' : 'View Solution'}</span>
                                  </button>
                                )}
                              </div>

                              {/* Collapsible Solution */}
                              {q.solution && isExpandedSol && (
                                <div className="tc-solution-content">
                                  <div className="tc-solution-title">Solution / Explanation:</div>
                                  <MathText text={q.solution} />
                                </div>
                              )}
                            </div>
                          ) : q.solution ? (
                            <div className="tc-q-solution-row">
                              <button
                                type="button"
                                className="tc-solution-toggle-btn"
                                onClick={() => toggleSolution(q.id)}
                              >
                                {isExpandedSol ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                <span>{isExpandedSol ? 'Hide Solution' : 'View Solution'}</span>
                              </button>
                              {isExpandedSol && (
                                <div className="tc-solution-content">
                                  <div className="tc-solution-title">Solution / Explanation:</div>
                                  <MathText text={q.solution} />
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── Pagination bar ── */}
                  <div className="tc-pagination-bar">
                    <div className="tc-pagination-info">
                      <span>Rows:</span>
                      <select
                        value={bankPageSize}
                        onChange={e => { setBankPageSize(Number(e.target.value)); setBankPage(1); }}
                        className="tc-pagination-select"
                      >
                        {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <span className="tc-pagination-total">({bankTotal} questions)</span>
                    </div>

                    <div className="tc-pagination-nav">
                      <button
                        type="button"
                        className="tc-page-btn"
                        onClick={() => setBankPage(p => Math.max(1, p - 1))}
                        disabled={bankPage === 1}
                        title="Previous page"
                      >
                        ‹
                      </button>

                      {(() => {
                        const pages = [];
                        const total = bankPages;
                        const cur = bankPage;
                        const add = (n) => pages.push(
                          <button
                            type="button"
                            key={n}
                            onClick={() => setBankPage(n)}
                            className={`tc-page-btn ${cur === n ? 'active' : ''}`}
                          >
                            {n}
                          </button>
                        );
                        const ellipsis = (k) => pages.push(<span key={k} className="tc-page-ellipsis">…</span>);

                        if (total <= 7) {
                          for (let i = 1; i <= total; i++) add(i);
                        } else {
                          add(1);
                          if (cur > 4) ellipsis('s');
                          const start = Math.max(2, cur - 2);
                          const end   = Math.min(total - 1, cur + 2);
                          for (let i = start; i <= end; i++) add(i);
                          if (cur < total - 3) ellipsis('e');
                          add(total);
                        }
                        return pages;
                      })()}

                      <button
                        type="button"
                        className="tc-page-btn"
                        onClick={() => setBankPage(p => Math.min(bankPages, p + 1))}
                        disabled={bankPage === bankPages}
                        title="Next page"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {step === 3 && (
            <div className="step-pane step-3">
              {/* Review Header Banner */}
              <div className="tc-review-header-bar">
                <div className="tc-review-header-left">
                  <div className="tc-review-badge-strip">
                    <span className="tc-review-step-pill">Step 3 · Final Review</span>
                    <span className="tc-review-paper-pill">{testData.title || 'Untitled Assessment'}</span>
                    <span className="tc-review-sub-pill">{testData.subject}</span>
                  </div>
                  <h2>Review & publish test</h2>
                  <p className="tc-review-sub">
                    Verify your test parameters and inspect all {selectedQuestions.length} selected questions before finalizing.
                  </p>
                </div>
                <div className="tc-review-header-actions">
                  <button
                    type="button"
                    className="tc-btn-export-pdf"
                    onClick={() => setIsPdfExportOpen(true)}
                    title="Export questions and test paper as PDF (subject-wise)"
                  >
                    <FileDown size={18} />
                    <span>Export as PDF</span>
                  </button>
                </div>
              </div>

              {/* Summary Parameters Card */}
              <div className="summary-card tc-review-summary-card">
                <div className="summary-header">
                  <div>
                    <h3>{testData.title || 'Untitled Test'}</h3>
                    <div className="tc-summary-subtext">
                      Pattern: <strong>{testData.t_type || 'Standard Quiz'}</strong> · Scope: <strong>{testData.subject}</strong>
                    </div>
                  </div>
                  <span className="subject-badge">{testData.subject}</span>
                </div>

                <div className="summary-grid ink-cycle ink-stats">
                  <div className="summary-item">
                    <span className="label">Duration</span>
                    <span className="value">{testData.duration} mins</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Total marks</span>
                    <span className="value">{testData.totalMarks}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Questions selected</span>
                    <span className="value">{selectedQuestions.length}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Negative marking</span>
                    <span className="value">{testData.negativeMarking ? `Yes (−${testData.negativeMarks})` : 'No'}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Scheduled window</span>
                    <span className="value">{testData.date ? `${testData.date} at ${testData.time}` : 'Unscheduled'}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Questions added</span>
                    <span className="value">{addedCount} / {targetTotal} Total</span>
                  </div>
                </div>

                {testData.targetBatches && testData.targetBatches.length > 0 && (
                  <div className="summary-section">
                    <h4>Assigned batches</h4>
                    <div className="batches-list">
                      {testData.targetBatches.map(bId => {
                        const batch = batches.find(b => b.id === bId);
                        return <span key={bId} className="batch-chip">{batch ? batch.name : bId}</span>;
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Questions Review List */}
              {(() => {
                const paperSubjects = [...new Set(selectedQuestions.map(q => q.subject).filter(Boolean))];
                const displayReviewQuestions = (reviewSubjectTab && reviewSubjectTab !== 'All')
                  ? selectedQuestions.filter(q => q.subject?.toLowerCase() === reviewSubjectTab.toLowerCase())
                  : selectedQuestions;

                return (
                  <div className="tc-review-questions-section">
                    <div className="tc-review-qs-header">
                      <div className="tc-rqs-title-group">
                        <h3>Questions Included in Paper ({displayReviewQuestions.length})</h3>
                        <p className="tc-rqs-hint">Review questions, KaTeX equations, options, and answers before publishing.</p>
                      </div>

                      {paperSubjects.length > 1 && (
                        <div className="tc-review-subject-tabs">
                          {paperSubjects.map(sub => {
                            const subCount = selectedQuestions.filter(q => q.subject?.toLowerCase() === sub.toLowerCase()).length;
                            const isAct = reviewSubjectTab.toLowerCase() === sub.toLowerCase();
                            return (
                              <button
                                key={sub}
                                type="button"
                                className={`tc-review-sub-tab ${isAct ? 'active' : ''}`}
                                onClick={() => setReviewSubjectTab(sub)}
                              >
                                <span>{sub}</span>
                                <span className="count-badge">{subCount}</span>
                              </button>
                            );
                          })}
                          <button
                            type="button"
                            className={`tc-review-sub-tab ${reviewSubjectTab === 'All' ? 'active' : ''}`}
                            onClick={() => setReviewSubjectTab('All')}
                          >
                            <span>All subjects</span>
                            <span className="count-badge">{selectedQuestions.length}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {displayReviewQuestions.length === 0 ? (
                      <div className="tc-review-empty-state">
                        <AlertCircle size={36} color="#998f7d" />
                        <h4>No {reviewSubjectTab !== 'All' ? reviewSubjectTab : ''} Questions Selected Yet</h4>
                        <p>Go back to Step 2 to pick or auto-fill questions from the question bank.</p>
                        <button type="button" className="btn-primary" onClick={() => setStep(2)}>
                          <Plus size={16} />
                          <span>Add questions</span>
                        </button>
                      </div>
                    ) : (
                      <div className="tc-review-questions-list">
                        {displayReviewQuestions.map((q, idx) => {
                          const ansDetails = getAnswerDetails(q);
                          const rawOptions = Array.isArray(q.options) ? q.options : [];
                          const hasOptions = rawOptions.length > 0;
                          const hasCorrectTicked = hasOptions && rawOptions.some((_, oIdx) => ansDetails.isCorrectIndex(oIdx));
                          const isExpandedSol = !!expandedSolutions[q.id];

                          return (
                            <div key={q.id || idx} className="tc-review-q-card">
                              <div className="tc-rq-top">
                                <div className="tc-rq-num-col">
                                  <span className="tc-rq-num">Q{idx + 1}</span>
                                </div>
                                <div className="tc-rq-meta-tags">
                                  {q.subject && (
                                    <span className={`tc-tag tc-tag-sub-badge ${q.subject.toLowerCase()}`}>
                                      {q.subject}
                                    </span>
                                  )}
                                  {q.topic && <span className="tc-tag tc-tag-topic">{q.topic}</span>}
                                  <span className={`tc-tag tc-tag-diff ${q.difficulty || 'medium'}`}>
                                    {q.difficulty || 'medium'}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className="tc-rq-remove-btn"
                                  onClick={() => toggleQuestion(q)}
                                  title="Remove question from paper"
                                >
                                  <Trash2 size={15} />
                                  <span>Remove</span>
                                </button>
                              </div>

                          <div className="tc-rq-body">
                            <MathText text={q.question_text || q.text || ''} />
                            {q.image_url && (
                              <div className="tc-rq-img-wrap" onClick={() => setLightboxUrl(q.image_url)}>
                                <img src={q.image_url} alt={`Diagram for Q${idx + 1}`} />
                              </div>
                            )}
                          </div>

                          {/* Options if MCQ */}
                          {Array.isArray(q.options) && q.options.length > 0 && (
                            <div className="tc-rq-options-grid">
                              {q.options.map((opt, optIdx) => {
                                const isCorrect = ansDetails.isCorrectIndex(optIdx);
                                const optLetter = ['A', 'B', 'C', 'D', 'E', 'F'][optIdx] || String(optIdx + 1);
                                const optText = typeof opt === 'string' ? opt : (opt?.text ?? String(opt));

                                return (
                                  <div
                                    key={optIdx}
                                    className={`tc-rq-opt-item ${isCorrect ? 'is-correct' : ''}`}
                                  >
                                    <span className={`tc-rq-opt-letter ${isCorrect ? 'is-correct' : ''}`}>
                                      {optLetter}
                                    </span>
                                    <div className="tc-rq-opt-content">
                                      <MathText text={optText} />
                                    </div>
                                    {isCorrect && (
                                      <span className="tc-rq-opt-correct-tag">
                                        <Check size={12} /> Correct
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Answer Row (only when no options are shown or no option was ticked) */}
                          {!hasCorrectTicked ? (
                            <div className="tc-rq-ans-strip">
                              <div className="tc-rq-ans-label-group">
                                <CheckCircle2 size={16} className="tc-rq-ans-icon" />
                                <span className="tc-rq-ans-title">Correct Answer:</span>
                                <div className="tc-rq-ans-val">
                                  {ansDetails.type === 'numerical' ? (
                                    <MathText text={ansDetails.display} />
                                  ) : (
                                    <span>{ansDetails.display}</span>
                                  )}
                                </div>
                              </div>

                              {q.solution && (
                                <button
                                  type="button"
                                  className="tc-rq-toggle-sol-btn"
                                  onClick={() => toggleSolution(q.id)}
                                >
                                  {isExpandedSol ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  <span>{isExpandedSol ? 'Hide Solution' : 'View Solution'}</span>
                                </button>
                              )}
                            </div>
                          ) : q.solution ? (
                            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                className="tc-rq-toggle-sol-btn"
                                onClick={() => toggleSolution(q.id)}
                              >
                                {isExpandedSol ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                <span>{isExpandedSol ? 'Hide Solution' : 'View Solution'}</span>
                              </button>
                            </div>
                          ) : null}

                          {/* Solution Accordion */}
                          {q.solution && isExpandedSol && (
                            <div className="tc-rq-sol-box">
                              <strong>Solution / Explanation:</strong>
                              <MathText text={q.solution} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

          <div className="step-navigation">
            {step > 1 ? (
              <button className="btn-outline" onClick={handlePrev}><ChevronLeft size={18} /> Previous</button>
            ) : <div></div>}
          </div>
        </div>
      </div>
    </div>

    {/* PDF Export Modal */}
    <TestPDFExportModal
      isOpen={isPdfExportOpen}
      onClose={() => setIsPdfExportOpen(false)}
      testData={testData}
      selectedQuestions={selectedQuestions}
    />

    {/* Smart Auto-Generate Test Modal */}
    {isAutoModalOpen && (
      <AutoGenerateTestModal
        onClose={() => setIsAutoModalOpen(false)}
        subject={activeSubject}
        userSubject={userSubject}
        availableTopics={availableTopics}
        currentSelected={selectedQuestions}
        targetTotal={targetTotal}
        targetNat={targetNat}
        patternName={quotaPatternName}
        patternId={patternId}
        onApply={(newQuestions, proceedToReview = false) => {
          setSelectedQuestions(newQuestions);
          if (proceedToReview) {
            setStep(3);
          }
        }}
        showToast={showToast}
      />
    )}

    {/* Image Lightbox */}
    {lightboxUrl && (
      <div
        onClick={() => setLightboxUrl(null)}
        style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'zoom-out', padding: '24px'
        }}
      >
        <button
          onClick={() => setLightboxUrl(null)}
          aria-label="Close image preview"
          title="Close image preview"
          style={{
            position: 'absolute', top: '16px', right: '20px',
            background: 'rgba(255,255,255,0.15)', border: 'none',
            color: '#fff', fontSize: '28px', cursor: 'pointer',
            borderRadius: '50%', width: '40px', height: '40px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1
          }}
        >&times;</button>
        <img
          src={lightboxUrl}
          alt="Question enlarged"
          onClick={e => e.stopPropagation()}
          style={{
            maxWidth: '90vw', maxHeight: '90vh',
            borderRadius: '8px', boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
            objectFit: 'contain'
          }}
        />
      </div>
    )}
    </>
  );
};

export default TestConstructor;