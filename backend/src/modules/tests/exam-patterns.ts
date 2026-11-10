/**
 * Official exam patterns — JEE Main (NTA), JEE Advanced (IIT/JAB), NEET (NTA).
 *
 * The blueprints themselves live in exam-patterns.json, the single source of
 * truth shared with both frontends. This module applies them: which section a
 * question on a paper belongs to, whether a paper matches its pattern, what it
 * is worth, and how one response is scored (including JEE Advanced partial
 * marking). Everything that counts questions or awards marks goes through here,
 * so a pattern is defined once and followed everywhere.
 */

// Loaded at runtime (nest-cli copies it into dist as an asset). A plain require
// keeps it out of the TS module graph, which runs as CommonJS under nodenext.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RAW: Record<string, any> = require('./exam-patterns.data.json');

export type SectionKind = 'single' | 'multi' | 'numerical';

export interface SectionSpec {
  id: string;
  label: string;
  kind: SectionKind;
  count: number;
  marks: number;
  /** Marks deducted for a wrong response (a positive number; 0 = no negative). */
  negative: number;
  /** JEE Advanced one-or-more-correct partial marking. */
  partial?: boolean;
}

export interface PatternSpec {
  label: string;
  authority: string;
  edition: string;
  durationMinutes: number;
  /** How numerical answers are compared: whole numbers, or to two decimals. */
  numericAnswer: 'integer' | 'decimal2';
  subjects: Record<string, SectionSpec[]>;
}

export const EXAM_PATTERNS: Record<string, PatternSpec> = Object.fromEntries(
  Object.entries(RAW).filter(([key]) => !key.startsWith('_')),
) as Record<string, PatternSpec>;

export const STANDARD_PATTERN_IDS = Object.keys(EXAM_PATTERNS);

export function getPattern(id?: string | null): PatternSpec | null {
  return id && EXAM_PATTERNS[id] ? EXAM_PATTERNS[id] : null;
}

/**
 * The pattern of a test row. Prefers the `paper_pattern` column; tests created
 * before it existed carry the pattern in their title / generated instructions.
 */
export function patternIdOf(test: any): string | null {
  const explicit = String(test?.paper_pattern || '').toLowerCase();
  if (EXAM_PATTERNS[explicit]) return explicit;
  if (explicit === 'custom') return null;

  const text =
    `${test?.title || ''} ${test?.instructions || ''} ${test?.description || ''} ${test?.t_type || ''}`.toLowerCase();
  if (/jee[ _]?adv/.test(text)) {
    return /paper[ _-]?(2|ii)\b|_p2\b/.test(text) ? 'jee_advanced_p2' : 'jee_advanced';
  }
  if (/jee[ _]?main/.test(text)) return 'jee_main';
  if (/\bneet\b/.test(text)) return 'neet';
  return null;
}

