/**
 * Generates JEE-style practice questions from computed templates and inserts
 * them into the question bank.
 *
 *   node scripts/synthetic/generate_jee_questions.js            # dry run: stats + samples
 *   node scripts/synthetic/generate_jee_questions.js --apply    # insert
 *   node scripts/synthetic/generate_jee_questions.js --remove   # delete every synthetic question
 *
 * Every answer is computed by its template, so keys are correct by construction.
 * Numerical questions always have whole-number answers (JEE Main Section B).
 * Rows are tagged source = 'synthetic' so the set can be filtered or removed.
 */
const path = require('path');
require('dns').setDefaultResultOrder('ipv4first');
const ROOT = path.join(__dirname, '../..');
require(path.join(ROOT, 'backend/node_modules/dotenv')).config({ path: path.join(ROOT, 'backend/.env'), quiet: true });
const { createClient } = require(path.join(ROOT, 'backend/node_modules/@supabase/supabase-js'));
const { rng, fmt, isInt } = require('./util');

const TARGETS = [
  { subject: 'Physics', kind: 'single', count: 1000, templates: require('./templates_physics') },
  { subject: 'Chemistry', kind: 'single', count: 1000, templates: require('./templates_chemistry') },
  { subject: 'Physics', kind: 'numerical', count: 500, templates: require('./templates_physics') },
  { subject: 'Chemistry', kind: 'numerical', count: 500, templates: require('./templates_chemistry') },
  { subject: 'Mathematics', kind: 'numerical', count: 500, templates: require('./templates_maths') },
];

const SEED = 20261110;
const LETTERS = ['A', 'B', 'C', 'D'];
const apply = process.argv.includes('--apply');
const remove = process.argv.includes('--remove');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const withUnit = (v, unit) => (unit ? `${fmt(v)} ${unit}` : fmt(v));

/** Four distinct options with the right one at a random position, or null. */
function buildOptions(r, out) {
  let correct;
  let wrong;
  if (out.ansText) {
    correct = out.ansText;
    wrong = [...new Set(out.wrongTexts)].filter((w) => w !== correct);
  } else {
    if (!Number.isFinite(out.ans)) return null;
    correct = withUnit(out.ans, out.unit);
    const pool = [...out.wrongs, out.ans * 2, out.ans / 2, out.ans * 1.5, out.ans + 1, out.ans + 2]
      .filter((w) => Number.isFinite(w))
      .filter((w) => !(out.ans >= 0 && w < 0)); // no negative distractor for a positive quantity
    wrong = [];
    for (const w of pool) {
      const s = withUnit(w, out.unit);
      if (s !== correct && !wrong.includes(s)) wrong.push(s);
      if (wrong.length === 3) break;
    }
  }
  if (wrong.length < 3) return null;
  const options = r.shuffle([correct, ...wrong.slice(0, 3)]);
  return { options, index: options.indexOf(correct) };
}

function generate(existingTexts) {
  const r = rng(SEED);
  const seen = new Set(existingTexts);
  const rows = [];
  const report = [];

  for (const t of TARGETS) {
    const eligible = t.templates.filter((tpl) => !(t.kind === 'numerical' && tpl.textOnly));
    const cap = Math.ceil((t.count / eligible.length) * 3);
    const perTemplate = new Map();
    let made = 0;
    let attempts = 0;
    let i = 0;
    while (made < t.count && attempts < t.count * 400) {
      attempts += 1;
      const tpl = eligible[i++ % eligible.length];
      if ((perTemplate.get(tpl) || 0) >= cap) continue;
      const out = tpl.gen(r);
      if (!out) continue;

      let row;
      if (t.kind === 'numerical') {
        if (out.ansText || !isInt(out.ans)) continue;
        // JEE numerical style: "... is ______ m." (a question keeps its "?").
        const unit = out.unit === 'π s' ? '' : out.unit;
        const text = out.text.endsWith('?')
          ? `${out.text}${unit ? ` (answer in ${unit})` : ''}`
          : `${out.text} ______${unit ? ` ${unit}` : ''}.`;
        if (seen.has(text)) continue;
        row = { text, q_type: 'numerical', options: [], correct_answer: { value: String(Math.round(out.ans)) } };
      } else {
        const built = buildOptions(r, out);
        if (!built) continue;
        const text = /[:?]$/.test(out.text) ? out.text : `${out.text}:`;
        if (seen.has(text)) continue;
        row = {
          text,
          q_type: 'single_correct',
          options: built.options,
          correct_answer: { index: built.index, letter: LETTERS[built.index] },
        };
      }

      seen.add(row.text);
      perTemplate.set(tpl, (perTemplate.get(tpl) || 0) + 1);
      made += 1;
      rows.push({
        subject: t.subject,
        topic: tpl.topic,
        subtopic: tpl.sub,
        difficulty: tpl.difficulty || 'medium',
        q_type: row.q_type,
        question_text: row.text,
        options: row.options,
        correct_answer: row.correct_answer,
        marks: 4,
        is_active: true,
        review_status: 'approved',
        source: 'synthetic',
      });
    }
    report.push({ ...t, made, templatesUsed: perTemplate.size, templates: undefined });
  }
  return { rows, report };
}

