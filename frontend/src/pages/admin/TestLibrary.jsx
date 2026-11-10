import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle, Clock, FileDown, Trophy, ShieldCheck, Eye, EyeOff, Layers } from 'lucide-react';
import { apiClient } from '../../api/client';
import TestPDFExportModal from '../teacher/TestPDFExportModal';

const TestLibrary = () => {
  const navigate = useNavigate();
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfTestData, setPdfTestData] = useState(null);
  const [pdfQuestions, setPdfQuestions] = useState([]);
  const [exportingPdfId, setExportingPdfId] = useState(null);
  const [updatingResultId, setUpdatingResultId] = useState(null);

  useEffect(() => {
    const load = async () => {
      try { setTests(await apiClient.getList('/tests')); }
      catch { }
      finally { setLoading(false); }
    };
    load();
  }, []);

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
      console.error('Failed to export PDF:', e);
      alert(e.message || 'Failed to load test questions for PDF export');
    } finally {
      setExportingPdfId(null);
    }
  };

  const handleToggleResults = async (test, publish) => {
    const action = publish ? 'approve and release' : 'withhold';
    if (!window.confirm(`Are you sure you want to ${action} results for "${test.title}"? Students will ${publish ? 'now be able to view their scores and solutions' : 'no longer see scores until re-approved'}.`)) {
      return;
    }
    setUpdatingResultId(test.id);
    try {
      await apiClient.patch(`/tests/${test.id}/publish-results`, { published: publish });
      setTests((prev) =>
        prev.map((t) => (t.id === test.id ? { ...t, results_published: publish } : t)),
      );
    } catch (e) {
      alert(e.message || 'Failed to update results status');
    } finally {
      setUpdatingResultId(null);
    }
  };

  const filtered = filter === 'all' ? tests : tests.filter(t => t.status === filter);

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>Test library</h1>
          <p>Overview of all tests across the platform — drafted, published, and results approval.</p>
        </div>
      </div>

      <div className="admin-tabs">
        {[['all', 'All Tests'], ['draft', 'Drafts'], ['published', 'Published']].map(([val, label]) => (
          <button key={val} className={`admin-tab ${filter === val ? 'active' : ''}`} onClick={() => setFilter(val)}>{label}</button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="admin-empty"><BookOpen size={40} /><p>No tests found.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(t => {
            const isResultsLive = t.results_published === true;
            return (
              <div key={t.id} className="admin-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: t.status === 'published' ? 'rgba(47, 107, 58,0.1)' : 'rgba(143, 92, 14,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <BookOpen size={18} color={t.status === 'published' ? '#2f6b3a' : '#8f5c0e'} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)', marginBottom: 3 }}>{t.title}</div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {t.subject && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.subject}</span>}
                      {t.duration_minutes && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.duration_minutes} min</span>}
                      {t.created_at && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Created {new Date(t.created_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className={`admin-badge admin-badge-${t.status === 'published' ? 'published' : 'draft'}`}>
                    {t.status === 'published'
                      ? <><CheckCircle size={10} /> Paper published</>
                      : <><Clock size={10} /> Draft</>
                    }
                  </span>

                  {/* Results Visibility Badge */}
                  <span
                    className="admin-badge"
                    style={{
                      background: isResultsLive ? '#e3ecd9' : '#f3e6c6',
                      color: isResultsLive ? '#2f6b3a' : '#8f5c0e',
                      border: `1px solid ${isResultsLive ? '#b6cba6' : '#dfc68f'}`,
                    }}
                  >
                    {isResultsLive ? (
                      <><Eye size={10} /> Results: Released</>
                    ) : (
                      <><EyeOff size={10} /> Results: Withheld</>
                    )}
                  </span>

                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {t.question_count ?? (t.test_questions?.length ?? 0)} Q
                  </span>

                  {/* Admin Result Release Button */}
                  <button
                    type="button"
                    onClick={() => handleToggleResults(t, !isResultsLive)}
                    disabled={updatingResultId === t.id}
                    title={isResultsLive ? 'Withhold results from students' : 'Approve & Release results to students'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '6px 12px',
                      borderRadius: 7,
                      border: isResultsLive ? '1px solid #c6b99e' : '1px solid #b6cba6',
                      background: isResultsLive ? '#f6f1e6' : '#e3ecd9',
                      color: isResultsLive ? '#56504a' : '#2f6b3a',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                  >
                    <ShieldCheck size={13} />
                    <span>
                      {updatingResultId === t.id
                        ? 'Updating...'
                        : isResultsLive
                        ? 'Withhold'
                        : 'Approve Results'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/teacher/test-constructor/${t.id}`)}
                    title="Build or edit questions for this test"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 7,
                      border: '1px solid #bcc4e2',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                  >
                    <Layers size={14} />
                    <span>Questions</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/admin/test-results/${t.id}`)}
                    title="View candidate test results"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 7,
                      border: '1px solid #f0abfc',
                      background: '#fdf4ff',
                      color: 'var(--accent)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                  >
                    <Trophy size={14} />
                    <span>Results</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportPdf(t)}
                    disabled={exportingPdfId === t.id}
                    title="Export question paper as PDF (subject-wise)"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 12px',
                      borderRadius: 7,
                      border: '1px solid #c6b99e',
                      background: '#f6f1e6',
                      color: 'var(--accent-strong)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'var(--transition)'
                    }}
                  >
                    <FileDown size={14} />
                    <span>{exportingPdfId === t.id ? 'Loading…' : 'PDF'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
