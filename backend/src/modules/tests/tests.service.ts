import {
  Injectable,
  Logger,
  Optional,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { supabase } from '../../config/supabase.config';
import { throwSupabaseError } from '../../common/db/supabase-error';
import { CacheService } from '../../common/cache/cache.service';
import {
  getPattern,
  paperMarks,
  PaperQuestion,
  patternIdOf,
  PatternSpec,
  validatePaper,
} from './exam-patterns';
import {
  fetchAll,
  fetchAllIn,
  ID_CHUNK_SIZE,
  insertInBatches,
  runInChunks,
} from '../../common/db/query.util';
import {
  AssignTestDto,
  CreateTestDto,
  SaveFullTestDto,
  UpdateTestDto,
} from './dto/test.dto';

/** Allowance for client clock skew, matching AttemptsService. */
const CLOCK_GRACE_SECONDS = 30;

export interface Requester {
  id: string;
  role?: string;
  subject?: string;
}

/** Columns a client may set on a test. Everything else is server-derived. */
const WRITABLE_COLUMNS = [
  'title',
  'description',
  'subject',
  'duration_minutes',
  'negative_marking',
  'negative_marks',
  'instructions',
] as const;

/**
 * Members of the `public.test_type` enum. Anything outside this set is rejected
 * by Postgres with 22P02, so it is mapped rather than passed through.
 */
const TEST_TYPE_VALUES = ['quiz', 'mock_test', 'assignment', 'exam'] as const;

/** Patterns `tests.paper_pattern` accepts (see migration 007). */
const PAPER_PATTERNS = [
  'jee_main',
  'jee_advanced',
  'jee_advanced_p2',
  'neet',
  'custom',
] as const;

/**
 * The console sends the exam *pattern* in `t_type` — 'jee_main', 'custom' — but
 * the column is an enum of test *kinds*. They are different axes: a JEE Main
 * mock and a custom mock are both `mock_test`, yet they have different section
 * layouts and different publish rules. This maps a pattern onto the enum; the
 * pattern itself is stored separately in `paper_pattern`.
 */
const PATTERN_TO_TYPE: Record<string, (typeof TEST_TYPE_VALUES)[number]> = {
  jee_main: 'mock_test',
  jee_advanced: 'mock_test',
  jee_advanced_p2: 'mock_test',
  neet: 'mock_test',
  custom: 'quiz',
};

/**
 * Checks whether test results have been approved and published by the administrator.
 * Supports both native `results_published` boolean column (migration 009) and
 * metadata tag fallback in `instructions`/`description`.
 */
export function isTestResultsPublished(test: any): boolean {
  if (!test) return false;
  if (test.results_published === true) return true;
  if (
    typeof test.instructions === 'string' &&
    test.instructions.includes('[RESULTS_PUBLISHED:true]')
  ) {
    return true;
  }
  if (
    typeof test.description === 'string' &&
    test.description.includes('[RESULTS_PUBLISHED:true]')
  ) {
    return true;
  }
  return false;
}

/**
 * Which of these tests have had their results released by an admin.
 *
 * Anything that shows a score, a rank or right/wrong — the leaderboard, a
 * student's own analytics — must filter through this. Otherwise a student
 * learns their marks (and their rank moving) the moment they submit, before
 * the admin has approved the results.
 *
 * Selects `*` because `results_published` only exists after migration 009;
 * older databases carry the flag as a tag in `instructions` / `description`.
 */
export async function releasedTestIds(testIds: string[]): Promise<Set<string>> {
  const unique = [...new Set(testIds.filter(Boolean))];
  if (!unique.length) return new Set();
  const rows = await fetchAllIn<any>(unique, (idChunk) =>
    supabase.from('tests').select('*').in('id', idChunk),
  );
  return new Set(
    rows.filter((t) => isTestResultsPublished(t)).map((t) => t.id),
  );
}

export function stripInternalTags(text?: string): string {
  if (!text) return '';
  return text.replace(/\[RESULTS_PUBLISHED:(true|false)\]/g, '').trim();
}

@Injectable()
export class TestsService {
  private readonly logger = new Logger(TestsService.name);

  /** Whether migration 007 has been applied. Probed lazily, then remembered. */
  private hasPaperPattern: boolean | null = null;

  // Optional so the unit tests can construct the service bare.
  constructor(@Optional() private readonly cache?: CacheService) {}

  // ── Authorisation ───────────────────────────────────────────────────────────

  /**
   * Two levels of access to a test, because two different jobs happen on one.
   *
   *  - *Administering* a paper — renaming it, changing its duration or marking
   *    scheme, publishing it, scheduling it, deleting it. Owner-level.
   *  - *Contributing* to a paper — adding the questions for your subject to a
   *    shell an admin created and assigned you. That is the whole point of
   *    `test_teachers`, and it must not also grant the power to republish or
   *    reschedule somebody else's exam.
   *
   * Both 404 when the test does not exist. The previous single check was
   * `if (test && test.created_by !== user.id) throw`, which silently allowed the
   * operation when the lookup returned nothing.
   */
  private async loadForAccess(testId: string): Promise<any> {
    const { data: test } = await supabase
      .from('tests')
      .select('id, created_by, status')
      .eq('id', testId)
      .single();

    if (!test) throw new NotFoundException('Test not found');
    return test;
  }

  /** Owner-level: admin, or the person who created the test. */
  private async assertCanAdminister(
    testId: string,
    user: Requester,
  ): Promise<any> {
    const test = await this.loadForAccess(testId);
    if (user.role === 'admin' || test.created_by === user.id) return test;

    throw new ForbiddenException(
      'Only an admin or the teacher who created this test can change it.',
    );
  }

  /** Owner-level, plus any teacher assigned to fill questions on this paper. */
  private async assertCanContribute(
    testId: string,
    user: Requester,
  ): Promise<any> {
    const test = await this.loadForAccess(testId);
    if (user.role === 'admin' || test.created_by === user.id) return test;

    const { data: collaborator } = await supabase
      .from('test_teachers')
      .select('teacher_id')
      .eq('test_id', testId)
      .eq('teacher_id', user.id)
      .maybeSingle();

    if (collaborator) return test;
    throw new ForbiddenException('You do not have access to this test.');
  }

  /**
   * Confirms a student is assigned this test and that the exam window is open.
   *
   * `GET /api/tests/:id` and `GET /api/tests/:id/questions` used to take only an
   * id, so any logged-in student could pull down the full question paper for any
   * test — including one scheduled for next week, or one assigned to a different
   * batch entirely. Returns the merged window for the caller.
   */
  private async assertStudentMaySit(
    testId: string,
    studentId: string,
    { requireOpen = true } = {},
  ): Promise<void> {
    const { data: test } = await supabase
      .from('tests')
      .select('id, status')
      .eq('id', testId)
      .single();

    if (!test) throw new NotFoundException('Test not found');
    if (test.status !== 'published') {
      throw new ForbiddenException('This test is not available.');
    }

    const { data: rows, error } = await supabase
      .from('test_assignments')
      .select('scheduled_start, scheduled_end')
      .eq('test_id', testId)
      .eq('student_id', studentId);

    if (error) throw new Error(error.message);
    if (!rows?.length)
      throw new ForbiddenException('You are not assigned to this test.');

    if (!requireOpen) return;

    // Widest window across every batch the student sits in.
    const starts = rows.map((r) =>
      r.scheduled_start ? new Date(r.scheduled_start).getTime() : null,
    );
    const ends = rows.map((r) =>
      r.scheduled_end ? new Date(r.scheduled_end).getTime() : null,
    );
    const opensAt = starts.includes(null)
      ? null
      : Math.min(...(starts as number[]));
    const closesAt = ends.includes(null)
      ? null
      : Math.max(...(ends as number[]));

    const now = Date.now();
    const grace = CLOCK_GRACE_SECONDS * 1000;

    if (opensAt !== null && now < opensAt - grace) {
      throw new ForbiddenException(
        `This test opens at ${new Date(opensAt).toISOString()}.`,
      );
    }
    if (closesAt !== null && now > closesAt + grace) {
      throw new ForbiddenException('The window for this test has closed.');
    }
  }

  /** Strips everything that is not a client-writable column. */
  private pickWritable(body: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const key of WRITABLE_COLUMNS) {
      if (body?.[key] !== undefined) out[key] = body[key];
    }
    // Negative marks only mean anything when the scheme is on.
    if (out.negative_marking === false) out.negative_marks = 0;

    Object.assign(out, this.resolveTypeAndPattern(body));
    return out;
  }

  /**
   * Works out the enum `t_type` and the `paper_pattern` from whatever the client
   * sent in either field.
   *
   * Accepts a pattern in `t_type` for compatibility with the existing console,
   * which has always used that field for 'jee_main' / 'custom'.
   */
  private resolveTypeAndPattern(
    body: Record<string, any>,
  ): Record<string, any> {
    const raw = String(body?.paper_pattern ?? body?.t_type ?? '')
      .trim()
      .toLowerCase();
    if (!raw) return {};

    // A genuine enum member: pass it through, no pattern implied.
    if ((TEST_TYPE_VALUES as readonly string[]).includes(raw)) {
      return { t_type: raw };
    }

    if ((PAPER_PATTERNS as readonly string[]).includes(raw)) {
      return { t_type: PATTERN_TO_TYPE[raw], paper_pattern: raw };
    }

    throw new BadRequestException(
      `Unknown test type "${raw}". Expected one of: ${[...TEST_TYPE_VALUES, ...PAPER_PATTERNS].join(', ')}.`,
    );
  }

  /**
   * Retries a write without `paper_pattern` when migration 007 has not been run.
   *
   * Same approach AttemptsService takes for migration 005: a database one
   * migration behind degrades instead of failing every test creation.
   */
  private async insertTest(row: Record<string, any>): Promise<any> {
    const { data, error } = await supabase
      .from('tests')
      .insert(row)
      .select()
      .single();
    if (!error) {
      if (this.hasPaperPattern === null && 'paper_pattern' in row)
        this.hasPaperPattern = true;
      return data;
    }

    if ('paper_pattern' in row && this.isMissingColumn(error)) {
      if (this.hasPaperPattern === null) {
        this.hasPaperPattern = false;
        this.logger.warn(
          'tests.paper_pattern is missing — run backend/migrations/007_test_paper_pattern.sql. ' +
            'Paper patterns will not be stored until then.',
        );
      }
      const { paper_pattern: _dropped, ...withoutPattern } = row;
      const retry = await supabase
        .from('tests')
        .insert(withoutPattern)
        .select()
        .single();
      if (retry.error) throwSupabaseError(retry.error, 'tests.insert');
      return retry.data;
    }

    throwSupabaseError(error, 'tests.insert');
  }

  /** True when PostgREST is saying the column simply is not there. */
  private isMissingColumn(error: any): boolean {
    const code = String(error?.code || '');
    if (code === 'PGRST204' || code === '42703') return true;
    return /column .* does not exist|schema cache/i.test(
      String(error?.message || ''),
    );
  }

  /**
   * Whether `tests.paper_pattern` exists, probed once and then remembered.
   *
   * Reads have to know before they build a select list: naming a column that
   * does not exist fails the whole query, so on a database that has not run
   * migration 007 the test library would break rather than just omit a field.
   *
   * Two things this has to get right, both learned the hard way:
   *
   *  - The probe must NOT use `{ head: true }`. A HEAD response carries no
   *    body, so PostgREST's error payload never arrives and postgrest-js
   *    surfaces `{ message: '' }` with no code — indistinguishable from
   *    success to any inspection of the error. A one-row GET returns the real
   *    `42703`.
   *  - An inconclusive probe must fall back to *absent*. Omitting an optional
   *    column degrades gracefully; wrongly including one fails every read.
   */
  private async paperPatternAvailable(): Promise<boolean> {
    if (this.hasPaperPattern !== null) return this.hasPaperPattern;

    const { error } = await supabase
      .from('tests')
      .select('paper_pattern')
      .limit(1);

    if (!error) {
      this.hasPaperPattern = true;
      return true;
    }

    if (this.isMissingColumn(error)) {
      this.hasPaperPattern = false;
      this.logger.warn(
        'tests.paper_pattern is missing — run backend/migrations/007_test_paper_pattern.sql. ' +
          'Paper patterns will not be stored or returned until then.',
      );
      return false;
    }

    // Something else went wrong (a blip, a permissions change). Leave the result
    // uncached so the next call re-probes, and omit the column meanwhile.
    this.logger.warn(`Could not probe tests.paper_pattern: ${error.message}`);
    return false;
  }

  /** Appends `paper_pattern` to a select list only when the column exists. */
  private async withPattern(columns: string): Promise<string> {
    return (await this.paperPatternAvailable())
      ? `${columns}, paper_pattern`
      : columns;
  }

  isTestResultsPublished(test: any): boolean {
    return isTestResultsPublished(test);
  }

  stripInternalTags(text?: string): string {
    return stripInternalTags(text);
  }

  /**
   * If `paper_pattern` is not populated (e.g. before migration 007),
   * infer the assessment pattern from the title, instructions, or description.
   */
  private attachInferredPattern(t: any): any {
    if (!t) return t;
    if (!t.paper_pattern) {
      const text =
        `${t.title || ''} ${t.description || ''} ${t.instructions || ''} ${t.t_type || ''}`.toLowerCase();
      if (text.includes('jee main') || text.includes('jee_main')) {
        t.paper_pattern = 'jee_main';
      } else if (
        text.includes('jee advanced') ||
        text.includes('jee_advanced') ||
        text.includes('jee adv')
      ) {
        t.paper_pattern = 'jee_advanced';
      } else if (text.includes('neet')) {
        t.paper_pattern = 'neet';
      } else if (t.t_type && t.t_type !== 'mock_test') {
        t.paper_pattern = t.t_type;
      }
    }
    return t;
  }

  // ── Teacher reads ───────────────────────────────────────────────────────────

  /**
   * List tests for the staff console.
   *
   * This used to select `test_questions(question_id, questions(*))` for *every*
   * test, which meant one page load serialised the whole question bank — full
   * question text, options and answer keys — for every test in the library. The
   * list only needs each question's subject, to show the per-subject counts, so
   * that is all it asks for now, and the response is paginated.
   */
  async findAll(
    user: Requester,
    filters: { status?: string; page?: number; limit?: number } = {},
  ) {
    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 200);
    const from = (page - 1) * limit;

    const base = await this.withPattern(
      `id, title, description, instructions, subject, t_type, status, duration_minutes,
       total_marks, negative_marking, negative_marks, created_at, created_by`,
    );

    let query = supabase
      .from('tests')
      .select(
        `${base},
        test_teachers(teacher_id, subject, users(id, full_name, email)),
        test_questions(question_id, questions(subject))`,
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);

    if (filters.status) query = query.eq('status', filters.status);

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const total = count ?? 0;
    return {
      data: (data || []).map((t: any) => {
        const enriched = this.attachInferredPattern(t);
        const results_published = this.isTestResultsPublished(t);
        return {
          ...enriched,
          results_published,
          instructions: this.stripInternalTags(t.instructions),
          questionCount: enriched.test_questions?.length ?? 0,
          // Kept for the older callers that read snake_case.
          question_count: enriched.test_questions?.length ?? 0,
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Get test details + its questions.
   *
   * Staff see the paper; a student only sees it if they are assigned and the
   * window is open, and never sees `correct_answer`.
   */
  async findOne(id: string, user: Requester) {
    const isStudent = user.role === 'student';
    if (isStudent) {
      await this.assertStudentMaySit(id, user.id);
    } else {
      await this.assertCanContribute(id, user);
    }

    const base = await this.withPattern(
      `id, title, description, instructions, subject, t_type, status, duration_minutes, total_marks,
       negative_marking, negative_marks, created_at, created_by`,
    );

    // The answer key is never selected for a student. Both exam screens call
    // this endpoint while the exam is running, and selecting `correct_answer`
    // here put every answer in the browser's network tab.
    const questionColumns = isStudent
      ? 'id, subject, topic, question_text, options, difficulty, q_type, marks, image_url'
      : 'id, subject, topic, question_text, options, correct_answer, difficulty, q_type, marks, image_url';

    const { data, error } = await supabase
      .from('tests')
      .select(
        `${base},
        test_questions(question_order, marks_override, questions(${questionColumns}))`,
      )
      .eq('id', id)
      .single();
    if (error || !data) throw new NotFoundException('Test not found');
    const testRow: any = data;
    const results_published = this.isTestResultsPublished(testRow);
    return {
      ...this.attachInferredPattern(testRow),
      results_published,
      instructions: this.stripInternalTags(testRow.instructions),
    };
  }

  // ── Teacher writes ──────────────────────────────────────────────────────────

  /** Create a new test (starts as 'draft') */
  async create(body: CreateTestDto, user: Requester) {
    const data = await this.insertTest({
      ...this.pickWritable(body),
      created_by: user.id,
      status: 'draft',
      total_marks: 0,
    });

    // Optionally assign teachers right away
    const ids = Array.isArray(body.teacher_ids) ? body.teacher_ids : [];
    if (ids.length > 0) {
      const { error: teacherError } = await supabase
        .from('test_teachers')
        .insert(ids.map((tid) => ({ test_id: data.id, teacher_id: tid })));

      // The shell exists either way; a failed assignment is worth surfacing
      // rather than silently swallowing, which is what happened before.
      if (teacherError) {
        this.logger.error(
          `Test ${data.id} created but teacher assignment failed: ${teacherError.message}`,
        );
        return {
          ...data,
          teacherAssignmentWarning:
            'Test created, but teacher assignment failed. Please assign teachers again.',
        };
      }
    }

    return data;
  }

  /** [Admin] Set the full list of teachers assigned to a test (replaces previous list) */
  async assignTeachers(testId: string, teacherIds: string[]) {
    const { data: test } = await supabase
      .from('tests')
      .select('id')
      .eq('id', testId)
      .single();
    if (!test) throw new NotFoundException('Test not found');

    const { error: delError } = await supabase
      .from('test_teachers')
      .delete()
      .eq('test_id', testId);
    if (delError) throw new Error(delError.message);

    if (teacherIds.length > 0) {
      const { error: insError } = await supabase
        .from('test_teachers')
        .insert(
          teacherIds.map((tid) => ({ test_id: testId, teacher_id: tid })),
        );
      if (insError) throw new Error(insError.message);
    }

    const { data, error } = await supabase
      .from('tests')
      .select(
        'id, title, test_teachers(teacher_id, users(id, full_name, email))',
      )
      .eq('id', testId)
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  /** Update test metadata */
  async update(id: string, body: UpdateTestDto, user: Requester) {
    await this.assertCanAdminister(id, user);

    const row: Record<string, any> = {
      ...this.pickWritable(body),
      updated_at: new Date().toISOString(),
    };
    if ('paper_pattern' in row && !(await this.paperPatternAvailable())) {
      // Same degradation as insertTest: without migration 007 the column is
      // absent and naming it fails the whole update ("Failed to publish").
      delete row.paper_pattern;
    }

    const { data, error } = await supabase
      .from('tests')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  /** Delete a test and everything hanging off it */
  async remove(id: string, user: Requester) {
    await this.assertCanAdminister(id, user);

    // Manual cascade delete to satisfy foreign key constraints. Every id list is
    // chunked — a popular test has one attempt per student, and a thousand UUIDs
    // in a single `.in()` overflows the PostgREST request URL.
    const attempts = await fetchAll<{ id: string }>(() =>
      supabase.from('attempts').select('id').eq('test_id', id),
    );

    if (attempts.length) {
      const attemptIds = attempts.map((a) => a.id);
      await runInChunks(attemptIds, (ids) =>
        supabase.from('answers').delete().in('attempt_id', ids),
      );
      await runInChunks(attemptIds, (ids) =>
        supabase.from('attempt_violations').delete().in('attempt_id', ids),
      ).catch(() => undefined); // table only exists once migration 005 has run
    }

    await supabase.from('attempts').delete().eq('test_id', id);
    await supabase.from('test_assignments').delete().eq('test_id', id);
    await supabase.from('test_questions').delete().eq('test_id', id);
    await supabase.from('test_teachers').delete().eq('test_id', id);

    const { error } = await supabase.from('tests').delete().eq('id', id);
    if (error) throw new Error(error.message);

    return { message: 'Test deleted' };
  }

  /** Add questions to test (Step 2 of TestConstructor) */
  async addQuestions(testId: string, questionIds: string[], user: Requester) {
    await this.assertCanContribute(testId, user);
    const ids = questionIds ?? []; // Allow empty array to clear questions

    // Once a student has started the paper, its questions are fixed: grading,
    // ranks and the per-question stats all assume every attempt saw the same
    // paper. Changing it mid-window silently re-marks some students and not others.
    const { count: attemptCount, error: attemptErr } = await supabase
      .from('attempts')
      .select('id', { count: 'exact', head: true })
      .eq('test_id', testId);
    if (attemptErr) throw new Error(attemptErr.message);
    if ((attemptCount ?? 0) > 0) {
      throw new BadRequestException(
        'Students have already started this test, so its questions can no longer be changed.',
      );
    }

    const scoped =
      user.role === 'teacher' && user.subject && user.subject !== 'All'
        ? user.subject
        : null;

    const { data: existingTestQuestions } = await supabase
      .from('test_questions')
      .select('question_id, question_order, questions(id, subject)')
      .eq('test_id', testId)
      .order('question_order', { ascending: true });

    const existingRows = (existingTestQuestions as any[]) || [];
    const existingIds = existingRows.map((tq) => tq.question_id);

    let finalIds = ids;
    let touched: string[] = [];

    if (scoped) {
      const extractSubject = (tq: any): string | null => {
        const q = tq?.questions;
        if (!q) return null;
        if (Array.isArray(q)) {
          return q[0]?.subject
            ? String(q[0].subject).trim().toLowerCase()
            : null;
        }
        return q.subject ? String(q.subject).trim().toLowerCase() : null;
      };

      const scopedLower = scoped.toLowerCase();
      // If any existing row does not have its subject populated, fetch it directly
      const unknownIds = existingRows
        .filter((tq) => !extractSubject(tq))
        .map((tq) => tq.question_id)
        .filter(Boolean);

      const dbSubjectMap = new Map<string, string>();
      if (unknownIds.length > 0) {
        const fetched = await fetchAllIn<{ id: string; subject: string }>(
          unknownIds,
          (chunk) =>
            supabase.from('questions').select('id, subject').in('id', chunk),
        );
        fetched.forEach((q) => {
          if (q.subject)
            dbSubjectMap.set(q.id, String(q.subject).trim().toLowerCase());
        });
      }

      const getResolvedSubject = (tq: any): string | null => {
        return extractSubject(tq) || dbSubjectMap.get(tq.question_id) || null;
      };

      // Questions on the test that belong to other subjects (e.g. Physics / Math when user is Chemistry)
      const otherSubjectIds = existingRows
        .filter((tq) => {
          const sub = getResolvedSubject(tq);
          return sub && sub !== scopedLower;
        })
        .map((tq) => tq.question_id);

      // Questions on the test that belong to this teacher's subject
      const existingScopedIds = existingRows
        .filter((tq) => {
          const sub = getResolvedSubject(tq);
          return sub === scopedLower;
        })
        .map((tq) => tq.question_id);

      // Incoming questions for this teacher's subject (strip other subjects if sent)
      const incomingScopedIds = ids.filter(
        (id) => !otherSubjectIds.includes(id),
      );

      // Touched only tracks additions/removals within this teacher's scoped subject
      touched = [
        ...incomingScopedIds.filter((id) => !existingScopedIds.includes(id)),
        ...existingScopedIds.filter((id) => !incomingScopedIds.includes(id)),
      ];

      // Merge: preserve other subjects + incoming scoped questions
      finalIds = [...otherSubjectIds, ...incomingScopedIds];
    } else {
      touched = [
        ...ids.filter((id) => !existingIds.includes(id)),
        ...existingIds.filter((id) => !ids.includes(id)),
      ];
      finalIds = ids;
    }

    const isDraft =
      (await supabase.from('tests').select('status').eq('id', testId).single())
        ?.data?.status === 'draft';
    await this.assertQuestionsUsable(finalIds, touched, user, isDraft);

    const rows = finalIds.map((qId, idx) => ({
      test_id: testId,
      question_id: qId,
      question_order: idx + 1,
    }));

    const previousRows = existingRows.map((tq, idx) => ({
      test_id: testId,
      question_id: tq.question_id,
      question_order: idx + 1,
    }));

    await supabase.from('test_questions').delete().eq('test_id', testId);
    if (rows.length) {
      const { error } = await supabase.from('test_questions').insert(rows);
      if (error) {
        if (previousRows.length) {
          try {
            await supabase.from('test_questions').insert(previousRows);
          } catch {
            // best-effort restore
          }
        }
        throw new Error(error.message);
      }
    }

    const totalMarks = await this.recalculateTotalMarks(testId);
    return { message: 'Questions updated', total_marks: totalMarks };
  }

  /**
   * Validates that the questions going onto a paper are approved and, for a
   * subject-scoped teacher, inside their subject.
   *
   * @param skipApproval - when true (draft mode) the review_status check is
   *   skipped so teachers can assemble papers before questions are approved.
   */
  private async assertQuestionsUsable(
    questionIds: string[],
    scopeCheckIds: string[],
    user: Requester,
    skipApproval = false,
  ): Promise<void> {
    const scoped =
      user.role === 'teacher' && user.subject && user.subject !== 'All'
        ? user.subject
        : null;

    const idsToLoad = [...new Set([...questionIds, ...scopeCheckIds])];
    if (!idsToLoad.length) return;

    const rows = await fetchAllIn<{
      id: string;
      subject: string;
      review_status: string;
      is_active: boolean;
    }>(idsToLoad, (idChunk) =>
      supabase
        .from('questions')
        .select('id, subject, review_status, is_active')
        .in('id', idChunk),
    );

    const byId = new Map(rows.map((r) => [r.id, r]));

    for (const id of questionIds) {
      const q = byId.get(id);
      if (!q) throw new BadRequestException(`Question ${id} does not exist.`);
      if (!q.is_active)
        throw new BadRequestException('A selected question has been deleted.');
      if (!skipApproval && q.review_status !== 'approved') {
        throw new BadRequestException(
          'Every question on a test must be approved in the review queue first.',
        );
      }
    }

    if (scoped) {
      const scopedNorm = scoped.trim().toLowerCase();
      for (const id of scopeCheckIds) {
        const q = byId.get(id);
        if (
          q &&
          String(q.subject || '')
            .trim()
            .toLowerCase() !== scopedNorm
        ) {
          throw new ForbiddenException(
            `You can only add or remove ${scoped} questions.`,
          );
        }
      }
    }
  }

  /** The questions on a paper, flattened into what the pattern rules need. */
  private async paperRows(
    testId: string,
  ): Promise<(PaperQuestion & { marks?: number; marks_override?: number | null })[]> {
    const rows = await fetchAll<any>(() =>
      supabase
        .from('test_questions')
        .select('question_id, question_order, marks_override, questions(subject, q_type, options, marks)')
        .eq('test_id', testId),
    );
    return rows.map((tq: any) => {
      const q = Array.isArray(tq.questions) ? tq.questions[0] : tq.questions;
      return {
        question_id: tq.question_id,
        question_order: tq.question_order,
        marks_override: tq.marks_override,
        subject: q?.subject,
        q_type: q?.q_type,
        options: q?.options,
        marks: q?.marks,
      };
    });
  }

  /** The official pattern a test follows, or null for a custom paper. */
  private async patternOfTest(testId: string): Promise<{ id: string; spec: PatternSpec } | null> {
    const { data: test } = await supabase.from('tests').select('*').eq('id', testId).single();
    const id = patternIdOf(test);
    const spec = getPattern(id);
    return id && spec ? { id, spec } : null;
  }

  /** Refuses a paper that departs from its official pattern, listing what is off. */
  private assertMatchesPattern(spec: PatternSpec, rows: PaperQuestion[]): void {
    const problems = validatePaper(spec, rows);
    if (problems.length) {
      throw new BadRequestException(
        `This paper does not follow the official ${spec.label} pattern (${spec.edition}). ` +
          problems.join(' '),
      );
    }
  }

  /**
   * Sums the paper's marks and stores them on the test row. A paper that follows
   * an official pattern is worth what its sections award (JEE Advanced: +3 and
   * +4 sections, 180 per paper), not a flat 4 per question.
   */
  private async recalculateTotalMarks(testId: string): Promise<number> {
    const pattern = await this.patternOfTest(testId);
    const rows = await this.paperRows(testId);

    const totalMarks = pattern
      ? paperMarks(pattern.spec, rows)
      : rows.reduce((sum, tq) => sum + Number(tq.marks_override || tq.marks || 4), 0);

    await supabase
      .from('tests')
      .update({ total_marks: totalMarks })
      .eq('id', testId);
    return totalMarks;
  }

  /** Publish a test (makes it visible to students) */
  async publish(id: string, user: Requester) {
    await this.assertCanAdminister(id, user);

    // An empty paper published by accident is worse than a failed request.
    const {
      data: tqRows,
      count,
      error: tqError,
    } = await supabase
      .from('test_questions')
      .select('question_id', { count: 'exact' })
      .eq('test_id', id);

    if (tqError) throw new Error(tqError.message);
    const questionIds = (tqRows || [])
      .map((tq) => tq.question_id)
      .filter(Boolean);
    if (!count && !questionIds.length) {
      throw new BadRequestException(
        'Add at least one question before publishing this test.',
      );
    }

    // Ensure all questions are approved and active before making the test live
    if (questionIds.length) {
      const test = await supabase
        .from('tests')
        .select('subject')
        .eq('id', id)
        .single();
      const isMixed =
        !test?.data?.subject ||
        test.data.subject === 'Mixed' ||
        test.data.subject === 'All';
      await this.assertQuestionsUsable(
        questionIds,
        isMixed ? [] : questionIds,
        user,
        false,
      );
    }

    // A paper declared as JEE Main / JEE Advanced / NEET must match the official
    // pattern exactly — every subject, every section's count — before students
    // can see it. Its duration and total marks are then the official ones.
    const pattern = await this.patternOfTest(id);
    const officialFields: Record<string, any> = {};
    if (pattern) {
      const rows = await this.paperRows(id);
      this.assertMatchesPattern(pattern.spec, rows);
      officialFields.duration_minutes = pattern.spec.durationMinutes;
      officialFields.total_marks = paperMarks(pattern.spec, rows);
      officialFields.negative_marking = true;
    }

    const { data, error } = await supabase
      .from('tests')
      .update({ status: 'published', ...officialFields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  /** Assign test to batches with a schedule */
  async assign(testId: string, body: AssignTestDto, user: Requester) {
    await this.assertCanAdminister(testId, user);
    this.assertWindowSane(body.scheduled_start, body.scheduled_end);

    const assignments = await this.buildAssignments(
      testId,
      body.batch_ids,
      body.scheduled_start,
      body.scheduled_end,
    );

    if (!assignments.length) {
      throw new BadRequestException(
        'No students found in the selected batches',
      );
    }

    await this.replaceAssignments(testId, assignments);
    return { message: `Test assigned to ${assignments.length} students` };
  }

  /**
   * One assignment row per student across all selected batches.
   *
   * `batch_students` is read per batch and paged: a 400-student batch used to
   * come back truncated at PostgREST's 1000-row cap once several batches were
   * selected at once.
   */
  private async buildAssignments(
    testId: string,
    batchIds: string[],
    scheduledStart?: string,
    scheduledEnd?: string,
  ): Promise<any[]> {
    const byStudent = new Map<string, any>();

    for (const batchId of batchIds) {
      const students = await fetchAll<{ student_id: string }>(() =>
        supabase
          .from('batch_students')
          .select('student_id')
          .eq('batch_id', batchId),
      );

      for (const bs of students) {
        // A student in two of the selected batches must still end up with exactly
        // one row — `test_assignments` is unique on (test_id, student_id).
        if (byStudent.has(bs.student_id)) continue;
        byStudent.set(bs.student_id, {
          test_id: testId,
          batch_id: batchId,
          student_id: bs.student_id,
          scheduled_start: scheduledStart ?? null,
          scheduled_end: scheduledEnd ?? null,
        });
      }
    }

    return [...byStudent.values()];
  }

  /** Clears the previous assignment set for these students, then writes the new one. */
  private async replaceAssignments(
    testId: string,
    assignments: any[],
  ): Promise<void> {
    const studentIds = assignments.map((a) => a.student_id);

    await runInChunks(
      studentIds,
      (ids) =>
        supabase
          .from('test_assignments')
          .delete()
          .eq('test_id', testId)
          .in('student_id', ids),
      ID_CHUNK_SIZE,
    );

    await insertInBatches(assignments, (batch) =>
      supabase.from('test_assignments').insert(batch),
    );
  }

  private assertWindowSane(start?: string, end?: string) {
    if (start && end && new Date(end).getTime() <= new Date(start).getTime()) {
      throw new BadRequestException(
        'The exam window must end after it starts.',
      );
    }
  }

  // ── Student reads ───────────────────────────────────────────────────────────

  /** Get tests available for a student (based on their assignment) */
  async getStudentTests(studentId: string) {
    // Step 1: Get test_assignment rows for this student
    const assignments = await fetchAll<any>(() =>
      supabase
        .from('test_assignments')
        .select('id, scheduled_start, scheduled_end, test_id, batch_id')
        .eq('student_id', studentId)
        .order('scheduled_start', { ascending: true }),
    );

    if (!assignments.length) return [];

    // Step 2: Fetch the tests separately (avoids triggering batch_students RLS)
    const studentTestColumns = await this.withPattern(
      'id, title, description, t_type, duration_minutes, total_marks, status',
    );
    const testIds = [...new Set(assignments.map((a) => a.test_id))];
    const tests = await fetchAllIn<any>(testIds, (idChunk) =>
      supabase
        .from('tests')
        .select(studentTestColumns)
        .in('id', idChunk)
        .eq('status', 'published'),
    );

    // Step 3: Merge
    const testMap = new Map(tests.map((t) => [t.id, t]));
    return assignments
      .filter((a) => testMap.has(a.test_id))
      .map((a) => ({ ...a, tests: testMap.get(a.test_id) }));
  }

  /**
   * Get test questions for a student — NEVER returns correct_answer!
   * correct_answer is only used by backend on submission.
   *
   * Assignment and the scheduled window are both enforced here: fetching the
   * paper is exactly as sensitive as starting the attempt.
   */
  async getTestQuestionsForStudent(testId: string, studentId: string) {
    await this.assertStudentMaySit(testId, studentId);

    return fetchAll<any>(() =>
      supabase
        .from('test_questions')
        .select(
          `
          question_order, marks_override,
          questions(id, subject, topic, question_text, options, difficulty, q_type, image_url, marks)
        `,
        )
        .eq('test_id', testId)
        .order('question_order', { ascending: true }),
    );
  }

  // ── Results ─────────────────────────────────────────────────────────────────

  /**
   * Full result set for a test (teacher view): the ranked scoreboard, cohort
   * summary stats, and a per-question breakdown showing which items the class
   * struggled with.
   */
  async getResults(testId: string, user: Requester) {
    await this.assertCanContribute(testId, user);

    const { data: test } = await supabase
      .from('tests')
      .select(
        'id, title, total_marks, duration_minutes, instructions, description',
      )
      .eq('id', testId)
      .single();

    if (!test) throw new NotFoundException('Test not found');

    const results_published = this.isTestResultsPublished(test);

    // Paged: a 1000-student cohort exceeds PostgREST's single-response cap, and
    // a truncated read here silently produced wrong ranks and averages.
    const rows = await fetchAll<any>(() =>
      supabase
        .from('attempts')
        .select(
          `
          id, total_score, status, started_at, submitted_at, auto_submitted,
          users(id, full_name, email)
        `,
        )
        .eq('test_id', testId)
        .eq('status', 'submitted')
        .order('total_score', { ascending: false })
        .order('id', { ascending: true }),
    );

    const scores = rows.map((a: any) => Number(a.total_score) || 0);
    const maxMarks = Number(test.total_marks) || 0;

    const { count: assignedCount } = await supabase
      .from('test_assignments')
      .select('*', { count: 'exact', head: true })
      .eq('test_id', testId);

    const sorted = [...scores].sort((a, b) => a - b);
    const median = sorted.length
      ? sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : 0;

    const questionStats = await this.buildQuestionStats(
      rows.map((a: any) => a.id),
    );

    let lastScore: number | null = null;
    let lastRank = 0;
    return {
      test: {
        ...test,
        results_published,
        instructions: this.stripInternalTags(test.instructions),
      },
      results_published,
      summary: {
        submitted: rows.length,
        assigned: assignedCount ?? 0,
        notAttempted: Math.max(0, (assignedCount ?? 0) - rows.length),
        maxMarks,
        highest: sorted.length ? sorted[sorted.length - 1] : 0,
        lowest: sorted.length ? sorted[0] : 0,
        average: scores.length
          ? Number(
              (scores.reduce((s, v) => s + v, 0) / scores.length).toFixed(2),
            )
          : 0,
        median: Number(median.toFixed(2)),
        autoSubmitted: rows.filter((a: any) => a.auto_submitted).length,
      },
      results: rows.map((a: any, idx: number) => {
        const score = Number(a.total_score) || 0;
        const rank = score === lastScore ? lastRank : idx + 1;
        lastScore = score;
        lastRank = rank;
        return {
          ...a,
          rank,
          percentage: maxMarks > 0 ? Math.round((score / maxMarks) * 100) : 0,
        };
      }),
      questionStats,
    };
  }

  /** [Admin] Approve and release (or withhold) test results for students */
  async setResultsPublished(
    testId: string,
    published: boolean,
    user: Requester,
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException(
        'Only administrators can approve and publish test results.',
      );
    }

    const { data: test, error: fetchErr } = await supabase
      .from('tests')
      .select('id, instructions')
      .eq('id', testId)
      .single();
    if (fetchErr || !test) throw new NotFoundException('Test not found');

    // Persist status tag in instructions for compatibility with all environments
    let instructions = test.instructions || '';
    instructions = instructions
      .replace(/\[RESULTS_PUBLISHED:(true|false)\]/g, '')
      .trim();
    if (published) {
      instructions = instructions
        ? `${instructions}\n[RESULTS_PUBLISHED:true]`
        : '[RESULTS_PUBLISHED:true]';
    } else {
      instructions = instructions
        ? `${instructions}\n[RESULTS_PUBLISHED:false]`
        : '[RESULTS_PUBLISHED:false]';
    }

    // Try updating both results_published column and instructions
    const { error: colErr } = await supabase
      .from('tests')
      .update({
        results_published: published,
        instructions,
        updated_at: new Date().toISOString(),
      })
      .eq('id', testId);

    if (colErr && this.isMissingColumn(colErr)) {
      // Column doesn't exist yet, update instructions only
      const { error: tagErr } = await supabase
        .from('tests')
        .update({ instructions, updated_at: new Date().toISOString() })
        .eq('id', testId);
      if (tagErr) throw new Error(tagErr.message);
    } else if (colErr) {
      throw new Error(colErr.message);
    }

    // Releasing (or withholding) results changes what the leaderboard and the
    // students' analytics may show — drop the cached aggregates now rather than
    // waiting out their TTL.
    await this.cache?.invalidate('leaderboard:').catch(() => undefined);
    await this.cache?.invalidate('analytics:cohort:').catch(() => undefined);

    return { success: true, testId, results_published: published };
  }

  /** Per-question difficulty across everyone who sat the test. */
  private async buildQuestionStats(attemptIds: string[]): Promise<any[]> {
    if (!attemptIds.length) return [];

    // 1000 attempts x 90 questions is 90k answer rows: chunked by attempt id and
    // paged within each chunk.
    const answers = await fetchAllIn<any>(attemptIds, (idChunk) =>
      supabase
        .from('answers')
        .select(
          'question_id, is_correct, questions(question_text, subject, topic)',
        )
        .in('attempt_id', idChunk),
    );

    const byQuestion = new Map<string, any>();
    for (const ans of answers) {
      const id = ans.question_id;
      if (!byQuestion.has(id)) {
        byQuestion.set(id, {
          questionId: id,
          questionText: ans.questions?.question_text || '',
          subject: ans.questions?.subject || 'Unknown',
          topic: ans.questions?.topic || null,
          correct: 0,
          incorrect: 0,
          unattempted: 0,
        });
      }
      const stat = byQuestion.get(id);
      if (ans.is_correct === true) stat.correct += 1;
      else if (ans.is_correct === false) stat.incorrect += 1;
      else stat.unattempted += 1;
    }

    const stats = [...byQuestion.values()].map((stat) => {
      const answered = stat.correct + stat.incorrect;
      return {
        ...stat,
        accuracy:
          answered > 0 ? Math.round((stat.correct / answered) * 100) : 0,
      };
    });

    // Hardest first — that is what a teacher wants to re-teach.
    return stats.sort((a, b) => a.accuracy - b.accuracy);
  }

  // ── Constructor ─────────────────────────────────────────────────────────────

  /**
   * Create a test, link its questions and assign batches in one call.
   *
   * Supabase's REST API has no multi-statement transaction, so the steps are
   * ordered to fail safe: the test is created as a draft first and only becomes
   * `published` once its questions are in place. A failure part-way leaves a
   * draft the teacher can finish, never a published paper with no questions.
   */
  async saveFullTest(body: SaveFullTestDto, user: Requester) {
    const questionIds = body.question_ids ?? [];
    const batchIds = body.batch_ids ?? [];
    const targetStatus = body.status === 'published' ? 'published' : 'draft';

    this.assertWindowSane(body.scheduled_start, body.scheduled_end);
    // Skip the approval gate for drafts — teachers can assemble papers
    // from their full bank before the review queue catches up.
    await this.assertQuestionsUsable(
      questionIds,
      questionIds,
      user,
      targetStatus === 'draft',
    );

    if (targetStatus === 'published' && !questionIds.length) {
      throw new BadRequestException(
        'Add at least one question before publishing this test.',
      );
    }

    // Publishing straight from the constructor must meet the official pattern
    // too — the same rule PATCH /:id/publish enforces.
    const patternId = patternIdOf({ ...body, ...this.resolveTypeAndPattern(body) });
    const pattern = getPattern(patternId);
    if (targetStatus === 'published' && pattern) {
      const qs = await fetchAllIn<any>(questionIds, (idChunk) =>
        supabase.from('questions').select('id, subject, q_type, options').in('id', idChunk),
      );
      const byId = new Map(qs.map((q) => [q.id, q]));
      this.assertMatchesPattern(
        pattern,
        questionIds.map((qid, idx) => ({
          question_id: qid,
          question_order: idx + 1,
          subject: byId.get(qid)?.subject,
          q_type: byId.get(qid)?.q_type,
          options: byId.get(qid)?.options,
        })),
      );
    }

    // 1. Create the test as a draft.
    const test = await this.insertTest({
      ...this.pickWritable(body),
      status: 'draft',
      total_marks: 0,
      created_by: user.id,
    });
    const testId = test.id;

    try {
      // 2. Link questions.
      if (questionIds.length) {
        const qRows = questionIds.map((qId, idx) => ({
          test_id: testId,
          question_id: qId,
          question_order: idx + 1,
        }));
        await insertInBatches(qRows, (batch) =>
          supabase.from('test_questions').insert(batch),
        );
      }

      const totalMarks = await this.recalculateTotalMarks(testId);

      // 3. Assign to batches.
      if (batchIds.length) {
        const assignments = await this.buildAssignments(
          testId,
          batchIds,
          body.scheduled_start,
          body.scheduled_end,
        );
        if (assignments.length)
          await this.replaceAssignments(testId, assignments);
      }

      // 4. Only now is it safe to publish.
      const { data: finalTest, error: statusError } = await supabase
        .from('tests')
        .update({
          status: targetStatus,
          total_marks: totalMarks,
          // An official paper runs for the official duration.
          ...(pattern ? { duration_minutes: pattern.durationMinutes } : {}),
        })
        .eq('id', testId)
        .select()
        .single();

      if (statusError) throw new Error(statusError.message);
      return finalTest;
    } catch (e: any) {
      // Roll the half-built test back so the library is not littered with
      // unusable drafts the teacher never asked for.
      await this.remove(testId, { id: user.id, role: 'admin' }).catch(
        () => undefined,
      );
      throw e;
    }
  }
}
