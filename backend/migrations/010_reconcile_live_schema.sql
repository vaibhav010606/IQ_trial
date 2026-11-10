-- ============================================================================
--  EduCommand / IQ — Migration 010
--  Brings tables that existed BEFORE migration 001 up to the shape the code uses.
--
--  HOW TO RUN
--    Supabase Dashboard -> SQL Editor -> paste this file -> Run.
--    Idempotent: safe to run more than once. Run after 001-009.
--
--  WHY
--    Migration 001 creates `spaced_repetition_state`, `predictions` and
--    `syllabus_items` with `create table if not exists`. On the live project
--    those tables already existed in an older shape, so 001 skipped them and the
--    columns and unique keys the code relies on were never added:
--
--      spaced_repetition_state: repetitions, ease_factor, interval_days, due_at,
--        last_reviewed_at, updated_at, unique (student_id, question_id)
--        -> every submit logged "SRS upsert failed"; /analytics/revision-due 500'd
--      predictions: accuracy, sample_size, unique (student_id, subject, topic)
--        -> risk predictions were never written
--      syllabus_items: subtopic
--        -> /lectures/syllabus/:subject 500'd
--
--    It also re-asserts the three unique keys the exam flow upserts on, in case
--    001 was only partly applied. Without `answers_attempt_question_unique`
--    every answer save fails ("no unique or exclusion constraint matching the
--    ON CONFLICT specification") and students submit blank papers.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Spaced repetition
-- ---------------------------------------------------------------------------
alter table public.spaced_repetition_state add column if not exists repetitions      integer      not null default 0;
alter table public.spaced_repetition_state add column if not exists ease_factor      numeric(4,2) not null default 2.5;
alter table public.spaced_repetition_state add column if not exists interval_days    integer      not null default 0;
alter table public.spaced_repetition_state add column if not exists due_at           timestamptz  not null default now();
alter table public.spaced_repetition_state add column if not exists last_reviewed_at timestamptz;
alter table public.spaced_repetition_state add column if not exists updated_at       timestamptz  not null default now();
alter table public.spaced_repetition_state add column if not exists mastery_level    numeric(4,3) not null default 0;
alter table public.spaced_repetition_state add column if not exists priority_weight  numeric(6,3) not null default 1;

-- Keep the newest row per (student, question) before adding the key.
with ranked as (
  select id, row_number() over (partition by student_id, question_id order by id desc) as rn
  from public.spaced_repetition_state
)
delete from public.spaced_repetition_state s using ranked r where s.id = r.id and r.rn > 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.spaced_repetition_state'::regclass and contype = 'u'
      and conname = 'spaced_repetition_state_student_question_unique'
  ) and not exists (
    select 1 from pg_constraint
    where conrelid = 'public.spaced_repetition_state'::regclass and contype = 'u'
      and conname = 'spaced_repetition_state_student_id_question_id_key'
  ) then
    alter table public.spaced_repetition_state
      add constraint spaced_repetition_state_student_question_unique unique (student_id, question_id);
  end if;
end $$;

create index if not exists idx_srs_due on public.spaced_repetition_state (student_id, due_at);

-- ---------------------------------------------------------------------------
-- 2. Predictions
-- ---------------------------------------------------------------------------
alter table public.predictions add column if not exists accuracy    numeric(5,2) not null default 0;
alter table public.predictions add column if not exists sample_size integer      not null default 0;

with ranked as (
  select id, row_number() over (partition by student_id, subject, topic order by computed_at desc, id desc) as rn
  from public.predictions
)
delete from public.predictions p using ranked r where p.id = r.id and r.rn > 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.predictions'::regclass and contype = 'u'
      and conname in ('predictions_student_subject_topic_unique', 'predictions_student_id_subject_topic_key')
  ) then
    -- NULLS NOT DISTINCT (Postgres 15+): a subject-level row has topic = null,
    -- and two nulls must still collide or the upsert inserts a duplicate.
    alter table public.predictions
      add constraint predictions_student_subject_topic_unique
      unique nulls not distinct (student_id, subject, topic);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Syllabus
-- ---------------------------------------------------------------------------
alter table public.syllabus_items add column if not exists subtopic text;

-- ---------------------------------------------------------------------------
-- 4. The keys the exam flow upserts on (also in 001; re-asserted here)
-- ---------------------------------------------------------------------------
with ranked as (
  select id, row_number() over (partition by attempt_id, question_id order by id desc) as rn
  from public.answers
)
delete from public.answers a using ranked r where a.id = r.id and r.rn > 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'answers_attempt_question_unique') then
    alter table public.answers
      add constraint answers_attempt_question_unique unique (attempt_id, question_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'attempts_student_test_unique') then
    alter table public.attempts
      add constraint attempts_student_test_unique unique (student_id, test_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'test_assignments_test_student_unique') then
    alter table public.test_assignments
      add constraint test_assignments_test_student_unique unique (test_id, student_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Paper patterns: JEE Advanced has two papers
-- ---------------------------------------------------------------------------
-- 007 first allowed jee_main | jee_advanced | neet | custom. JEE Advanced is two
-- papers with different blueprints (backend/src/modules/tests/exam-patterns.data.json),
-- so 'jee_advanced' is Paper 1 and 'jee_advanced_p2' is Paper 2.
alter table public.tests drop constraint if exists tests_paper_pattern_check;
alter table public.tests add constraint tests_paper_pattern_check
  check (paper_pattern is null or paper_pattern in ('jee_main', 'jee_advanced', 'jee_advanced_p2', 'neet', 'custom'));

commit;

notify pgrst, 'reload schema';
