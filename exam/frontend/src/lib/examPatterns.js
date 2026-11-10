// Official exam patterns, for the exam app's instructions page.
//
// examPatterns.json is a byte-for-byte copy of the backend's
// exam-patterns.data.json (a backend test fails if the copies drift). The
// server grades by these sections; this file only explains them to students.

import RAW from './examPatterns.json';

const PATTERNS = Object.fromEntries(Object.entries(RAW).filter(([key]) => !key.startsWith('_')));

export function getPattern(id) {
  return id && PATTERNS[id] ? PATTERNS[id] : null;
}

/** Same rule as the server: the paper_pattern column, else the title / instructions. */
export function patternIdOf(test) {
  const explicit = String(test?.paper_pattern || '').toLowerCase();
  if (PATTERNS[explicit]) return explicit;
  if (explicit === 'custom') return null;
  const text = `${test?.title || ''} ${test?.instructions || ''} ${test?.description || ''} ${test?.t_type || ''}`.toLowerCase();
  if (/jee[ _]?adv/.test(text)) return /paper[ _-]?(2|ii)\b|_p2\b/.test(text) ? 'jee_advanced_p2' : 'jee_advanced';
  if (/jee[ _]?main/.test(text)) return 'jee_main';
  if (/\bneet\b/.test(text)) return 'neet';
  return null;
}

/**
 * The marking-scheme table for the instructions page: one row per distinct
 * section, naming the subjects it applies to when they differ (JEE Advanced
 * Paper 1's Section 4 is 4 × +3 in Mathematics but 3 × +4 in Physics and
 * Chemistry).
 */
export function markingRows(pattern) {
  const rows = new Map();
  const subjectCount = Object.keys(pattern.subjects).length;
  for (const [subject, sections] of Object.entries(pattern.subjects)) {
    for (const s of sections) {
      const key = `${s.label}|${s.count}|${s.marks}|${s.negative}|${s.partial ? 1 : 0}`;
      const row = rows.get(key) || { section: s, subjects: [] };
      row.subjects.push(subject);
      rows.set(key, row);
    }
  }
  return [...rows.values()].map(({ section: s, subjects }) => ({
    name: subjects.length === subjectCount ? s.label : `${s.label} (${subjects.join(', ')})`,
    count: `${s.count} per subject`,
    marking:
      `+${s.marks} correct` +
      (s.partial ? ', partial credit +3/+2/+1 when only correct options are chosen' : '') +
      (s.negative ? `, −${s.negative} wrong` : ', no negative marking') +
      ', 0 unanswered',
  }));
}
