"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STANDARD_PATTERN_IDS = exports.EXAM_PATTERNS = void 0;
exports.getPattern = getPattern;
exports.patternIdOf = patternIdOf;
exports.patternTotals = patternTotals;
exports.kindOfQuestion = kindOfQuestion;
exports.canonicalSubject = canonicalSubject;
exports.resolveSections = resolveSections;
exports.subjectQuota = subjectQuota;
exports.validatePaper = validatePaper;
exports.paperMarks = paperMarks;
exports.multiCorrectScore = multiCorrectScore;
exports.scoreInSection = scoreInSection;
const RAW = require('./exam-patterns.data.json');
exports.EXAM_PATTERNS = Object.fromEntries(Object.entries(RAW).filter(([key]) => !key.startsWith('_')));
exports.STANDARD_PATTERN_IDS = Object.keys(exports.EXAM_PATTERNS);
function getPattern(id) {
    return id && exports.EXAM_PATTERNS[id] ? exports.EXAM_PATTERNS[id] : null;
}
function patternIdOf(test) {
    const explicit = String(test?.paper_pattern || '').toLowerCase();
    if (exports.EXAM_PATTERNS[explicit])
        return explicit;
    if (explicit === 'custom')
        return null;
    const text = `${test?.title || ''} ${test?.instructions || ''} ${test?.description || ''} ${test?.t_type || ''}`.toLowerCase();
    if (/jee[ _]?adv/.test(text)) {
        return /paper[ _-]?(2|ii)\b|_p2\b/.test(text) ? 'jee_advanced_p2' : 'jee_advanced';
    }
    if (/jee[ _]?main/.test(text))
        return 'jee_main';
    if (/\bneet\b/.test(text))
        return 'neet';
    return null;
}
function patternTotals(pattern) {
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
function kindOfQuestion(q) {
    const key = String(q?.q_type || '').trim().toLowerCase();
    if (SINGLE_TYPES.includes(key))
        return 'single';
    if (MULTI_TYPES.includes(key))
        return 'multi';
    if (NUMERICAL_TYPES.includes(key))
        return 'numerical';
    if (key === 'subjective')
        return null;
    return Array.isArray(q?.options) && q.options.length > 0 ? 'single' : null;
}
function canonicalSubject(subject, pattern) {
    const s = String(subject || '').trim().toLowerCase();
    if (!s)
        return null;
    const aliases = {
        math: 'mathematics',
        maths: 'mathematics',
        botany: 'biology',
        zoology: 'biology',
    };
    const wanted = aliases[s] || s;
    return Object.keys(pattern.subjects).find((k) => k.toLowerCase() === wanted) || null;
}
function resolveSections(pattern, rows) {
    const out = new Map();
    const ordered = [...rows].sort((a, b) => (a.question_order ?? 0) - (b.question_order ?? 0));
    for (const [subject, sections] of Object.entries(pattern.subjects)) {
        const queues = { single: [], multi: [], numerical: [] };
        for (const row of ordered) {
            if (canonicalSubject(row.subject, pattern) !== subject)
                continue;
            const kind = kindOfQuestion(row);
            if (kind)
                queues[kind].push(row);
        }
        for (const section of sections) {
            for (const row of queues[section.kind].splice(0, section.count)) {
                out.set(row.question_id, { ...section, subject });
            }
        }
    }
    return out;
}
const KIND_LABEL = {
    single: 'single-correct',
    multi: 'one-or-more-correct',
    numerical: 'numerical',
};
function subjectQuota(pattern, subject) {
    const quota = { single: 0, multi: 0, numerical: 0 };
    for (const s of pattern.subjects[subject] || [])
        quota[s.kind] += s.count;
    return quota;
}
function validatePaper(pattern, rows) {
    const problems = [];
    const actual = new Map();
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
        for (const kind of ['single', 'multi', 'numerical']) {
            if (want[kind] !== have[kind]) {
                problems.push(`${subject}: ${have[kind]} ${KIND_LABEL[kind]} question(s), the pattern needs ${want[kind]}.`);
            }
        }
    }
    return [...new Set(problems)];
}
function paperMarks(pattern, rows) {
    const sections = resolveSections(pattern, rows);
    return rows.reduce((sum, row) => {
        const section = sections.get(row.question_id);
        return sum + (section ? section.marks : Number(row.marks_override || row.marks || 4));
    }, 0);
}
function indicesOf(answer) {
    if (Array.isArray(answer?.indices))
        return answer.indices.map(Number);
    if (answer?.index !== undefined && answer?.index !== null)
        return [Number(answer.index)];
    return [];
}
function numericEquals(submitted, correct, rule) {
    const a = Number(String(submitted ?? '').trim());
    const b = Number(String(correct ?? '').trim());
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
        return String(submitted ?? '').trim().toLowerCase() === String(correct ?? '').trim().toLowerCase();
    }
    if (rule === 'integer')
        return a === b;
    const round2 = (x) => Math.round(x * 100) / 100;
    const trunc2 = (x) => Math.trunc(x * 100) / 100;
    return round2(a) === round2(b) || trunc2(a) === round2(b);
}
function multiCorrectScore(chosen, correct, section) {
    const c = new Set(correct);
    const s = new Set(chosen);
    if (!s.size)
        return 0;
    const allChosenCorrect = [...s].every((x) => c.has(x));
    if (allChosenCorrect && s.size === c.size)
        return section.marks;
    if (section.partial && allChosenCorrect) {
        if (c.size === 4 && s.size === 3)
            return 3;
        if (c.size >= 3 && s.size === 2)
            return 2;
        if (c.size >= 2 && s.size === 1)
            return 1;
    }
    return -section.negative;
}
function scoreInSection(section, submitted, correct, numericRule) {
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
//# sourceMappingURL=exam-patterns.js.map