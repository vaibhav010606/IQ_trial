import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardList, Trash2, X, CheckCircle, Clock, ChevronRight,
         Settings, Zap, Trophy, UserCheck, Users, Search, Check, Send, Calendar, Stethoscope, FileDown, Layers } from 'lucide-react';
import { apiClient } from '../../api/client';
import { toPreset, getPattern, patternIdOf, canonicalSubject, subjectQuota } from '../../utils/examPatterns';
import TestPDFExportModal from '../teacher/TestPDFExportModal';
import './TestInitiation.css';

/* ─── Exam presets ─────────────────────────────────────────────────────
   From the shared official blueprints (utils/examPatterns.json) — the same
   definitions the server validates and grades against. Never hand-write counts
   here. */
const PRESET_IDS = ['jee_main', 'jee_advanced', 'jee_advanced_p2', 'neet'];
const PRESETS = Object.fromEntries(PRESET_IDS.map((id) => [id, toPreset(id)]));

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
const Q_TYPES  = ['single_correct', 'multi_correct', 'integer', 'mixed'];
const defaultCustomSection = () => ({ subject: 'Physics', q_type: 'single_correct', count: 20, marks: 4, negative: -1 });

function presetInstructions(preset) {
  return [
    `Pattern: ${preset.label}`,
    `Duration: ${preset.duration_minutes} minutes`,
    `Total Questions: ${preset.totalQuestions}  |  Total Marks: ${preset.totalMarks}`,
    '',
    ...preset.subjects.flatMap(sub => [
      `${sub.name}:`,
      ...sub.sections.map(s => `  • ${s.label} — ${s.count}Q × ${s.marks}m${s.partial ? ' (partial marking)' : ''}${s.negative < 0 ? ` (${s.negative} per wrong)` : ' (no negative)'}`),
    ]),
  ].join('\n');
}

/* ─── Shared sub-components ──────────────────────────────────────────── */
const Avatar = ({ name = '?', size = 28 }) => {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 600, flexShrink: 0 }}>
      {initials}
    </div>
  );
};