/** Total questions and marks of a pattern. */
export function patternTotals(pattern: PatternSpec): { questions: number; marks: number } {
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

/** Which kind of section a bank question can fill. Subjective questions fit none. */
export function kindOfQuestion(q: { q_type?: string | null; options?: any }): SectionKind | null {
  const key = String(q?.q_type || '').trim().toLowerCase();
  if (SINGLE_TYPES.includes(key)) return 'single';
  if (MULTI_TYPES.includes(key)) return 'multi';
  if (NUMERICAL_TYPES.includes(key)) return 'numerical';
  if (key === 'subjective') return null;
  return Array.isArray(q?.options) && q.options.length > 0 ? 'single' : null;
}

/** The pattern's name for a question's subject (Maths -> Mathematics, Botany -> Biology). */
export function canonicalSubject(subject: string | null | undefined, pattern: PatternSpec): string | null {
  const s = String(subject || '').trim().toLowerCase();
  if (!s) return null;
  const aliases: Record<string, string> = {
    math: 'mathematics',
    maths: 'mathematics',
    botany: 'biology',
    zoology: 'biology',
  };
  const wanted = aliases[s] || s;
  return Object.keys(pattern.subjects).find((k) => k.toLowerCase() === wanted) || null;
}

export interface PaperQuestion {
  question_id: string;
  question_order?: number | null;
  subject?: string | null;
  q_type?: string | null;
  options?: any;
}

/**
 * Assigns each question on a paper to its official section.
 *
 * Per subject, questions are taken in paper order and poured into the sections
 * in order, each section accepting its kind up to its count — so JEE Advanced
 * Paper 1's four single-correct questions fill Section 1 and the next ones fill
 * Section 4 (matching), exactly as the paper is laid out. A question with no
 * section left for it (over quota, or the wrong kind) is not in the map.
 */
export function resolveSections(
  pattern: PatternSpec,
  rows: PaperQuestion[],
): Map<string, SectionSpec & { subject: string }> {
  const out = new Map<string, SectionSpec & { subject: string }>();
  const ordered = [...rows].sort((a, b) => (a.question_order ?? 0) - (b.question_order ?? 0));

  for (const [subject, sections] of Object.entries(pattern.subjects)) {
    const queues: Record<SectionKind, PaperQuestion[]> = { single: [], multi: [], numerical: [] };
    for (const row of ordered) {
      if (canonicalSubject(row.subject, pattern) !== subject) continue;
      const kind = kindOfQuestion(row);
      if (kind) queues[kind].push(row);
    }
    for (const section of sections) {
      for (const row of queues[section.kind].splice(0, section.count)) {
        out.set(row.question_id, { ...section, subject });
      }
    }
  }
  return out;
}

const KIND_LABEL: Record<SectionKind, string> = {
  single: 'single-correct',
  multi: 'one-or-more-correct',
  numerical: 'numerical',
};

/** Expected question count per kind for one subject of a pattern. */
export function subjectQuota(pattern: PatternSpec, subject: string): Record<SectionKind, number> {
  const quota: Record<SectionKind, number> = { single: 0, multi: 0, numerical: 0 };
  for (const s of pattern.subjects[subject] || []) quota[s.kind] += s.count;
  return quota;
}

/**
 * Everything about a paper that departs from its official pattern, as
 * human-readable lines. Empty means the paper is exactly to pattern.
 */
export function validatePaper(pattern: PatternSpec, rows: PaperQuestion[]): string[] {
  const problems: string[] = [];
  const actual = new Map<string, Record<SectionKind, number>>();

  for (const row of rows) {
    const subject = canonicalSubject(row.subject, pattern);
    if (!subject) {
      problems.push(`"${row.subject || 'Unknown'}" is not a subject in ${pattern.label}.`);
      continue;
    }
    const kind = kindOfQuestion(row);
    if (!kind) {
      problems.push(`${subject}: a subjective question cannot be used in ${pattern.label}.`);
      continue;
    }
    const counts = actual.get(subject) || { single: 0, multi: 0, numerical: 0 };
    counts[kind] += 1;
    actual.set(subject, counts);
  }

  for (const subject of Object.keys(pattern.subjects)) {
    const want = subjectQuota(pattern, subject);
    const have = actual.get(subject) || { single: 0, multi: 0, numerical: 0 };
    for (const kind of ['single', 'multi', 'numerical'] as SectionKind[]) {
      if (want[kind] !== have[kind]) {
        problems.push(`${subject}: ${have[kind]} ${KIND_LABEL[kind]} question(s), the pattern needs ${want[kind]}.`);
      }
    }
  }

  // Report each unknown-subject / subjective problem once.
  return [...new Set(problems)];
}

/** Marks a paper is worth under its pattern (questions outside any section count their own marks). */
export function paperMarks(
  pattern: PatternSpec,
  rows: (PaperQuestion & { marks?: number | null; marks_override?: number | null })[],
): number {
  const sections = resolveSections(pattern, rows);
  return rows.reduce((sum, row) => {
    const section = sections.get(row.question_id);
    return sum + (section ? section.marks : Number(row.marks_override || row.marks || 4));
  }, 0);
}

function indicesOf(answer: any): number[] {
  if (Array.isArray(answer?.indices)) return answer.indices.map(Number);
  if (answer?.index !== undefined && answer?.index !== null) return [Number(answer.index)];
  return [];
}

function numericEquals(submitted: any, correct: any, rule: PatternSpec['numericAnswer']): boolean {
  const a = Number(String(submitted ?? '').trim());
  const b = Number(String(correct ?? '').trim());
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return String(submitted ?? '').trim().toLowerCase() === String(correct ?? '').trim().toLowerCase();
  }
  if (rule === 'integer') return a === b;
  // JEE Advanced: "truncate/round-off the value to TWO decimal places".
  const round2 = (x: number) => Math.round(x * 100) / 100;
  const trunc2 = (x: number) => Math.trunc(x * 100) / 100;
  return round2(a) === round2(b) || trunc2(a) === round2(b);
}

/**
 * JEE Advanced one-or-more-correct marking, as printed on the 2025 papers:
 *   +4 only if all the correct options are chosen;
 *   +3 if all four options are correct but only three are chosen;
 *   +2 if three or more are correct but only two are chosen, both correct;
 *   +1 if two or more are correct but only one is chosen and it is correct;
 *    0 if unanswered; −2 in all other cases.
 */
export function multiCorrectScore(chosen: number[], correct: number[], section: SectionSpec): number {
  const c = new Set(correct);
  const s = new Set(chosen);
  if (!s.size) return 0;
  const allChosenCorrect = [...s].every((x) => c.has(x));
  if (allChosenCorrect && s.size === c.size) return section.marks;
  if (section.partial && allChosenCorrect) {
    if (c.size === 4 && s.size === 3) return 3;
    if (c.size >= 3 && s.size === 2) return 2;
    if (c.size >= 2 && s.size === 1) return 1;
  }
  return -section.negative;
}

/**
 * Scores one attempted response against its section's marking scheme.
 * `full` is true only for full marks (partial credit is not "correct").
 */
export function scoreInSection(
  section: SectionSpec,
  submitted: any,
  correct: any,
  numericRule: PatternSpec['numericAnswer'],
): { score: number; full: boolean } {
  if (section.kind === 'multi') {
    const score = multiCorrectScore(indicesOf(submitted), indicesOf(correct), section);
    return { score, full: score === section.marks };
  }
  if (section.kind === 'numerical') {
    const ok = numericEquals(submitted?.value, correct?.value, numericRule);
    return { score: ok ? section.marks : -section.negative, full: ok };
  }
  const chosen = indicesOf(submitted);
  const key = indicesOf(correct);
  const ok = chosen.length === 1 && key.length === 1 && chosen[0] === key[0];
  return { score: ok ? section.marks : -section.negative, full: ok };
}
