// Official exam patterns for the portal — JEE Main (NTA), JEE Advanced
// (IIT/JAB), NEET (NTA).
//
// examPatterns.json is a byte-for-byte copy of the backend's
// exam-patterns.data.json, the single source of truth (a backend test fails if
// the copies drift). These helpers mirror backend/src/modules/tests/exam-patterns.ts
// so the constructor, auto-fill, initiation presets and the server's publish
// check all count a paper the same way.

import RAW from './examPatterns.json';

export const EXAM_PATTERNS = Object.fromEntries(
  Object.entries(RAW).filter(([key]) => !key.startsWith('_')),
);

export const STANDARD_PATTERN_IDS = Object.keys(EXAM_PATTERNS);

export const KINDS = ['single', 'multi', 'numerical'];

export const KIND_LABEL = {
  single: 'Single correct',
  multi: 'One or more correct',
  numerical: 'Numerical',
};

export function getPattern(id) {
  return id && EXAM_PATTERNS[id] ? EXAM_PATTERNS[id] : null;
}

/** The pattern of a test row: the `paper_pattern` column, else its title / instructions. */
export function patternIdOf(test) {
  const explicit = String(test?.paper_pattern || '').toLowerCase();
  if (EXAM_PATTERNS[explicit]) return explicit;
  if (explicit === 'custom') return null;
  const text = `${test?.title || ''} ${test?.instructions || ''} ${test?.description || ''} ${test?.t_type || ''}`.toLowerCase();
  if (/jee[ _]?adv/.test(text)) return /paper[ _-]?(2|ii)\b|_p2\b/.test(text) ? 'jee_advanced_p2' : 'jee_advanced';
  if (/jee[ _]?main/.test(text)) return 'jee_main';
  if (/\bneet\b/.test(text)) return 'neet';
  return null;
}

export function patternTotals(pattern) {
  let questions = 0;
  let marks = 0;
  for (const sections of Object.values(pattern.subjects)) {
    for (const s of sections) {
      questions += s.count;
      marks += s.count * s.marks;
    }
  }
  return { questions, marks };
}

const SINGLE_TYPES = ['single_correct', 'single', 'mcq', 'scq', 'assertion', 'matching'];
const MULTI_TYPES = ['multi_correct', 'multiple_correct', 'multi', 'multiple', 'msq'];
const NUMERICAL_TYPES = ['numerical', 'numeric', 'integer', 'int', 'nat'];

/** Is this a whole-number answer key? JEE Main / NEET numericals must be. */
function isIntegerKey(correct) {
  const raw = String(correct && typeof correct === 'object' ? (correct.value ?? '') : (correct ?? '')).trim();
  return /^-?\d+(\.0+)?$/.test(raw);
}

/**
 * Which kind of section a bank question can fill under a pattern. A numerical
 * question only fits a pattern whose numerical answers it can satisfy (JEE Main
 * takes whole numbers; JEE Advanced takes values to two decimals).
 */
export function kindOfQuestion(q, pattern = null) {
  const key = String(q?.q_type || q?.type || '').trim().toLowerCase();
  if (SINGLE_TYPES.includes(key)) return 'single';
  if (MULTI_TYPES.includes(key)) return 'multi';
  if (NUMERICAL_TYPES.includes(key)) {
    if (pattern?.numericAnswer === 'integer' && !isIntegerKey(q?.correct_answer)) return null;
    return 'numerical';
  }
  if (key === 'subjective') return null;
  return Array.isArray(q?.options) && q.options.length > 0 ? 'single' : null;
}

/** The pattern's name for a subject (Maths -> Mathematics, Botany/Zoology -> Biology). */
export function canonicalSubject(subject, pattern) {
  const s = String(subject || '').trim().toLowerCase();
  if (!s || !pattern) return null;
  const aliases = { math: 'mathematics', maths: 'mathematics', botany: 'biology', zoology: 'biology' };
  const wanted = aliases[s] || s;
  return Object.keys(pattern.subjects).find((k) => k.toLowerCase() === wanted) || null;
}

/** Required questions per kind for one subject, plus the subject total. */
export function subjectQuota(pattern, subject) {
  const quota = { single: 0, multi: 0, numerical: 0, total: 0 };
  for (const s of pattern?.subjects?.[subject] || []) {
    quota[s.kind] += s.count;
    quota.total += s.count;
  }
  return quota;
}

/** Required questions per kind across the whole paper. */
export function paperQuota(pattern) {
  const quota = { single: 0, multi: 0, numerical: 0, total: 0 };
  for (const subject of Object.keys(pattern?.subjects || {})) {
    const q = subjectQuota(pattern, subject);
    for (const k of [...KINDS, 'total']) quota[k] += q[k];
  }
  return quota;
}

/** Questions on a paper counted per subject and kind. */
export function countPaper(pattern, questions) {
  const counts = {};
  for (const q of questions) {
    const subject = canonicalSubject(q.subject, pattern) || q.subject || 'Unknown';
    const kind = kindOfQuestion(q, pattern) || 'other';
    counts[subject] = counts[subject] || { single: 0, multi: 0, numerical: 0, other: 0, total: 0 };
    counts[subject][kind] += 1;
    counts[subject].total += 1;
  }
  return counts;
}

/**
 * Everything about a paper that departs from its pattern, as readable lines.
 * `onlySubject` limits the check to one subject (a subject teacher's share).
 */
export function validatePaper(pattern, questions, onlySubject = null) {
  const problems = [];
  const counts = countPaper(pattern, questions);
  const subjects = onlySubject
    ? [canonicalSubject(onlySubject, pattern)].filter(Boolean)
    : Object.keys(pattern.subjects);

  for (const [subject, c] of Object.entries(counts)) {
    if (!pattern.subjects[subject]) problems.push(`${subject} is not a subject in ${pattern.label}.`);
    else if (c.other) problems.push(`${subject}: ${c.other} question(s) of a type ${pattern.label} does not use.`);
  }
  for (const subject of subjects) {
    const want = subjectQuota(pattern, subject);
    const have = counts[subject] || { single: 0, multi: 0, numerical: 0 };
    for (const kind of KINDS) {
      if (want[kind] !== have[kind]) {
        problems.push(`${subject}: ${have[kind]}/${want[kind]} ${KIND_LABEL[kind].toLowerCase()}`);
      }
    }
  }
  return problems;
}

/** The shape Test Initiation renders presets in. */
export function toPreset(id) {
  const p = getPattern(id);
  if (!p) return null;
  const totals = patternTotals(p);
  return {
    id,
    label: p.label,
    edition: p.edition,
    authority: p.authority,
    duration_minutes: p.durationMinutes,
    totalQuestions: totals.questions,
    totalMarks: totals.marks,
    negativeMarking: true,
    subjects: Object.entries(p.subjects).map(([name, sections]) => ({
      name,
      sections: sections.map((s) => ({
        label: s.label,
        kind: s.kind,
        count: s.count,
        marks: s.marks,
        negative: s.negative ? -s.negative : 0,
        partial: Boolean(s.partial),
      })),
    })),
  };
}

/** One-line summary of a pattern for selection cards. */
export function patternSummary(id) {
  const p = getPattern(id);
  if (!p) return '';
  const t = patternTotals(p);
  const perSubject = Object.entries(p.subjects)
    .map(([name]) => `${name.slice(0, 4)} ${subjectQuota(p, name).total}`)
    .join(' · ');
  return `${t.questions} Q · ${t.marks} marks · ${p.durationMinutes} min · ${perSubject}`;
}