/* ─── Multi Teacher Picker ───────────────────────────────────────────── */
const MultiTeacherPicker = ({ teachers, selected, onChange, loading }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen]     = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  const filtered = teachers.filter(t =>
    `${t.full_name} ${t.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const selectedTeachers = teachers.filter(t => selected.includes(t.id));

  return (
    <div ref={ref} style={{ position: 'relative', zIndex: open ? 50 : 1 }}>
      {/* Selected chips */}
      {selectedTeachers.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selectedTeachers.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 6px', background: 'var(--color-admin-purple-light)', border: '1px solid rgba(43, 68, 166,0.3)', borderRadius: 20, fontSize: 12, fontWeight: 500, color: 'var(--color-admin-purple)' }}>
              <Avatar name={t.full_name} size={20} />
              <span>{t.full_name}</span>
              <button onClick={() => toggle(t.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-admin-purple)', padding: 0, display: 'flex', alignItems: 'center', marginLeft: 2 }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Trigger button */}
      <button
        id="teacher-picker-trigger"
        onClick={() => setOpen(v => !v)}
        style={{ width: '100%', padding: '9px 14px', borderRadius: 8, border: `1.5px solid ${open ? 'var(--color-admin-purple)' : 'var(--border-color)'}`, background: 'var(--bg-card)', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: selected.length ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: 13 }}
        disabled={loading}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={15} color="var(--color-admin-purple)" />
          {loading ? 'Loading teachers...' : selected.length === 0 ? 'Click to select teachers…' : `${selected.length} teacher${selected.length > 1 ? 's' : ''} selected`}
        </div>
        <ChevronRight size={14} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200, background: '#fbf8f1', border: '1.5px solid var(--color-admin-purple)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.14)', overflow: 'hidden' }}>
          {/* Search */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Search size={14} color="var(--text-secondary)" />
            <input
              autoFocus
              placeholder="Search by name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, width: '100%', color: 'var(--text-primary)' }}
            />
            {selected.length > 0 && (
              <button onClick={() => onChange([])} style={{ fontSize: 11, color: '#b3352b', background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Clear all
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>No teachers found</div>
            ) : filtered.map(t => {
              const isSelected = selected.includes(t.id);
              return (
                <div
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', cursor: 'pointer', background: isSelected ? 'var(--color-admin-purple-light)' : 'transparent', transition: 'background 0.12s' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'var(--color-admin-purple-light)' : 'transparent'; }}
                >
                  <Avatar name={t.full_name} size={32} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{t.full_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t.email}</div>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${isSelected ? 'var(--color-admin-purple)' : 'var(--border-color)'}`, background: isSelected ? 'var(--color-admin-purple)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'var(--transition)' }}>
                    {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer count */}
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: 'var(--text-secondary)' }}>
            <span>{selected.length} selected</span>
            <button onClick={() => setOpen(false)} style={{ padding: '4px 12px', borderRadius: 6, background: 'var(--color-admin-purple)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── TypeCard ──────────────────────────────────────────────────────── */
const TypeCard = ({ id, active, onClick, icon: Icon, title, subtitle, badge }) => (
  <button
    id={`test-type-${id}`}
    onClick={onClick}
    style={{
      flex: 1,
      minHeight: 110,
      padding: '16px 18px',
      borderRadius: 14,
      border: `2px solid ${active ? 'var(--color-admin-purple)' : 'var(--border-color)'}`,
      background: active ? 'var(--color-admin-purple-light)' : 'var(--bg-card)',
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'var(--transition)',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      gap: 8,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Icon size={22} color={active ? 'var(--color-admin-purple)' : 'var(--text-secondary)'} />
      {badge && (
        <span style={{ fontSize: 10.5, fontWeight: 600, background: badge.bg, color: badge.color, borderRadius: 5, padding: '3px 8px' }}>
          {badge.text}
        </span>
      )}
    </div>
    <div>
      <div style={{ fontWeight: 600, fontSize: 15, color: active ? 'var(--color-admin-purple)' : 'var(--text-primary)', marginBottom: 3 }}>
        {title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
        {subtitle}
      </div>
    </div>
  </button>
);

/* ─── Preset Preview ────────────────────────────────────────────────── */
const PresetPanel = ({ preset }) => (
  <div style={{ background: '#f6f1e6', borderRadius: 12, padding: '16px 20px', border: '1px solid #ded4bf', display: 'flex', flexDirection: 'column', gap: 14 }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {[
        { label: 'Duration', value: `${preset.duration_minutes} min`, color: 'var(--accent)' },
        { label: 'Total questions', value: preset.totalQuestions, color: 'var(--accent)' },
        { label: 'Total marks', value: preset.totalMarks, color: '#2f6b3a' },
        { label: 'Set by', value: preset.authority, color: '#8f5c0e' },
      ].map(({ label, value, color }) => (
        <div key={label} style={{ background: '#fbf8f1', border: '1px solid #ded4bf', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: '#736b5f', textTransform: 'none', letterSpacing: 0 }}>{label}</div>
          <div style={{ fontSize: 18, fontWeight: 600, color, marginTop: 4 }}>{value}</div>
        </div>
      ))}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${preset.subjects.length}, 1fr)`, gap: 12 }}>
      {preset.subjects.map(sub => (
        <div key={sub.name} style={{ background: '#fbf8f1', border: '1px solid #ded4bf', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#2a2722', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{sub.name}</span>
            <span style={{ fontSize: 11, color: '#736b5f', fontWeight: 500 }}>
              {sub.sections.reduce((acc, s) => acc + s.count, 0)} Questions
            </span>
          </div>
          {sub.sections.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#56504a', marginBottom: 5 }}>
              <ChevronRight size={12} color="#998f7d" />
              <span>{s.label}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 600, color: '#1b1a17', whiteSpace: 'nowrap' }}>{s.count}Q · +{s.marks}{s.negative ? `/${s.negative}` : '/0'}{s.partial ? ' partial' : ''}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
    <div style={{ fontSize: 11, color: '#736b5f' }}>Official pattern · {preset.edition}</div>
  </div>
);

/* ─── Custom section row ────────────────────────────────────────────── */
const CustomRow = ({ row, idx, onChange, onRemove }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.1fr 60px 60px 70px 36px', gap: 8, alignItems: 'end' }}>
    {['Subject','Type',"Q's",'Marks','−ve',''].map((h, i) => idx === 0 && <div key={i} style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'none' }}>{h || <>&nbsp;</>}</div>)}
    <select className="admin-form-select" style={{ fontSize: 12, gridRow: 2 }} value={row.subject} onChange={e => onChange(idx, 'subject', e.target.value)}>
      {SUBJECTS.map(s => <option key={s}>{s}</option>)}
    </select>
    <select className="admin-form-select" style={{ fontSize: 12, gridRow: 2 }} value={row.q_type} onChange={e => onChange(idx, 'q_type', e.target.value)}>
      {Q_TYPES.map(t => <option key={t} value={t}>{t === 'single_correct' ? 'Single MCQ' : t === 'multi_correct' ? 'Multi MCQ' : t === 'integer' ? 'Integer' : 'Mixed'}</option>)}
    </select>
    <input className="admin-form-input" style={{ fontSize: 12, padding: '6px 8px', gridRow: 2 }} type="number" min={1} max={100} value={row.count} onChange={e => onChange(idx, 'count', Number(e.target.value))} />
    <input className="admin-form-input" style={{ fontSize: 12, padding: '6px 8px', gridRow: 2 }} type="number" min={1} max={20} value={row.marks} onChange={e => onChange(idx, 'marks', Number(e.target.value))} />
    <input className="admin-form-input" style={{ fontSize: 12, padding: '6px 8px', gridRow: 2 }} type="number" min={-5} max={0} value={row.negative} onChange={e => onChange(idx, 'negative', Number(e.target.value))} />
    <button onClick={() => onRemove(idx)} style={{ gridRow: 2, width: 36, height: 36, borderRadius: 6, border: '1px solid #e2b6aa', background: '#f5e2da', color: '#b3352b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <X size={13} />
    </button>
  </div>
);

/* ═══════════════════════════════════════════════════════════════════════ */
const TestInitiation = () => {
  const navigate = useNavigate();
  const [tests,   setTests]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal,  setShowModal]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [toast,      setToast]      = useState({ msg: '', type: 'ok' });

  /* teachers */
  const [teachers, setTeachers] = useState([]);
  const [teachersLoading, setTeachersLoading] = useState(false);

  /* batches */
  const [batches, setBatches] = useState([]);

  /* create modal */
  const [testType,         setTestType]         = useState('jee_main');
  const [form,             setForm]             = useState({ title: '', instructions: '' });
  const [selectedTeachers, setSelectedTeachers] = useState([]);   // array of ids
  const [customDuration,   setCustomDuration]   = useState(60);
  const [customSections,   setCustomSections]   = useState([defaultCustomSection()]);

  /* assign modal (existing test) */
  const [assignTarget,   setAssignTarget]   = useState(null);
  const [assignSelected, setAssignSelected] = useState([]);
  const [assigning,      setAssigning]      = useState(false);

  /* batch assign modal */
  const [batchTarget, setBatchTarget] = useState(null);
  const [batchSelected, setBatchSelected] = useState([]);
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [assigningBatches, setAssigningBatches] = useState(false);

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
      showToast(e.message || 'Failed to fetch test questions for PDF export', 'error');
    } finally {
      setExportingPdfId(null);
    }
  };

  const handlePublish = async (test) => {
    if (!window.confirm(`Publish "${test.title}"? Students won't see it until you assign it to a batch.`)) return;
    try {
      await apiClient.patch(`/tests/${test.id}/publish`);
      showToast(`"${test.title}" is published`);
      fetchTests();
    } catch (e) { showToast(e.message || 'Failed to publish', 'error'); }
  };

  const handleAssignBatches = async () => {
    if (!batchTarget) return;
    if (batchSelected.length === 0) return showToast('Select at least one batch', 'error');
    if (!scheduleStart || !scheduleEnd) return showToast('Set start and end times', 'error');

    setAssigningBatches(true);
    try {
      await apiClient.post(`/tests/${batchTarget.id}/assign`, {
        batch_ids: batchSelected,
        scheduled_start: new Date(scheduleStart).toISOString(),
        scheduled_end: new Date(scheduleEnd).toISOString(),
      });
      showToast('Test assigned to the selected batches');
      setBatchTarget(null);
    } catch (e) { showToast(e.message || 'Failed to assign', 'error'); }
    finally { setAssigningBatches(false); }
  };

  const preset = PRESETS[testType] || null;

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: '', type: 'ok' }), 3500);
  };

  const fetchTests = useCallback(async () => {
    setLoading(true);
    try { setTests(await apiClient.getList('/tests')); }
    catch { showToast('Failed to load tests', 'error'); }
    finally { setLoading(false); }
  }, []);

  const fetchTeachers = useCallback(async () => {
    setTeachersLoading(true);
    try { setTeachers(await apiClient.getList('/users/teachers')); }
    catch { /* non-fatal */ }
    finally { setTeachersLoading(false); }
  }, []);

  const fetchBatches = useCallback(async () => {
    try { setBatches((await apiClient.get('/batches')) || []); }
    catch { /* non-fatal */ }
  }, []);

  useEffect(() => { fetchTests(); fetchTeachers(); fetchBatches(); }, [fetchTests, fetchTeachers, fetchBatches]);

  const updateSection = (idx, f, v) => setCustomSections(prev => prev.map((r, i) => i === idx ? { ...r, [f]: v } : r));
  const removeSection = (idx) => setCustomSections(prev => prev.filter((_, i) => i !== idx));
  const addSection    = () => setCustomSections(prev => [...prev, defaultCustomSection()]);

  const customTotalQ = customSections.reduce((s, r) => s + (Number(r.count) || 0), 0);
  const customTotalM = customSections.reduce((s, r) => s + (Number(r.count) || 0) * (Number(r.marks) || 0), 0);
  const hasNegative  = customSections.some(r => Number(r.negative) < 0);

  const resetModal = () => {
    setTestType('jee_main'); setForm({ title: '', instructions: '' });
    setSelectedTeachers([]); setCustomDuration(60); setCustomSections([defaultCustomSection()]);
  };

  /* ── Create ── */
  const handleCreate = async () => {
    if (!form.title.trim()) return showToast('Test title is required', 'error');
    if (testType === 'custom' && customSections.length === 0) return showToast('Add at least one section', 'error');

    const autoInstructions = preset ? presetInstructions(preset) : [
      'Pattern: Custom', `Duration: ${customDuration} minutes`,
      `Total Questions: ${customTotalQ}  |  Total Marks: ${customTotalM}`,
      ...(hasNegative ? ['Negative marking applies.'] : []),
    ].join('\n');

    const payload = {
      title: form.title,
      subject: preset ? 'Mixed' : (customSections.length === 1 ? customSections[0].subject : 'Mixed'),
      paper_pattern: testType,
      duration_minutes: preset ? preset.duration_minutes : Number(customDuration),
      instructions: form.instructions.trim() || autoInstructions,
      status: 'draft',
      total_marks: preset ? preset.totalMarks : customTotalM,
      negative_marking: preset ? preset.negativeMarking : hasNegative,
      negative_marks: (preset?.negativeMarking || hasNegative) ? 1 : 0,
      teacher_ids: selectedTeachers,   // backend strips this before DB insert, uses for test_teachers
    };

    setSaving(true);
    try {
      await apiClient.post('/tests', payload);
      showToast('Test created');
      setShowModal(false); resetModal(); fetchTests();
    } catch (e) { showToast(e.message || 'Failed to create test', 'error'); }
    finally { setSaving(false); }
  };

  /* ── Assign teachers to existing test ── */
  const openAssignModal = (test) => {
    setAssignTarget(test);
    const existing = (test.test_teachers || []).map(tt => tt.teacher_id);
    setAssignSelected(existing);
  };

  const handleAssign = async () => {
    if (!assignTarget) return;
    setAssigning(true);
    try {
      await apiClient.patch(`/tests/${assignTarget.id}/assign-teacher`, { teacher_ids: assignSelected });
      const n = assignSelected.length;
      showToast(n === 0 ? 'All teachers removed.' : `${n} teacher${n > 1 ? 's' : ''} assigned!`);
      setAssignTarget(null); fetchTests();
    } catch (e) { showToast(e.message || 'Failed to assign teachers', 'error'); }
    finally { setAssigning(false); }
  };

  const handleDelete = async (test) => {
    if (!window.confirm(`Delete test "${test.title}"?`)) return;
    try { await apiClient.delete(`/tests/${test.id}`); showToast(`"${test.title}" deleted`); fetchTests(); }
    catch (e) { showToast(e.message || 'Failed', 'error'); }
  };

  /* helper: get list of assigned teachers for a row */
  const rowTeachers = (t) => (t.test_teachers || []).map(tt => tt.users).filter(Boolean);

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="admin-page">
      {toast.msg && <div className={`admin-toast ${toast.type === 'error' ? 'error' : ''}`}>{toast.msg}</div>}

      <div className="admin-page-header">
        <div>
          <h1>Test initiation</h1>
          <p>Create test shells and assign teachers to add questions per subject.</p>
        </div>
        <button className="admin-btn admin-btn-primary" onClick={() => { resetModal(); setShowModal(true); }}>
          <Plus size={16} /> Initiate test
        </button>
      </div>

      <div className="admin-info-banner">
        <ClipboardList size={18} />
        <div>
          <div className="admin-info-banner-title">How this works</div>
          <div className="admin-info-banner-body">
            Create a test shell (JEE Main / Advanced / Custom), then assign one or more teachers per subject. Assigned teachers see this test in their <strong>Test constructor</strong>.
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-secondary)' }}>Loading tests…</p>
      ) : tests.length === 0 ? (
        <div className="admin-empty"><ClipboardList size={40} /><p>No tests yet</p></div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Title</th><th>Subject</th><th>Duration</th><th>Status</th><th>Assigned teachers</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {tests.map(t => {
                const assigned = rowTeachers(t);
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 500 }}>{t.title}</td>
                    <td>{t.subject || '—'}</td>
                    <td>{t.duration_minutes ? `${t.duration_minutes} min` : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t.status === 'published' ? <CheckCircle size={13} color="#2f6b3a" /> : <Clock size={13} color="#8f5c0e" />}
                        <span className={`admin-badge admin-badge-${t.status === 'published' ? 'published' : 'draft'}`}>{t.status || 'draft'}</span>
                      </div>
                    </td>
                    <td>
                      {assigned.length === 0 ? (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>Unassigned</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {assigned.map((teacher) => (
                              <div key={teacher.id} title={teacher.email} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Avatar name={teacher.full_name} size={24} />
                                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{teacher.full_name}</span>
                              </div>
                            ))}
                          </div>
                          
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4, padding: '8px', background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
                             <div style={{ width: '100%', fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'none', marginBottom: 2, letterSpacing: 0 }}>Questions Progress:</div>
                             {(() => {
                                // Targets come from the official blueprint of the test's
                                // pattern; a custom paper just shows its counts.
                                const pattern = getPattern(patternIdOf(t));
                                const subjects = pattern ? Object.keys(pattern.subjects) : ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
                                return subjects.map(sub => {
                                  const count = (t.test_questions || []).filter(tq =>
                                    pattern ? canonicalSubject(tq.questions?.subject, pattern) === sub : tq.questions?.subject === sub
                                  ).length;
                                  if (!pattern && count === 0) return null;
                                  const target = pattern ? subjectQuota(pattern, sub).total : '?';
                                  const isComplete = typeof target === 'number' && count === target;
                                  const color = isComplete ? '#2f6b3a' : 'var(--text-secondary)';
                                  return (
                                    <div key={sub} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 40, padding: '4px', borderRadius: 4, background: isComplete ? '#e3ecd9' : '#ffffff', border: `1px solid ${isComplete ? '#b6cba6' : '#ded4bf'}`, color }}>
                                      <span style={{ fontSize: 9, fontWeight: 500 }}>{sub.substring(0, 4)}</span>
                                      <span style={{ fontSize: 11, fontWeight: 600 }}>{count}/{target}</span>
                                    </div>
                                  );
                                });
                              })()}
                          </div>
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}</td>
                    <td>
                      <div className="ti-actions-group">
                        <button
                          className="ti-action-btn ti-action-build"
                          onClick={() => navigate(`/teacher/test-constructor/${t.id}`)}
                          title="Build or edit questions for this test"
                        >
                          <Layers size={17} className="ti-btn-icon" />
                          <span className="ti-btn-label">Questions</span>
                        </button>
                        <button
                          id={`assign-btn-${t.id}`}
                          className="ti-action-btn ti-action-assign"
                          onClick={() => openAssignModal(t)}
                          title="Assign teachers to add questions"
                        >
                          <UserCheck size={18} className="ti-btn-icon" />
                          <span className="ti-btn-label">Assign</span>
                        </button>
                        {t.status === 'draft' && (
                          <button
                            className="ti-action-btn ti-action-publish"
                            onClick={() => handlePublish(t)}
                            title="Publish this test for students"
                          >
                            <Send size={17} className="ti-btn-icon" />
                            <span className="ti-btn-label">Publish</span>
                          </button>
                        )}
                        {t.status === 'published' && (
                          <button
                            className="ti-action-btn ti-action-schedule"
                            onClick={() => {
                              setBatchTarget(t);
                              setBatchSelected([]);
                              setScheduleStart('');
                              setScheduleEnd('');
                            }}
                            title="Schedule & assign to batches"
                          >
                            <Calendar size={17} className="ti-btn-icon" />
                            <span className="ti-btn-label">Batches</span>
                          </button>
                        )}
                        <button
                          className="ti-action-btn ti-action-pdf"
                          onClick={() => handleExportPdf(t)}
                          title="Export question paper as PDF (subject-wise)"
                          disabled={exportingPdfId === t.id}
                        >
                          {exportingPdfId === t.id ? (
                            <Clock size={17} className="ti-btn-icon" />
                          ) : (
                            <FileDown size={17} className="ti-btn-icon" />
                          )}
                          <span className="ti-btn-label">
                            {exportingPdfId === t.id ? 'Loading…' : 'PDF'}
                          </span>
                        </button>
                        <button
                          className="ti-action-btn ti-action-delete"
                          onClick={() => handleDelete(t)}
                          title="Delete test"
                        >
                          <Trash2 size={18} className="ti-btn-icon" />
                          <span className="ti-btn-label">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-color)', fontSize: 12, color: 'var(--text-secondary)' }}>
            {tests.length} test{tests.length !== 1 ? 's' : ''} total
          </div>
        </div>
      )}

      {/* ══════════ CREATE MODAL ══════════ */}
      {showModal && (
        <div className="admin-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="admin-modal initiate-modal-lg" onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header" style={{ marginBottom: 16 }}>
              <div>
                <h2 className="admin-modal-title initiate-modal-title">Initiate new test</h2>
                <p style={{ margin: '3px 0 0 0', fontSize: 13, color: '#736b5f' }}>
                  Select an examination framework or configure custom subject quotas and assign faculty.
                </p>
              </div>
              <button className="admin-modal-close" onClick={() => setShowModal(false)} aria-label="Close dialog" title="Close"><X size={20} /></button>
            </div>

            <div className="initiate-modal-body">
              <div className="admin-form-group">
                <label className="admin-form-label">Test format</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                  {[
                    { id: 'jee_main', icon: Zap, title: 'JEE Main', badge: { text: 'NTA', bg: 'var(--accent-soft)', color: 'var(--accent-strong)' } },
                    { id: 'jee_advanced', icon: Trophy, title: 'JEE Adv · Paper 1', badge: { text: 'IIT', bg: '#f3e6c6', color: '#8f5c0e' } },
                    { id: 'jee_advanced_p2', icon: Trophy, title: 'JEE Adv · Paper 2', badge: { text: 'IIT', bg: '#f3e6c6', color: '#8f5c0e' } },
                    { id: 'neet', icon: Stethoscope, title: 'NEET', badge: { text: 'NTA', bg: '#e3ecd9', color: '#2f6b3a' } },
                  ].map(({ id, icon, title, badge }) => (
                    <TypeCard
                      key={id}
                      id={id}
                      active={testType === id}
                      onClick={() => setTestType(id)}
                      icon={icon}
                      title={title}
                      subtitle={`${PRESETS[id].duration_minutes} min · ${PRESETS[id].totalQuestions} Q · ${PRESETS[id].totalMarks} marks`}
                      badge={badge}
                    />
                  ))}
                  <TypeCard id="custom"       active={testType === 'custom'}       onClick={() => setTestType('custom')}       icon={Settings}    title="Custom"       subtitle="Set your own subjects, types & time" />
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Test Title *</label>
                <input id="test-title-input" className="admin-form-input" placeholder={preset ? `e.g. ${preset.label} Mock Test #1` : 'e.g. Chapter 5 Practice Test'} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={{ height: 42, fontSize: 14 }} />
              </div>

              {preset && (
                <div className="admin-form-group">
                  <label className="admin-form-label">Pattern preview</label>
                  <PresetPanel preset={preset} />
                </div>
              )}

              {testType === 'custom' && (
                <>
                  <div className="admin-form-group">
                    <label className="admin-form-label">Duration (minutes)</label>
                    <input id="custom-duration-input" className="admin-form-input" type="number" min={10} max={360} value={customDuration} onChange={e => setCustomDuration(e.target.value)} style={{ maxWidth: 140, height: 40 }} />
                  </div>
                  <div className="admin-form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <label className="admin-form-label" style={{ marginBottom: 0 }}>Sections</label>
                      <button id="add-section-btn" onClick={addSection} style={{ fontSize: 12, color: 'var(--color-admin-purple)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={13} /> Add section</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {customSections.map((row, idx) => <CustomRow key={idx} row={row} idx={idx} onChange={updateSection} onRemove={removeSection} />)}
                    </div>
                    <div style={{ marginTop: 12, padding: '12px 16px', background: 'var(--color-admin-purple-light)', borderRadius: 10, display: 'flex', gap: 28 }}>
                      {[{ label: 'Total questions', value: customTotalQ }, { label: 'Total marks', value: customTotalM }, { label: 'Duration', value: `${customDuration} min` }, { label: 'Negative marking', value: hasNegative ? 'Yes' : 'No' }].map(({ label, value }) => (
                        <div key={label}><div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--color-admin-purple)', textTransform: 'none' }}>{label}</div><div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{value}</div></div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Multi teacher picker */}
              <div className="admin-form-group">
                <label className="admin-form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <UserCheck size={14} color="var(--color-admin-purple)" />
                  Assign Teachers to Fill Questions
                  <span style={{ fontWeight: 400, color: 'var(--text-secondary)', fontSize: 11 }}> — select any number</span>
                </label>
                <MultiTeacherPicker teachers={teachers} selected={selectedTeachers} onChange={setSelectedTeachers} loading={teachersLoading} />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Instructions <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(optional)</span></label>
                <textarea className="admin-form-input" placeholder="Any special instructions..." value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} rows={3} style={{ resize: 'vertical' }} />
              </div>
            </div>

            <div className="admin-modal-footer" style={{ marginTop: 16, paddingTop: 14 }}>
              <button className="admin-btn admin-btn-ghost" onClick={() => setShowModal(false)} style={{ height: 42, padding: '0 20px', fontSize: 13.5 }}>Cancel</button>
              <button id="create-test-btn" className="admin-btn admin-btn-primary" onClick={handleCreate} disabled={saving} style={{ height: 42, padding: '0 24px', fontSize: 13.5 }}>
                {saving ? 'Creating…' : 'Create Test Shell'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ ASSIGN TEACHERS MODAL (existing test) ══════════ */}
      {assignTarget && (
        <div className="admin-modal-overlay" onClick={() => setAssignTarget(null)}>
          <div className="admin-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Assign teachers</h2>
              <button className="admin-modal-close" onClick={() => setAssignTarget(null)} aria-label="Close dialog" title="Close"><X size={18} /></button>
            </div>

            {/* test strip */}
            <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border-color)', marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'none', fontWeight: 500, letterSpacing: 0 }}>Test</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginTop: 2 }}>{assignTarget.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{assignTarget.subject} · {assignTarget.duration_minutes} min · {assignTarget.total_marks} marks</div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={14} /> Select teachers
                <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-secondary)' }}> — one per subject or more</span>
              </label>
              <MultiTeacherPicker teachers={teachers} selected={assignSelected} onChange={setAssignSelected} loading={teachersLoading} />
            </div>

            {/* preview of selected */}
            {assignSelected.length > 0 && (
              <div style={{ marginTop: 4, marginBottom: 16, padding: '12px 14px', background: '#e3ecd9', border: '1px solid #b6cba6', borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: '#2f6b3a', marginBottom: 8, textTransform: 'none' }}>
                  {assignSelected.length} teacher{assignSelected.length > 1 ? 's' : ''} will have access
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {teachers.filter(t => assignSelected.includes(t.id)).map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar name={t.full_name} size={24} />
                      <span style={{ fontSize: 12, color: '#2f6b3a', fontWeight: 500 }}>{t.full_name}</span>
                      <span style={{ fontSize: 11, color: '#2f6b3a' }}>{t.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {assignSelected.length === 0 && assignTarget.test_teachers?.length > 0 && (
              <div style={{ padding: '10px 14px', background: '#f5e2da', border: '1px solid #e2b6aa', borderRadius: 8, fontSize: 12, color: '#b3352b', marginBottom: 16 }}>
                All existing teachers will be removed from this test.
              </div>
            )}

            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-ghost" onClick={() => setAssignTarget(null)}>Cancel</button>
              <button id="confirm-assign-btn" className="admin-btn admin-btn-primary" onClick={handleAssign} disabled={assigning}>
                {assigning ? 'Saving…' : assignSelected.length === 0 ? 'Remove All Teachers' : `Assign ${assignSelected.length} Teacher${assignSelected.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ══════════ ASSIGN TO BATCHES MODAL ══════════ */}
      {batchTarget && (
        <div className="admin-modal-overlay" onClick={() => setBatchTarget(null)}>
          <div className="admin-modal" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Assign to Batches</h2>
              <button className="admin-modal-close" onClick={() => setBatchTarget(null)} aria-label="Close dialog" title="Close"><X size={18} /></button>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 10, border: '1px solid var(--border-color)', marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'none', fontWeight: 500, letterSpacing: 0 }}>Published test</div>
              <div style={{ fontWeight: 600, fontSize: 15, marginTop: 2 }}>{batchTarget.title}</div>
            </div>

            <div className="admin-form-group">
              <label className="admin-form-label">Select batches</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 8, padding: 10 }}>
                {batches.length === 0 ? (
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No batches available</span>
                ) : batches.map(b => (
                  <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                    <input type="checkbox" checked={batchSelected.includes(b.id)} onChange={(e) => {
                      if (e.target.checked) setBatchSelected([...batchSelected, b.id]);
                      else setBatchSelected(batchSelected.filter(id => id !== b.id));
                    }} />
                    <span style={{ fontWeight: 500 }}>{b.name}</span>
                    {b.subject_focus && <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>({b.subject_focus})</span>}
                  </label>
                ))}
              </div>
            </div>

            <div className="admin-form-group" style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label className="admin-form-label">Scheduled start</label>
                <input type="datetime-local" className="admin-form-input" value={scheduleStart} onChange={e => {
                  const val = e.target.value;
                  setScheduleStart(val);
                  if (val && batchTarget?.duration_minutes) {
                    const d = new Date(val);
                    d.setMinutes(d.getMinutes() + batchTarget.duration_minutes);
                    const pad = (n) => n.toString().padStart(2, '0');
                    setScheduleEnd(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
                  }
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="admin-form-label">Scheduled end</label>
                <input type="datetime-local" className="admin-form-input" value={scheduleEnd} onChange={e => setScheduleEnd(e.target.value)} />
              </div>
            </div>

            <div className="admin-modal-footer">
              <button className="admin-btn admin-btn-ghost" onClick={() => setBatchTarget(null)}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleAssignBatches} disabled={assigningBatches}>
                {assigningBatches ? 'Assigning...' : `Assign to ${batchSelected.length} Batch${batchSelected.length !== 1 ? 'es' : ''}`}
              </button>
            </div>
          </div>
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

export default TestInitiation;
