-- Secure Exam Module Schema
--
-- Idempotent: safe to run more than once. Run migrations/001_exam_hardening.sql
-- after it — that file replaces the policies below with owner-scoped ones.

-- Table for tracking secure exam sessions
CREATE TABLE IF NOT EXISTS public.exam_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    exam_id UUID NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('in_progress', 'submitted', 'auto_submitted', 'violation_terminated')) DEFAULT 'in_progress',
    submitted_at TIMESTAMPTZ,
    score NUMERIC(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for tracking individual responses in real-time
CREATE TABLE IF NOT EXISTS public.exam_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    selected_answer JSONB,
    status TEXT NOT NULL CHECK (status IN ('not_visited', 'not_answered', 'answered', 'marked', 'answered_marked')) DEFAULT 'not_visited',
    time_spent_seconds INTEGER DEFAULT 0,
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(session_id, question_id)
);

-- Table for tracking cheating/violation events
CREATE TABLE IF NOT EXISTS public.exam_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.exam_sessions(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('tab_hidden', 'window_blur', 'fullscreen_exit', 'devtools_suspected')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: enabled with no permissive policies. The exam API uses the service role
-- key, which bypasses RLS; 001_exam_hardening.sql adds read-own policies.
-- (The original `FOR ALL USING (true)` policies opened these tables to anyone
-- holding the anon key, so they are no longer created here.)
ALTER TABLE public.exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_violations ENABLE ROW LEVEL SECURITY;