/** Independent re-check of every generated row before anything is written. */
function validate(rows) {
  const problems = [];
  const texts = new Set();
  for (const q of rows) {
    if (texts.has(q.question_text)) problems.push(`duplicate: ${q.question_text.slice(0, 60)}`);
    texts.add(q.question_text);
    if (/NaN|undefined|Infinity/.test(q.question_text + JSON.stringify(q.options))) problems.push(`bad value: ${q.question_text.slice(0, 60)}`);
    if (q.q_type === 'numerical') {
      if (!/^-?\d+$/.test(q.correct_answer.value)) problems.push(`non-integer key: ${q.question_text.slice(0, 60)}`);
    } else {
      if (q.options.length !== 4 || new Set(q.options).size !== 4) problems.push(`options: ${q.question_text.slice(0, 60)}`);
      if (!(q.correct_answer.index >= 0 && q.correct_answer.index < 4)) problems.push(`index: ${q.question_text.slice(0, 60)}`);
    }
  }
  return problems;
}

(async () => {
  if (remove) {
    const { data, error } = await supabase.from('questions').delete().eq('source', 'synthetic').select('id');
    if (error) throw error;
    console.log(`Removed ${data.length} synthetic question(s).`);
    return;
  }

  const existing = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('questions').select('question_text').range(from, from + 999);
    if (error) throw error;
    existing.push(...data.map((q) => q.question_text));
    if (data.length < 1000) break;
  }

  const { rows, report } = generate(existing);
  for (const t of report) console.log(`${t.subject.padEnd(12)} ${t.kind.padEnd(10)} ${t.made}/${t.count}  (from ${t.templatesUsed} templates)`);

  const problems = validate(rows);
  console.log(`validation problems: ${problems.length}`);
  problems.slice(0, 10).forEach((p) => console.log('  ' + p));

  const byTopic = {};
  for (const q of rows) byTopic[`${q.subject} | ${q.topic}`] = (byTopic[`${q.subject} | ${q.topic}`] || 0) + 1;
  console.log(`topics covered: ${Object.keys(byTopic).length}`);

  if (process.argv.includes('--sample')) {
    const r2 = rng(7);
    for (const q of r2.shuffle(rows).slice(0, Number(process.argv[process.argv.indexOf('--sample') + 1]) || 30)) {
      console.log(`
[${q.subject} · ${q.subtopic} · ${q.q_type}] ${q.question_text}`);
      console.log(q.options.length ? '   ' + q.options.map((o, i) => `${LETTERS[i]}) ${o}`).join('   ') + `   ✔ ${q.correct_answer.letter}` : `   ✔ ${q.correct_answer.value}`);
    }
    return;
  }

  if (!apply) {
    const show = (s, k) => rows.filter((q) => q.subject === s && q.q_type === k).slice(0, 2);
    for (const q of [...show('Physics', 'single_correct'), ...show('Chemistry', 'single_correct'), ...show('Physics', 'numerical'), ...show('Chemistry', 'numerical'), ...show('Mathematics', 'numerical')]) {
      console.log(`\n[${q.subject} · ${q.topic} · ${q.q_type}] ${q.question_text}`);
      if (q.options.length) console.log('   ' + q.options.map((o, i) => `${LETTERS[i]}) ${o}`).join('   ') + `   ✔ ${q.correct_answer.letter}`);
      else console.log(`   ✔ ${q.correct_answer.value}`);
    }
    console.log('\nDry run — nothing written. Re-run with --apply to insert.');
    return;
  }

  if (problems.length) throw new Error('Refusing to insert: fix the validation problems first.');
  const { data: admin } = await supabase.from('users').select('id').eq('role', 'admin').limit(1).maybeSingle();
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200).map((q) => ({ ...q, created_by: admin?.id ?? null }));
    const { error } = await supabase.from('questions').insert(batch);
    if (error) throw new Error(`Insert failed after ${inserted} rows: ${error.message}`);
    inserted += batch.length;
    console.log(`  inserted ${inserted}/${rows.length}`);
  }
  console.log(`Done: ${inserted} synthetic questions added.`);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
