/**
 * One-off: copy each teacher's subject from user_metadata into app_metadata.
 *
 * The API now scopes teachers by app_metadata.subject (only the service role can
 * write it). Accounts created before that change only have the subject in
 * user_metadata, which users can edit themselves. Run this once per environment:
 *
 *   node scripts/backfill_subject_app_metadata.js          # dry run, prints the plan
 *   node scripts/backfill_subject_app_metadata.js --apply  # writes app_metadata
 *
 * Idempotent: users that already have app_metadata.subject are skipped.
 */
const path = require('path');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
require(path.join(__dirname, '../backend/node_modules/dotenv')).config({
  path: path.join(__dirname, '../backend/.env'),
  quiet: true,
});
const { createClient } = require(path.join(__dirname, '../backend/node_modules/@supabase/supabase-js'));

const apply = process.argv.includes('--apply');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

(async () => {
  let page = 1;
  let changed = 0;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const u of users) {
      const fromUser = u.user_metadata?.subject;
      if (!fromUser || u.app_metadata?.subject) continue;
      console.log(`${apply ? 'update' : 'would update'} ${u.id}: app_metadata.subject = ${fromUser}`);
      if (apply) {
        const { error: upErr } = await supabase.auth.admin.updateUserById(u.id, {
          app_metadata: { ...(u.app_metadata || {}), subject: fromUser },
        });
        if (upErr) throw upErr;
      }
      changed += 1;
    }
    if (users.length < 200) break;
    page += 1;
  }
  console.log(`${changed} user(s) ${apply ? 'updated' : 'to update (dry run — pass --apply)'}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
