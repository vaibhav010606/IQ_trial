-- ============================================================================
--  EduCommand / IQ — Migration 007
--  Separates a test's *paper pattern* from its *type*.
--
--  HOW TO RUN
--    Supabase Dashboard -> SQL Editor -> paste this file -> Run.
--    Idempotent: safe to run more than once.
--
--  WHY
--    `tests.t_type` is the enum `public.test_type`, whose members are
--    quiz | mock_test | assignment | exam.
--
--    The admin console has always sent the exam *pattern* in that field —
--    'jee_main', 'jee_advanced', 'custom' — none of which are enum members. So
--    every "Create Test Shell" hit
--        22P02: invalid input value for enum test_type: "jee_main"
--    and failed. The pattern is genuinely a second axis: a JEE Main mock and a
--    custom mock are both `mock_test`, but they have different section layouts
--    and different publish rules (JEE Main enforces 20 MCQ + 10 numerical per
--    subject), so it needs its own column rather than overloading the enum.
--
--    Migration 002 attempted something similar with a `test_type text` column,
--    but naming a column after the enum *type* invites exactly this confusion,
--    and it was never applied to the live database. This supersedes it.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. The pattern column
-- ---------------------------------------------------------------------------
alter table public.tests
  add column if not exists paper_pattern text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'tests_paper_pattern_check'
  ) then
    alter table public.tests add constraint tests_paper_pattern_check
      check (paper_pattern is null or paper_pattern in ('jee_main', 'jee_advanced', 'jee_advanced_p2', 'neet', 'custom'));
  end if;
end $$;

-- Section layout for a custom paper, and the preset snapshot for a templated
-- one. Stored as JSON text, matching how the console already serialises them.
alter table public.tests
  add column if not exists preset_config   text;

alter table public.tests
  add column if not exists custom_sections text;

-- ---------------------------------------------------------------------------
-- 2. Backfill
-- ---------------------------------------------------------------------------
-- Before this column existed the console wrote the pattern into the title and
-- the generated instructions ("Pattern: JEE Main"). Read it back from there —
-- a blanket 'custom' turned every existing JEE / NEET paper into a custom one
-- and dropped its section quotas. Only what cannot be recognised is 'custom'.
update public.tests
   set paper_pattern = case
         when lower(coalesce(title, '') || ' ' || coalesce(instructions, '') || ' ' || coalesce(description, ''))
              ~ 'jee[ _]?adv' and lower(coalesce(title, '') || ' ' || coalesce(instructions, ''))
              ~ 'paper[ _-]?(2|ii)\M' then 'jee_advanced_p2'
         when lower(coalesce(title, '') || ' ' || coalesce(instructions, '') || ' ' || coalesce(description, ''))
              ~ 'jee[ _]?adv' then 'jee_advanced'
         when lower(coalesce(title, '') || ' ' || coalesce(instructions, '') || ' ' || coalesce(description, ''))
              ~ 'jee[ _]?main' then 'jee_main'
         when lower(coalesce(title, '') || ' ' || coalesce(instructions, '') || ' ' || coalesce(description, ''))
              ~ 'neet' then 'neet'
         else 'custom'
       end
 where paper_pattern is null;

-- ---------------------------------------------------------------------------
-- 3. Index — the console filters the library by pattern
-- ---------------------------------------------------------------------------
create index if not exists idx_tests_paper_pattern
  on public.tests (paper_pattern);

commit;
