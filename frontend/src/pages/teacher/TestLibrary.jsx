import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppData } from '../../context/AppDataContext';
import { apiClient } from '../../api/client';
import TestPDFExportModal from './TestPDFExportModal';
import {
  FileText,
  Plus,
  Search,
  Calendar,
  Clock,
  Edit3,
  BarChart3,
  Zap,
  Trophy,
  Stethoscope,
  Settings,
  Award,
  Check,
  FileDown
} from 'lucide-react';
import './TestLibrary.css';

const TestLibrary = () => {
  const { tests = [] } = useAppData();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userSubject = user.subject || '';

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'published' | 'draft' | 'my'

  /* PDF Export */
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfTestData, setPdfTestData] = useState(null);
  const [pdfQuestions, setPdfQuestions] = useState([]);
  const [exportingPdfId, setExportingPdfId] = useState(null);

  const handleExportPdf = async (test) => {
    setExportingPdfId(test.id);
    try {
      const fullTest = await apiClient.get(`/tests/${test.id}`);
      const qs = (fullTest.test_questions || [])
        .map(tq => ({
          ...(tq.questions || {}),
          marks: tq.marks_override || tq.questions?.marks || 4,
          question_order: tq.question_order,
        }))
        .sort((a, b) => (a.question_order || 0) - (b.question_order || 0));

      setPdfTestData(fullTest);
      setPdfQuestions(qs);
      setPdfModalOpen(true);
    } catch (e) {
      console.error('Failed to export test as PDF:', e);
      alert(e.message || 'Failed to load test questions for PDF export');
    } finally {
      setExportingPdfId(null);
    }
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Helper to get pattern details
  const getPatternInfo = (test) => {
    const raw = String(test.paper_pattern || test.t_type || '').toLowerCase();
    if (raw.includes('neet')) {
      return {
        label: 'NEET',
        icon: Stethoscope,
        className: 'pattern-tag-neet',
        defaultDesc: 'Comprehensive 180-question pre-medical test covering Physics, Chemistry, and Biology.',
        defaultTotalQ: 180,
        defaultMarks: 720,
      };
    }
    if (raw.includes('jee_advanced') || raw.includes('jee adv')) {
      return {
        label: 'JEE Advanced',
        icon: Trophy,
        className: 'pattern-tag-adv',
        defaultDesc: 'Advanced mock exam with 25 questions per subject (20 MCQs and 5 Numericals).',
        defaultTotalQ: 75,
        defaultMarks: 300,
      };
    }
    if (raw.includes('jee_main') || raw.includes('jee main')) {
      return {
        label: 'JEE Main',
        icon: Zap,
        className: 'pattern-tag-main',
        defaultDesc: 'Full 75-question syllabus mock paper with single-choice MCQs & numerical integer questions.',
        defaultTotalQ: 75,
        defaultMarks: 300,
      };
    }
    return {
      label: 'Custom paper',
      icon: Settings,
      className: 'pattern-tag-custom',
      defaultDesc: 'Custom institutional exam shell with tailored subject sections and quotas.',
      defaultTotalQ: test.total_questions || 25,
      defaultMarks: test.total_marks || 100,
    };
  };

  // Helper to compute teacher's subject quota progress
  const getTeacherProgress = (test) => {
    if (!userSubject || userSubject === 'All') return null;

    const pattern = String(test.paper_pattern || test.t_type || '').toLowerCase();
    const isNeet = pattern.includes('neet');
    const isAdv  = pattern.includes('jee_advanced') || pattern.includes('jee adv');

    let target = 25;
    if (isNeet) {
      target = userSubject === 'Biology' ? 90 : 45;
    } else if (isAdv) {
      target = userSubject === 'Biology' ? 0 : 25;
    } else {
      target = userSubject === 'Biology' ? 0 : 25;
    }

    if (target === 0) return null; // Subject not applicable to this exam

    const qList = test.test_questions || [];
    const added = qList.filter(
      (q) => (q.questions?.subject || q.subject || '').toLowerCase() === userSubject.toLowerCase()
    ).length;

    const pct = Math.min(100, Math.round((added / target) * 100));
    const isComplete = added >= target;

    return { added, target, pct, isComplete, subject: userSubject };
  };

  // Filtered tests
  const filteredTests = useMemo(() => {
    return tests.filter((t) => {
      const matchSearch =
        !search ||
        (t.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.subject || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.paper_pattern || '').toLowerCase().includes(search.toLowerCase());

      if (!matchSearch) return false;

      if (activeFilter === 'published') return t.status === 'published';
      if (activeFilter === 'draft') return t.status === 'draft';
      if (activeFilter === 'my') return t.created_by === user.id;

      return true;
    });
  }, [tests, search, activeFilter, user.id]);

  return (
    <div className="test-library">
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <h1 className="library-main-title">Test library</h1>
          <p className="library-main-subtitle">
            Manage your exam papers, track question quotas, and review assessment analytics.
          </p>
        </div>
        {user.role === 'admin' && (
          <button className="library-btn-primary" onClick={() => navigate('/admin/test-initiation')}>
            <Plus size={18} />
            <span>Initiate new test</span>
          </button>
        )}
      </div>

      {/* ── Filter Bar & Search ── */}
      <div className="library-toolbar">
        <div className="library-search-box">
          <Search size={18} className="library-search-icon" />
          <input
            type="text"
            placeholder="Search papers by name, pattern, or subject..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="library-filter-tabs">
          {[
            { id: 'all', label: `All Papers (${tests.length})` },
            { id: 'published', label: 'Published' },
            { id: 'draft', label: 'Drafts' },
            { id: 'my', label: 'Created by Me' },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`library-tab-btn ${activeFilter === tab.id ? 'active' : ''}`}
              onClick={() => setActiveFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tests Cards Grid ── */}
      <div className="tests-grid ink-cycle ink-cards">
        {filteredTests.length === 0 ? (
          <div className="empty-state">
            <FileText size={48} color="#998f7d" />
            <h3>No tests match your filter</h3>
            <p>
              {search
                ? 'Try adjusting your search keyword or clearing the filters.'
                : user.role === 'admin'
                ? 'Get started by initiating your first test shell.'
                : 'Tests you are assigned to will appear here once initiated.'}
            </p>
          </div>
        ) : (
          filteredTests.map((test) => {
            const patternInfo = getPatternInfo(test);
            const PatternIcon = patternInfo.icon;
            const isOwner = test.created_by === user.id;
            const progress = getTeacherProgress(test);
            const totalQ = test.test_questions?.length || 0;
            const duration = test.duration_minutes || 180;
            const marks = test.total_marks || patternInfo.defaultMarks;

            return (
              <div key={test.id} className="test-card-modern">
                {/* ── 1. Top Tags Bar ── */}
                <div className="tc-top-bar">
                  <div className={`tc-pattern-pill ${patternInfo.className}`}>
                    <PatternIcon size={13} />
                    <span>{patternInfo.label}</span>
                  </div>

                  <div className="tc-top-right-tags">
                    <span
                      className={`tc-status-pill ${
                        test.status === 'published' ? 'tc-status-published' : 'tc-status-draft'
                      }`}
                    >
                      <span className="tc-status-dot" />
                      {test.status === 'published' ? 'Published' : 'Draft'}
                    </span>

                    <span className={`tc-role-pill ${isOwner ? 'tc-role-owner' : 'tc-role-collab'}`}>
                      {isOwner ? 'Creator' : 'Assigned'}
                    </span>
                  </div>
                </div>

                {/* ── 2. Title & Description ── */}
                <div className="tc-body">
                  <h3 className="tc-title" title={test.title}>
                    {test.title}
                  </h3>
                  <p className="tc-desc">
                    {test.description && test.description !== 'No description provided.'
                      ? test.description
                      : patternInfo.defaultDesc}
                  </p>
                </div>

                {/* ── 3. Exam Metrics Pills ── */}
                <div className="tc-metrics-row">
                  <div className="tc-metric-chip" title="Duration">
                    <Clock size={13} />
                    <span>{duration} mins</span>
                  </div>
                  <div className="tc-metric-chip" title="Total marks">
                    <Award size={13} />
                    <span>{marks} Marks</span>
                  </div>
                  <div className="tc-metric-chip" title="Total questions">
                    <FileText size={13} />
                    <span>{totalQ} Qs added</span>
                  </div>
                  <div className="tc-metric-chip" title="Initiated date">
                    <Calendar size={13} />
                    <span>{formatDate(test.created_at)}</span>
                  </div>
                </div>

                {/* ── 4. Teacher Section Quota Progress Bar ── */}
                {progress && (
                  <div className="tc-progress-box">
                    <div className="tc-progress-header">
                      <span className="tc-progress-label">
                        <strong>{progress.subject}</strong> Quota:
                      </span>
                      <span
                        className="tc-progress-value"
                        style={{ color: progress.isComplete ? '#2f6b3a' : 'var(--accent)' }}
                      >
                        {progress.added} / {progress.target} Qs ({progress.pct}%)
                      </span>
                    </div>

                    <div className="tc-progress-track">
                      <div
                        className={`tc-progress-fill ${progress.isComplete ? 'fill-complete' : ''}`}
                        style={{ width: `${progress.pct}%` }}
                      />
                    </div>

                    {progress.isComplete && (
                      <div className="tc-complete-banner">
                        <Check size={12} /> Quota Met — Section Ready!
                      </div>
                    )}
                  </div>
                )}

                {/* ── 5. Action Buttons ── */}
                <div className="tc-footer">
                  {test.status === 'published' && (
                    <button
                      className="tc-btn-secondary"
                      onClick={() => navigate(`/teacher/test-results/${test.id}`)}
                      title="View test performance and student results"
                    >
                      <BarChart3 size={15} />
                      <span>Results</span>
                    </button>
                  )}

                  <button
                    className="tc-btn-secondary"
                    onClick={() => handleExportPdf(test)}
                    title="Export question paper as PDF (subject-wise)"
                    disabled={exportingPdfId === test.id}
                  >
                    {exportingPdfId === test.id ? <Clock size={15} /> : <FileDown size={15} />}
                    <span>{exportingPdfId === test.id ? 'Loading…' : 'PDF'}</span>
                  </button>

                  <button
                    className="tc-btn-primary"
                    onClick={() =>
                      navigate(
                        `/teacher/test-constructor/${test.id}${
                          test.created_by !== user.id ? '?step=2' : ''
                        }`
                      )
                    }
                    title={isOwner ? 'Edit test configuration' : 'Add questions for your subject'}
                  >
                    <Edit3 size={15} />
                    <span>{isOwner ? 'Edit Paper' : 'Add Questions'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Subject-Wise PDF Export Modal ── */}
      {pdfModalOpen && (
        <TestPDFExportModal
          isOpen={pdfModalOpen}
          onClose={() => setPdfModalOpen(false)}
          testData={pdfTestData}
          selectedQuestions={pdfQuestions}
        />
      )}
    </div>
  );
};

export default TestLibrary;
