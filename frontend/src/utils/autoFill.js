// Pure helpers behind the Test Constructor's "Auto-Fill Test" modal.
//
// Kept free of React so the selection rules can be unit-tested, and shared
// with TestConstructor so the modal and the publish check agree on what counts
// as an MCQ or a numerical. If they disagreed, auto-fill could produce a paper
// that the publish step then rejects for having the wrong 20/5 split.

export const MCQ_TYPES = ['mcq', 'single_correct', 'single', 'scq', 'multi_correct', 'multiple_correct', 'multi', 'multiple', 'assertion'];
export const NAT_TYPES = ['nat', 'integer', 'numerical', 'numeric', 'int'];

export const norm = (s) => String(s ?? '').trim().toLowerCase();

/** Returns the answer as an integer string, or null when it is not a whole number. */
export function extractRealInteger(val) {
  if (val === null || val === undefined) return null;
  const raw = String(typeof val === 'object' ? (val.value ?? '') : val).trim();
  if (!raw) return null;
  if (/^-?\d+$/.test(raw)) return raw;
  const cleaned = raw
    .replace(/\\text\{[^}]*\}/g, '')
    .replace(/\\mathrm\{[^}]*\}/g, '')
    .replace(/[$\s]/g, '')
    .replace(/(km\/h|m\/s|cm\/s|m\/s\^2|cm|mm|km|m|s|min|h|kg|g|N|J|W|V|A|C|T|Hz|rad\/s|rad|deg|degrees|°)/gi, '');
  if (/^-?\d+$/.test(cleaned)) return cleaned;
  if (/^-?\d+\.0+$/.test(cleaned)) return String(parseInt(cleaned, 10));
  return null;
}

/**
 * 'mcq' | 'nat' | 'subjective'.
 * A numerical only counts as 'nat' when its key is a whole number, because the
 * exam's numerical section accepts integer answers only.
 */
export function getQuestionType(q) {
  const key = norm(q?.q_type || q?.type);
  if (MCQ_TYPES.includes(key)) return 'mcq';
  if (NAT_TYPES.includes(key)) {
    return extractRealInteger(q.correct_answer) !== null ? 'nat' : 'subjective';
  }
  if (key === 'subjective') return 'subjective';
  return Array.isArray(q?.options) && q.options.length > 0 ? 'mcq' : 'subjective';
}

export function isTopicMatch(qTopic, topic) {
  const a = norm(qTopic);
  const b = norm(topic);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * Splits `total` into integer parts proportional to `weights` (largest
 * remainder), so the parts always add up to exactly `total`.
 */
export function apportion(total, weights) {
  const n = Math.max(0, Math.floor(total));
  const sum = weights.reduce((a, w) => a + Math.max(0, w), 0);
  if (!weights.length) return [];
  if (sum <= 0) {
    const base = Math.floor(n / weights.length);
    return weights.map((_, i) => base + (i < n - base * weights.length ? 1 : 0));
  }
  const exact = weights.map((w) => (n * Math.max(0, w)) / sum);
  const parts = exact.map(Math.floor);
  let left = n - parts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) parts[order[k].i]++;
  return parts;
}

export function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const DIFFS = ['easy', 'medium', 'hard'];

/**
 * Takes up to `count` questions from `candidates`, honouring the difficulty mix
 * where the bank allows it and falling back to any difficulty otherwise.
 * Approved questions are preferred: a pending one is fine on a draft, but the
 * publish step rejects it.
 */
function pick(candidates, count, mix, taken, rand) {
  if (count <= 0) return [];
  const free = shuffle(candidates.filter((q) => !taken.has(q.id)), rand)
    .sort((a, b) => (a.review_status === 'approved' ? 0 : 1) - (b.review_status === 'approved' ? 0 : 1));
  const out = [];
  const take = (q) => { out.push(q); taken.add(q.id); };

  const quotas = apportion(count, DIFFS.map((d) => mix[d] || 0));
  DIFFS.forEach((d, i) => {
    let need = quotas[i];
    for (const q of free) {
      if (need <= 0) break;
      if (!taken.has(q.id) && norm(q.difficulty || 'medium') === d) { take(q); need--; }
    }
  });
  for (const q of free) {
    if (out.length >= count) break;
    if (!taken.has(q.id)) take(q);
  }
  return out;
}

/**
 * Chooses questions for one subject.
 *
 * @param bank          every question of the subject (any review status)
 * @param opts.topics   selected topic names
 * @param opts.weights  { [topic]: percent }
 * @param opts.mcq      MCQs wanted
 * @param opts.nat      numericals wanted
 * @param opts.mix      { easy, medium, hard } percentages
 * @param opts.excludeIds ids already on the paper (never picked again)
 * @returns { chosen, shortMcq, shortNat }
 */
/**
 * Chooses questions for one subject.
 *
 * Two ways to say what is wanted:
 *  - `kinds` + `kindOf` — counts per section kind of an official pattern, e.g.
 *    { single: 7, multi: 3, numerical: 6 } for a JEE Advanced Paper 1 subject,
 *    with `kindOf(q)` from utils/examPatterns deciding each question's kind;
 *  - `mcq` + `nat` — the older two-way split, used for custom papers.
 *
 * Returns the chosen questions and, per kind, how many the bank could not supply.
 */
export function selectQuestions(bank, {
  topics, weights, mcq = 0, nat = 0, kinds = null, kindOf = null,
  mix, excludeIds = new Set(), rand = Math.random,
}) {
  const taken = new Set(excludeIds);
  const wantedByKind = kinds || { nat, mcq };
  const classify = kindOf || ((q) => {
    const t = getQuestionType(q);
    return t === 'mcq' || t === 'nat' ? t : null;
  });

  const byKind = Object.fromEntries(Object.keys(wantedByKind).map((k) => [k, []]));
  for (const q of bank) {
    const kind = classify(q);
    if (kind && byKind[kind]) byKind[kind].push(q);
  }

  const chosen = [];
  const topicWeights = topics.map((t) => weights[t] || 0);
  const short = {};

  for (const [kind, wanted] of Object.entries(wantedByKind)) {
    let need = Math.max(0, wanted || 0);
    const perTopic = apportion(need, topicWeights);
    topics.forEach((t, i) => {
      const got = pick(byKind[kind].filter((q) => isTopicMatch(q.topic, t)), perTopic[i], mix, taken, rand);
      chosen.push(...got);
      need -= got.length;
    });
    // A topic that ran dry hands its share to the rest of the selected
    // topics first, then to the whole subject.
    if (need > 0) {
      const inTopics = byKind[kind].filter((q) => topics.some((t) => isTopicMatch(q.topic, t)));
      const got = pick(inTopics, need, mix, taken, rand);
      chosen.push(...got);
      need -= got.length;
    }
    if (need > 0) {
      const got = pick(byKind[kind], need, mix, taken, rand);
      chosen.push(...got);
      need -= got.length;
    }
    short[kind] = need;
  }

  return { chosen, short, shortMcq: short.mcq || 0, shortNat: short.nat || 0 };
}

/** Distinct topics in the bank with how many usable MCQs / numericals each has. */
export function topicStats(bank) {
  const stats = new Map();
  for (const q of bank) {
    const kind = getQuestionType(q);
    if (kind !== 'mcq' && kind !== 'nat') continue;
    const t = String(q.topic || '').trim();
    if (!t) continue;
    const s = stats.get(t) || { mcq: 0, nat: 0 };
    s[kind]++;
    stats.set(t, s);
  }
  return stats;
}
