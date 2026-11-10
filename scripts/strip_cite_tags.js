/**
 * One-off: remove "[cite: 161]" / "[cite: 12, 14]" markers that an AI
 * generation/import step left inside questions (text, options, answer key).
 * The UI already hides them; this cleans the stored data.
 *
 *   node scripts/strip_cite_tags.js          # dry run: counts and samples
 *   node scripts/strip_cite_tags.js --apply  # writes the cleaned rows
 *
 * Idempotent: rows without markers are skipped.
 */
const path = require('path');
require('dns').setDefaultResultOrder('ipv4first');
require(path.join(__dirname, '../backend/node_modules/dotenv')).config({
  path: path.join(__dirname, '../backend/.env'),
  quiet: true,
});
const { createClient } = require(path.join(__dirname, '../backend/node_modules/@supabase/supabase-js'));

const apply = process.argv.includes('--apply');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CITE = /\s*\[\s*cite(?:_start|_end)?\s*(?::[^\]]*)?\]/gi;
const clean = (v) => {
  if (typeof v === 'string') return v.replace(CITE, '');
  if (Array.isArray(v)) return v.map(clean);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clean(x)]));
  return v;
};

(async () => {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('questions')
      .select('id, question_text, options, correct_answer')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }

  const changed = [];
  for (const q of rows) {
    const next = {
      question_text: clean(q.question_text),
      options: clean(q.options),
      correct_answer: clean(q.correct_answer),
    };
    if (JSON.stringify(next) !== JSON.stringify({ question_text: q.question_text, options: q.options, correct_answer: q.correct_answer })) {
      changed.push({ id: q.id, before: q.question_text, ...next });
    }
  }

  console.log(`${changed.length} of ${rows.length} questions contain [cite: …] markers.`);
  for (const c of changed.slice(0, 3)) console.log(`  ${c.id}\n    before: ${String(c.before).slice(0, 100)}\n    after:  ${String(c.question_text).slice(0, 100)}`);

  if (!apply) {
    console.log('Dry run — nothing written. Re-run with --apply to clean them.');
    return;
  }
  let done = 0;
  for (const c of changed) {
    const { error } = await supabase
      .from('questions')
      .update({ question_text: c.question_text, options: c.options, correct_answer: c.correct_answer })
      .eq('id', c.id);
    if (error) throw error;
    done += 1;
    if (done % 100 === 0) console.log(`  ${done}/${changed.length}`);
  }
  console.log(`Cleaned ${done} question(s).`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
