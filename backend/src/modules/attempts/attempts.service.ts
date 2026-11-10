import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { supabase } from '../../config/supabase.config';
import { SpacedRepetitionService } from '../analytics/spaced-repetition.service';
import { CacheService } from '../../common/cache/cache.service';
import { chunk, fetchAll } from '../../common/db/query.util';
import { isTestResultsPublished } from '../tests/tests.service';
import {
  getPattern,
  patternIdOf,
  PatternSpec,
  resolveSections,
  scoreInSection,
} from '../tests/exam-patterns';

/** Clock skew allowance so a student whose machine is a few seconds fast is not punished. */
const CLOCK_GRACE_SECONDS = 30;

/** Three strikes and the attempt is finalised. Mirrors the exam UI's warning counter. */
const VIOLATION_LIMIT = 3;

/** Each test can be taken once. Shown whenever a second attempt is refused. */
const ALREADY_SUBMITTED =
  'You have already submitted this test. Each test can be taken only once.';

/** Palette states the exam UI tracks per question. Anything else is rejected. */
const ANSWER_STATUSES = [
  'not_visited',
  'not_answered',
  'answered',
  'marked',
  'answered_marked',
] as const;

/** Cohort averages for a finished test barely move; recomputing per result view does not scale. */
const COHORT_STATS_TTL_SECONDS = 60;

/** Page size for each expiry-sweep read. */
const SWEEP_BATCH_LIMIT = 200;

/** Bounds a pass if a changing result set never yields a short page. */
const MAX_SWEEP_PAGES = 50;

interface AttemptWindow {
  attemptId: string;
  testId: string;
  status: string;
  startedAt: Date;
  expiresAt: Date;
  durationMinutes: number;
}

/** Marking scheme resolved from the test row (columns are optional — see the migration). */
interface MarkingScheme {
  negativeMarking: boolean;
  negativeMarks: number;
  resultsPublished: boolean;
  /** The official pattern the paper follows (JEE Main / Advanced / NEET), if any. */
  pattern: PatternSpec | null;
}

@Injectable()
export class AttemptsService {
  private readonly logger = new Logger(AttemptsService.name);

  /**
   * Whether migration 005 has been applied. Probed lazily on first use and then
   * remembered, so a database that is a migration behind degrades instead of
   * failing every answer save with a 500.
   */
  private hasAnswerStatus: boolean | null = null;
  private hasViolationsTable: boolean | null = null;

  constructor(
    private readonly srsService: SpacedRepetitionService,
    private readonly cache: CacheService,
  ) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /** True when PostgREST is telling us the column or table simply is not there. */
  private isMissingSchema(error: any): boolean {
    if (!error) return false;
    const code = String(error.code || '');
    if (
      code === 'PGRST204' ||
      code === 'PGRST205' ||
      code === '42703' ||
      code === '42P01'
    ) {
      return true;
    }
    return /does not exist|schema cache/i.test(String(error.message || ''));
  }

  /** True for a unique-constraint violation — two requests racing the same insert. */
  private isUniqueViolation(error: any): boolean {
    if (!error) return false;
    return (
      String(error.code || '') === '23505' ||
      /duplicate key value/i.test(String(error.message || ''))
    );
  }

  private warnMigrationMissing(what: string) {
    this.logger.warn(
      `${what} is missing — run backend/migrations/005_exam_session_sync.sql. ` +
        'Running degraded until then.',
    );
  }

  /**
   * Loads an attempt together with the deadline derived from the test duration.
   * The deadline is always computed server-side from `started_at` — the client
   * never gets to say how much time is left.
   */
  private async loadWindow(
    attemptId: string,
    studentId: string,
  ): Promise<AttemptWindow> {
    const { data: attempt } = await supabase
      .from('attempts')
      .select('id, test_id, status, started_at')
      .eq('id', attemptId)
      .eq('student_id', studentId)
      .single();

    if (!attempt) throw new NotFoundException('Attempt not found');

    const { data: test } = await supabase
      .from('tests')
      .select('duration_minutes')
      .eq('id', attempt.test_id)
      .single();

    const durationMinutes = test?.duration_minutes || 60;
    const startedAt = new Date(attempt.started_at || Date.now());
    const expiresAt = new Date(
      startedAt.getTime() + durationMinutes * 60 * 1000,
    );

    return {
      attemptId: attempt.id,
      testId: attempt.test_id,
      status: attempt.status,
      startedAt,
      expiresAt,
      durationMinutes,
    };
  }

  /** True once the server-side deadline has passed (with a small grace period). */
  private isExpired(window: AttemptWindow): boolean {
    return Date.now() > window.expiresAt.getTime() + CLOCK_GRACE_SECONDS * 1000;
  }

  /** Reads the marking scheme defensively — the columns may not exist on older schemas. */
  private async getMarkingScheme(testId: string): Promise<MarkingScheme> {
    const { data } = await supabase
      .from('tests')
      .select('*')
      .eq('id', testId)
      .single();

    const row: any = data || {};
    return {
      negativeMarking: row.negative_marking === true,
      negativeMarks: Number(row.negative_marks) || 0,
      resultsPublished: isTestResultsPublished(row),
      pattern: getPattern(patternIdOf(row)),
    };
  }

  /**
   * The effective scheduled window for a student on a test.
   *
   * Returns null when the student has no assignment at all. When several rows
   * exist (one per batch), the windows are merged: the exam opens at the
   * earliest start any batch was given and closes at the latest end. A missing
   * bound means "unbounded" and wins over any explicit one.
   */
  private async resolveAssignmentWindow(
    testId: string,
    studentId: string,
  ): Promise<{
    scheduled_start: string | null;
    scheduled_end: string | null;
  } | null> {
    const { data: rows, error } = await supabase
      .from('test_assignments')
      .select('id, scheduled_start, scheduled_end')
      .eq('test_id', testId)
      .eq('student_id', studentId);

    if (error) throw new Error(error.message);
    if (!rows?.length) return null;

    let start: number | null = null;
    let end: number | null = null;
    let unboundedStart = false;
    let unboundedEnd = false;

    for (const row of rows) {
      if (!row.scheduled_start) unboundedStart = true;
      else {
        const t = new Date(row.scheduled_start).getTime();
        start = start === null ? t : Math.min(start, t);
      }

      if (!row.scheduled_end) unboundedEnd = true;
      else {
        const t = new Date(row.scheduled_end).getTime();
        end = end === null ? t : Math.max(end, t);
      }
    }

    return {
      scheduled_start:
        unboundedStart || start === null ? null : new Date(start).toISOString(),
      scheduled_end:
        unboundedEnd || end === null ? null : new Date(end).toISOString(),
    };
  }

  /** Rejects writes to an attempt that is finished or past its deadline. */
  private assertWritable(window: AttemptWindow) {
    if (window.status === 'submitted') {
      throw new BadRequestException('Test already submitted');
    }
    if (this.isExpired(window)) {
      throw new ForbiddenException(
        'Time is up for this attempt. Your answers can no longer be changed.',
      );
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Every attempt a student has on a test, oldest first (ties broken by id, so
   * concurrent callers agree on the order). Normally zero or one row.
   */
  private async attemptsFor(
    testId: string,
    studentId: string,
  ): Promise<{ id: string; status: string; started_at: string }[]> {
    const { data, error } = await supabase
      .from('attempts')
      .select('id, status, started_at')
      .eq('test_id', testId)
      .eq('student_id', studentId)
      .order('started_at', { ascending: true })
      .order('id', { ascending: true });
    if (error) throw new Error(error.message);
    if (!data) return [];
    return Array.isArray(data) ? data : [data];
  }

  /** True when this student already has a different, submitted attempt on the test. */
  private async hasOtherSubmittedAttempt(attempt: {
    id: string;
    test_id: string;
    student_id: string;
  }): Promise<boolean> {
    const all = await this.attemptsFor(attempt.test_id, attempt.student_id);
    return all.some((a) => a.id !== attempt.id && a.status === 'submitted');
  }

  /**
   * START: Student begins an exam.
   * Enforces the scheduled window, then creates or resumes the attempt.
   */
  async startAttempt(testId: string, studentId: string) {
    // A student can sit in more than one batch, and both batches may have been
    // assigned the same test — which means more than one assignment row. Read
    // them all and merge into the widest window rather than using `.single()`,
    // which errors on the second row and reads as "not assigned".
    const assignment = await this.resolveAssignmentWindow(testId, studentId);

    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this test');
    }

    // The scheduled window is authoritative — a student cannot start early or late.
    const now = Date.now();
    if (assignment.scheduled_start) {
      const opensAt = new Date(assignment.scheduled_start).getTime();
      if (now < opensAt - CLOCK_GRACE_SECONDS * 1000) {
        throw new ForbiddenException(
          `This test opens at ${new Date(assignment.scheduled_start).toLocaleString()}.`,
        );
      }
    }
    if (assignment.scheduled_end) {
      const closesAt = new Date(assignment.scheduled_end).getTime();
      if (now > closesAt + CLOCK_GRACE_SECONDS * 1000) {
        throw new ForbiddenException('The window for this test has closed.');
      }
    }

    // One attempt per student per test. Read EVERY attempt this student has on
    // the test, not just the newest: if a stray duplicate ever exists, checking
    // only the latest row let a student who had submitted the older attempt
    // reopen the newer one and sit the test a second time.
    const priorAttempts = await this.attemptsFor(testId, studentId);

    if (priorAttempts.some((a) => a.status === 'submitted')) {
      throw new BadRequestException(ALREADY_SUBMITTED);
    }

    // Resume, never restart: an unfinished attempt is the same attempt.
    const existing = priorAttempts.find((a) => a.status === 'in_progress');

    const { data: test } = await supabase
      .from('tests')
      .select('duration_minutes, status')
      .eq('id', testId)
      .single();

    if (!test) throw new NotFoundException('Test not found');
    // An admin can schedule batches on a draft before publishing it. The
    // dashboard hides drafts, but the start endpoint itself must refuse them
    // too, or a student with the test id could sit an unfinished paper.
    if (test.status !== 'published') {
      throw new ForbiddenException('This test is not available yet.');
    }

    // If in progress, resume it — and hand back everything needed to rehydrate the UI.
    if (existing?.status === 'in_progress') {
      return this.resumeAttempt(
        existing,
        testId,
        test.duration_minutes || 60,
        studentId,
      );
    }

    // Create new attempt
    const startedAt = new Date();
    const expiresAt = new Date(
      startedAt.getTime() + test.duration_minutes * 60 * 1000,
    );

    const { data: attempt, error } = await supabase
      .from('attempts')
      .insert({
        test_id: testId,
        student_id: studentId,
        status: 'in_progress',
        started_at: startedAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Two tabs (or a double-click on a slow connection) can reach the insert
      // together. `attempts_student_test_unique` stops the duplicate; treat the
      // loser of the race as a resume rather than a 500.
      if (this.isUniqueViolation(error)) {
        const { data: raced } = await supabase
          .from('attempts')
          .select('id, status, started_at')
          .eq('test_id', testId)
          .eq('student_id', studentId)
          .maybeSingle();

        if (raced?.status === 'in_progress') {
          return this.resumeAttempt(
            raced,
            testId,
            test.duration_minutes || 60,
            studentId,
          );
        }
        throw new BadRequestException(ALREADY_SUBMITTED);
      }
      throw new Error(error.message);
    }

    // The unique key on (student_id, test_id) is what normally stops a second
    // row. A database that has not run migration 001/010 lacks it, and then two
    // simultaneous starts (double-click, two tabs) both insert. Every racer
    // settles on the same row — the earliest — and the losers delete their own
    // just-created, still-empty row, so the student is left with one attempt.
    const all = await this.attemptsFor(testId, studentId);
    const canonical = all[0];
    if (canonical && canonical.id !== attempt.id) {
      await supabase.from('attempts').delete().eq('id', attempt.id).eq('status', 'in_progress');
      this.logger.warn(
        `Duplicate start for test ${testId} by ${studentId}; kept attempt ${canonical.id}.`,
      );
      if (canonical.status === 'submitted') {
        throw new BadRequestException(ALREADY_SUBMITTED);
      }
      return this.resumeAttempt(canonical, testId, test.duration_minutes || 60, studentId);
    }

    return {
      attemptId: attempt.id,
      testId,
      resumed: false,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      timeLeftSeconds: test.duration_minutes * 60,
      savedAnswers: [],
    };
  }

  /** Rehydrates an in-progress attempt, or finalises it if the clock already ran out. */
  private async resumeAttempt(
    existing: { id: string; started_at: string },
    testId: string,
    durationMinutes: number,
    studentId: string,
  ) {
    const startedAt = new Date(existing.started_at || Date.now());
    const expiresAt = new Date(
      startedAt.getTime() + durationMinutes * 60 * 1000,
    );

    // The deadline may have passed while the student was away — finalise instead of resuming.
    if (Date.now() > expiresAt.getTime() + CLOCK_GRACE_SECONDS * 1000) {
      await this.submitAttempt(existing.id, studentId, true).catch(
        () => undefined,
      );
      throw new BadRequestException(
        'Your time for this test had already expired. The attempt was submitted automatically.',
      );
    }

    return {
      attemptId: existing.id,
      testId,
      resumed: true,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      timeLeftSeconds: Math.max(
        0,
        Math.floor((expiresAt.getTime() - Date.now()) / 1000),
      ),
      savedAnswers: await this.getSavedAnswers(existing.id),
    };
  }

  /** Answers already saved for an attempt, so a resumed exam can restore its state. */
  async getSavedAnswers(attemptId: string): Promise<any[]> {
    const columns =
      'question_id, selected_answer, flagged_for_doubt, time_spent_seconds';

    if (this.hasAnswerStatus !== false) {
      const { data, error } = await supabase
        .from('answers')
        .select(`${columns}, status`)
        .eq('attempt_id', attemptId);

      if (!error) {
        this.hasAnswerStatus = true;
        return data || [];
      }
      if (!this.isMissingSchema(error)) throw new Error(error.message);

      this.hasAnswerStatus = false;
      this.warnMigrationMissing('answers.status');
    }

    // Migration 005 not applied: resume the answers, just not the palette state.
    const { data, error } = await supabase
      .from('answers')
      .select(columns)
      .eq('attempt_id', attemptId);
    if (error) throw new Error(error.message);
    return data || [];
  }

  /**
   * SAVE ANSWER: Upsert one question's answer during the exam.
   * Refused once the server-side deadline has passed.
   */
  async saveAnswer(
    attemptId: string,
    studentId: string,
    body: {
      question_id: string;
      selected_answer?: any;
      status?: string;
      time_spent_seconds: number;
    },
  ) {
    const window = await this.loadWindow(attemptId, studentId);
    this.assertWritable(window);

    // The palette state travels with the answer. Without it, a resumed exam
    // showed every question as "not visited" even though the answers survived.
    const status = ANSWER_STATUSES.includes(body.status as any)
      ? body.status
      : body.selected_answer
        ? 'answered'
        : 'not_answered';

    const row: Record<string, any> = {
      attempt_id: attemptId,
      question_id: body.question_id,
      selected_answer: body.selected_answer,
      time_spent_seconds: Math.max(0, Number(body.time_spent_seconds) || 0),
    };
    if (this.hasAnswerStatus !== false) row.status = status;

    const { error } = await supabase
      .from('answers')
      .upsert(row, { onConflict: 'attempt_id,question_id' });

    if (error) {
      // The palette column is a nice-to-have; losing the answer itself is not.
      // On a database that has not run migration 005 yet, save it without.
      if (this.hasAnswerStatus === null && this.isMissingSchema(error)) {
        this.hasAnswerStatus = false;
        this.warnMigrationMissing('answers.status');
        return this.saveAnswer(attemptId, studentId, body);
      }
      throw new Error(error.message);
    }

    if (this.hasAnswerStatus === null) this.hasAnswerStatus = true;
    return { saved: true, status };
  }

  /**
   * PROCTORING: record one rule violation against the attempt.
   *
   * The strike count is held server-side — a student who reloads the tab does
   * not get a fresh set of lives. On the third strike the attempt is graded and
   * closed immediately, recorded as an auto-submission.
   */
  async logViolation(
    attemptId: string,
    studentId: string,
    body: { type?: string; detail?: string },
  ) {
    const { data: attempt } = await supabase
      .from('attempts')
      .select('id, test_id, status, started_at, student_id')
      .eq('id', attemptId)
      .eq('student_id', studentId)
      .single();

    if (!attempt) throw new NotFoundException('Attempt not found');

    // A violation after submission is noise, not a strike.
    if (attempt.status === 'submitted') {
      return {
        terminated: true,
        strikes: VIOLATION_LIMIT,
        limit: VIOLATION_LIMIT,
      };
    }

    const { error } = await supabase.from('attempt_violations').insert({
      attempt_id: attemptId,
      student_id: studentId,
      type: (body?.type || 'unknown').slice(0, 64),
      detail: body?.detail ? String(body.detail).slice(0, 500) : null,
    });

    if (error) {
      // Without migration 005 there is nowhere to record strikes. Fall back to
      // the client's own counter rather than 500-ing mid-exam.
      if (this.isMissingSchema(error)) {
        if (this.hasViolationsTable === null) {
          this.hasViolationsTable = false;
          this.warnMigrationMissing('attempt_violations');
        }
        return {
          terminated: false,
          strikes: 0,
          limit: VIOLATION_LIMIT,
          degraded: true,
        };
      }
      throw new Error(error.message);
    }

    this.hasViolationsTable = true;

    const { count } = await supabase
      .from('attempt_violations')
      .select('*', { count: 'exact', head: true })
      .eq('attempt_id', attemptId);

    const strikes = count ?? 0;
    const terminated = strikes >= VIOLATION_LIMIT;

    if (terminated) {
      this.logger.warn(
        `Attempt ${attemptId} terminated after ${strikes} violations.`,
      );
      // Grade what they have rather than leaving the attempt dangling open —
      // unless the student already has a submitted attempt on this test, in
      // which case this is a stray duplicate and must not become a second result.
      const duplicate = await this.hasOtherSubmittedAttempt(attempt).catch(() => false);
      if (duplicate) return { terminated, strikes, limit: VIOLATION_LIMIT };
      await this.gradeAndFinalise(attempt as any, true).catch((e) =>
        this.logger.error(
          `Failed to finalise terminated attempt ${attemptId}: ${e?.message}`,
        ),
      );
    }

    return { terminated, strikes, limit: VIOLATION_LIMIT };
  }

  /**
   * TOGGLE FLAG: Mark/unmark a question for doubt review.
   * Ownership is verified — a student can only flag their own attempt.
   */
  async toggleFlag(
    attemptId: string,
    studentId: string,
    questionId: string,
    flagged: boolean,
  ) {
    const window = await this.loadWindow(attemptId, studentId);
    this.assertWritable(window);

    // Upsert rather than update: a student may flag a question before answering it.
    const { error } = await supabase.from('answers').upsert(
      {
        attempt_id: attemptId,
        question_id: questionId,
        flagged_for_doubt: flagged,
      },
      { onConflict: 'attempt_id,question_id' },
    );

    if (error) throw new Error(error.message);
    return { flagged };
  }

  /**
   * SUBMIT: Grade the exam and finalize the attempt.
   * The score is calculated entirely on the backend from the stored answer key.
   */
  async submitAttempt(
    attemptId: string,
    studentId: string,
    autoSubmitted = false,
  ) {
    const { data: attempt } = await supabase
      .from('attempts')
      .select('id, test_id, status, started_at, student_id')
      .eq('id', attemptId)
      .eq('student_id', studentId)
      .single();

    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.status === 'submitted')
      throw new BadRequestException('Already submitted');

    // The last line of defence for "one attempt per test": even if a duplicate
    // attempt row exists (two tabs racing the start on a database without the
    // unique key), only one of them can ever be submitted and counted.
    if (await this.hasOtherSubmittedAttempt(attempt)) {
      throw new BadRequestException(ALREADY_SUBMITTED);
    }

    return this.gradeAndFinalise(attempt, autoSubmitted);
  }

  /**
   * Shared grading path used by both an explicit submit and the expiry sweeper.
   * `attempt` must already be known to exist and be in progress.
   */
  private async gradeAndFinalise(
    attempt: {
      id: string;
      test_id: string;
      started_at: string;
      student_id: string;
    },
    autoSubmitted: boolean,
  ) {
    const attemptId = attempt.id;

    const { data: test } = await supabase
      .from('tests')
      .select('duration_minutes')
      .eq('id', attempt.test_id)
      .single();

    const durationMinutes = test?.duration_minutes || 60;
    const startedAt = new Date(attempt.started_at || Date.now());
    const expiresAt = new Date(
      startedAt.getTime() + durationMinutes * 60 * 1000,
    );

    // A submit that arrives after the deadline is recorded as an auto-submission.
    const lateSubmit =
      Date.now() > expiresAt.getTime() + CLOCK_GRACE_SECONDS * 1000;
    const effectiveAutoSubmit = autoSubmitted || lateSubmit;

    const scheme = await this.getMarkingScheme(attempt.test_id);

    // Questions in the test WITH their correct answers. Paged: a full JEE paper
    // is 90 rows today, but the read must not silently truncate if that changes.
    const testQuestions = await fetchAll<any>(() =>
      supabase
        .from('test_questions')
        .select(
          'question_id, question_order, marks_override, questions(correct_answer, marks, subject, q_type, options)',
        )
        .eq('test_id', attempt.test_id),
    );

    // On an official paper each question is marked by its section's scheme:
    // JEE Main +4/−1; JEE Advanced +3/−1, +4/−2 with partial credit, +4/0 for
    // numerical; NEET +4/−1. A custom paper keeps per-question marks and the
    // test's own negative marking.
    const pattern = scheme.pattern;
    const sections = pattern
      ? resolveSections(
          pattern,
          testQuestions.map((tq) => ({
            question_id: tq.question_id,
            question_order: tq.question_order,
            subject: tq.questions?.subject,
            q_type: tq.questions?.q_type,
            options: tq.questions?.options,
          })),
        )
      : new Map();

    // Student's answers for this attempt
    const studentAnswers = await fetchAll<any>(() =>
      supabase
        .from('answers')
        .select('question_id, selected_answer')
        .eq('attempt_id', attemptId),
    );

    const answerMap = new Map(
      studentAnswers.map((a) => [a.question_id, a.selected_answer]),
    );

    let totalScore = 0;
    const answerUpdates: {
      attempt_id: string;
      question_id: string;
      is_correct: boolean | null;
    }[] = [];

    for (const tq of testQuestions) {
      const questionId = tq.question_id;
      const correctAnswer = tq.questions?.correct_answer;
      const marks = Number(tq.marks_override || tq.questions?.marks || 4);
      const studentAnswer = answerMap.get(questionId);

      // A cleared response is not an attempt. Unticking every option of a
      // multi-correct question saves `{ indices: [] }`, and the numeric keypad's
      // Clear saves `{ value: '' }` — both used to be marked wrong and, with
      // negative marking on, cost the student marks for a question they left.
      const attempted = !this.isEmptyAnswer(studentAnswer);
      const section = sections.get(questionId);
      let isCorrect = false;

      if (section && pattern) {
        if (attempted) {
          const scored = scoreInSection(section, studentAnswer, correctAnswer, pattern.numericAnswer);
          totalScore += scored.score;
          isCorrect = scored.full;
        }
      } else {
        isCorrect = attempted && this.answersMatch(studentAnswer, correctAnswer);
        if (isCorrect) {
          totalScore += marks;
        } else if (attempted && scheme.negativeMarking) {
          totalScore -= scheme.negativeMarks;
        }
      }

      answerUpdates.push({
        attempt_id: attemptId,
        question_id: questionId,
        is_correct: attempted ? isCorrect : null,
      });
    }

    // Persist correctness in bulk. This used to be one round-trip per question:
    // a 90-question paper meant 90 sequential requests per submit, and a whole
    // cohort finishing together turned that into ~90,000 serialised calls.
    // Only answered questions have a row to update, so only those are written.
    const attemptedUpdates = answerUpdates.filter((u) => u.is_correct !== null);
    for (const batch of chunk(attemptedUpdates, 500)) {
      const { error } = await supabase
        .from('answers')
        .upsert(batch, { onConflict: 'attempt_id,question_id' });
      if (error) throw new Error(error.message);
    }

    const submittedAt = new Date();
    // Never report more time than the exam actually allowed.
    const rawSeconds = Math.floor(
      (submittedAt.getTime() - startedAt.getTime()) / 1000,
    );
    const timeTakenSeconds = Math.min(rawSeconds, durationMinutes * 60);

    // The `status = in_progress` predicate makes this the serialisation point:
    // if two submits race (a manual click landing at the same moment as the
    // sweeper, say), exactly one flips the row and only that one runs the
    // post-submit side effects.
    const { data: claimed, error } = await supabase
      .from('attempts')
      .update({
        status: 'submitted',
        total_score: totalScore,
        submitted_at: submittedAt.toISOString(),
        auto_submitted: effectiveAutoSubmit,
      })
      .eq('id', attemptId)
      .eq('status', 'in_progress')
      .select('id')
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (claimed) {
      // Feed the graded answers into spaced repetition + predictions.
      // Awaited so the result page reflects fresh state, but it can never fail a submit.
      await this.srsService
        .processAttempt(attemptId, attempt.student_id)
        .catch((e: any) =>
          this.logger.error(
            `Spaced-repetition update failed for ${attemptId}: ${e?.message}`,
          ),
        );

      // A new score changes the rankings — drop the cached aggregates.
      await this.cache.invalidate('leaderboard:').catch(() => undefined);
      await this.cache.invalidate('analytics:cohort:').catch(() => undefined);
      await this.cache
        .invalidate(`attempt-cohort:${attempt.test_id}`)
        .catch(() => undefined);
    } else {
      this.logger.log(
        `Attempt ${attemptId} was already finalised by a concurrent submit.`,
      );
    }

    const correct = answerUpdates.filter((a) => a.is_correct === true).length;
    const incorrect = answerUpdates.filter(
      (a) => a.is_correct === false,
    ).length;
    const unattempted = answerUpdates.filter(
      (a) => a.is_correct === null,
    ).length;
    const total = testQuestions.length || 1;
    const maxScore = testQuestions.reduce((sum, tq) => {
      const section = sections.get(tq.question_id);
      return sum + (section ? section.marks : Number(tq.marks_override || tq.questions?.marks || 4));
    }, 0);

    if (!scheme.resultsPublished) {
      return {
        attemptId,
        testId: attempt.test_id,
        submitted: true,
        results_published: false,
        autoSubmitted: effectiveAutoSubmit,
        timeTakenSeconds,
        message:
          'Your attempt has been noted and securely recorded. Results will be released once approved by the administrator.',
      };
    }

    return {
      attemptId,
      testId: attempt.test_id,
      results_published: true,
      score: totalScore,
      maxScore,
      correct,
      incorrect,
      unattempted,
      accuracy: Math.round((correct / total) * 100),
      timeTakenSeconds,
      autoSubmitted: effectiveAutoSubmit,
      negativeMarking: scheme.negativeMarking,
      negativeMarks: scheme.negativeMarks,
    };
  }

  /** True when a saved response carries no actual answer. */
  private isEmptyAnswer(answer: any): boolean {
    if (answer === undefined || answer === null) return true;
    if (typeof answer !== 'object') return String(answer).trim() === '';
    if (Array.isArray(answer.indices)) return answer.indices.length === 0;
    if ('value' in answer)
      return answer.value === null || String(answer.value).trim() === '';
    if ('index' in answer)
      return (
        answer.index === null ||
        answer.index === undefined ||
        answer.index === ''
      );
    // `{ status: 'marked' }` and similar carry no answer.
    return Object.keys(answer).filter((k) => k !== 'status').length === 0;
  }

  /**
   * Compares a submitted answer against the stored key.
   * Handles `{ index }`, `{ value }` and multi-select `{ indices: [...] }` shapes.
   */
  private answersMatch(submitted: any, correct: any): boolean {
    if (submitted == null || correct == null) return false;

    // Multi-select: order-insensitive comparison.
    const subIdx = submitted?.indices;
    const corIdx = correct?.indices;
    if (Array.isArray(subIdx) || Array.isArray(corIdx)) {
      const a = [...(subIdx || [])].sort();
      const b = [...(corIdx || [])].sort();
      return a.length === b.length && a.every((v, i) => v === b[i]);
    }

    // Numerical / free-text: compare case-insensitively, trimmed.
    if (correct?.value !== undefined && submitted?.value !== undefined) {
      const a = String(submitted.value).trim().toLowerCase();
      const b = String(correct.value).trim().toLowerCase();
      if (a === b) return true;
      const na = Number(a);
      const nb = Number(b);
      return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
    }

    if (correct?.index !== undefined) {
      return Number(submitted?.index) === Number(correct.index);
    }

    return JSON.stringify(submitted) === JSON.stringify(correct);
  }

  /**
   * Finalises every in-progress attempt whose deadline has passed.
   * Called by the sweeper so a student who closes the tab still gets graded.
   * Returns the number of attempts submitted.
   *
   * Fetch every page before grading so status updates cannot shift the offsets
   * of later pages. The page cap protects against a perpetually full mock/feed.
   */
  async autoSubmitExpiredAttempts(): Promise<number> {
    const open: any[] = [];

    for (let page = 0; page < MAX_SWEEP_PAGES; page++) {
      const from = page * SWEEP_BATCH_LIMIT;
      const { data: rows, error } = await supabase
        .from('attempts')
        .select('id, test_id, started_at, student_id, tests(duration_minutes)')
        .eq('status', 'in_progress')
        .order('started_at', { ascending: true })
        .range(from, from + SWEEP_BATCH_LIMIT - 1);

      if (error) throw new Error(error.message);
      open.push(...(rows || []));

      if (!rows || rows.length < SWEEP_BATCH_LIMIT) break;
      if (page === MAX_SWEEP_PAGES - 1) {
        this.logger.warn(
          `Expiry sweep stopped after ${MAX_SWEEP_PAGES} full pages.`,
        );
      }
    }

    let submitted = 0;
    for (const attempt of open) {
      const durationMinutes = attempt.tests?.duration_minutes || 60;
      const startedAt = new Date(attempt.started_at || Date.now()).getTime();
      const expiresAt = startedAt + durationMinutes * 60 * 1000;

      if (Date.now() <= expiresAt + CLOCK_GRACE_SECONDS * 1000) continue;

      try {
        // A stray duplicate of an attempt that was already submitted must not
        // become a second graded result. It can never be submitted (see
        // submitAttempt), so discard it rather than retrying it every sweep.
        if (await this.hasOtherSubmittedAttempt(attempt)) {
          await supabase.from('answers').delete().eq('attempt_id', attempt.id);
          await supabase
            .from('attempts')
            .delete()
            .eq('id', attempt.id)
            .eq('status', 'in_progress');
          this.logger.warn(
            `Discarded duplicate attempt ${attempt.id}: test already submitted by this student.`,
          );
          continue;
        }

        await this.gradeAndFinalise(
          {
            id: attempt.id,
            test_id: attempt.test_id,
            started_at: attempt.started_at,
            student_id: attempt.student_id,
          },
          true,
        );
        submitted += 1;
      } catch (e: any) {
        this.logger.error(
          `Failed to auto-submit attempt ${attempt.id}: ${e?.message}`,
        );
      }
    }

    if (submitted > 0) {
      this.logger.log(`Auto-submitted ${submitted} expired attempt(s).`);
    }
    return submitted;
  }

  /** Get all of a student's past attempts */
  async getMyAttempts(studentId: string) {
    const { data, error } = await supabase
      .from('attempts')
      .select(
        'id, test_id, status, total_score, started_at, submitted_at, tests(id, title, total_marks, instructions, description)',
      )
      .eq('student_id', studentId)
      .order('started_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);
    return (data || []).map((a) => {
      const published = isTestResultsPublished(a.tests);
      return {
        ...a,
        results_published: published,
        total_score: published ? a.total_score : null,
      };
    });
  }

  /** Get one attempt result — for the PostTestResult page */
  async getAttemptResult(attemptId: string, studentId: string) {
    const { data: attempt, error } = await supabase
      .from('attempts')
      .select(
        `
        id, status, total_score, started_at, submitted_at, auto_submitted,
        tests(id, title, total_marks, duration_minutes, instructions, description),
        answers(
          question_id, selected_answer, is_correct, time_spent_seconds, flagged_for_doubt,
          questions(id, question_text, options, correct_answer, subject, topic, difficulty, marks)
        )
      `,
      )
      .eq('id', attemptId)
      .eq('student_id', studentId)
      .single();

    if (error || !attempt) throw new NotFoundException('Attempt not found');

    const resultsPublished = isTestResultsPublished(attempt.tests);

    if (!resultsPublished) {
      return {
        id: attempt.id,
        status: attempt.status,
        started_at: attempt.started_at,
        submitted_at: attempt.submitted_at,
        auto_submitted: attempt.auto_submitted,
        results_published: false,
        tests: attempt.tests,
        total_score: null,
        cohort: null,
        answers: [],
      };
    }

    // Only reveal the answer key once the attempt is finished.
    if (attempt.status !== 'submitted') {
      for (const ans of (attempt as any).answers || []) {
        if (ans.questions) delete ans.questions.correct_answer;
      }
      return { ...attempt, cohort: null };
    }

    return { ...attempt, cohort: await this.getCohortPosition(attempt) };
  }

  /**
   * Where this attempt sits among everyone who sat the same test.
   *
   * Rank and percentile come from indexed COUNT queries rather than pulling
   * every peer score into the API process — with a thousand submissions the old
   * read was both heavy and truncated by PostgREST's row cap, so ranks drifted.
   * The class average and top score are cached briefly, since they are identical
   * for every student opening their result.
   */
  private async getCohortPosition(attempt: any) {
    const testId = attempt.tests?.id;
    if (!testId) return null;

    const score = Number(attempt.total_score) || 0;

    const countWhere = async (apply: (q: any) => any): Promise<number> => {
      const { count } = await apply(
        supabase
          .from('attempts')
          .select('*', { count: 'exact', head: true })
          .eq('test_id', testId)
          .eq('status', 'submitted'),
      );
      return count ?? 0;
    };

    const [totalStudents, above, below] = await Promise.all([
      countWhere((q) => q),
      countWhere((q) => q.gt('total_score', score)),
      countWhere((q) => q.lt('total_score', score)),
    ]);

    if (!totalStudents) return null;

    const stats = await this.getTestScoreStats(testId);

    return {
      // Standard competition ranking: everyone strictly above you, plus one.
      rank: above + 1,
      totalStudents,
      // Percentage of the cohort scoring at or below this attempt.
      percentile: Math.round((below / totalStudents) * 100),
      average: stats.average,
      highest: stats.highest,
    };
  }

  /** Cached mean/max for a test — recomputed at most once a minute per test. */
  private async getTestScoreStats(
    testId: string,
  ): Promise<{ average: number; highest: number }> {
    return this.cache.wrap(
      `attempt-cohort:${testId}`,
      COHORT_STATS_TTL_SECONDS,
      async () => {
        const rows = await fetchAll<{ total_score: number }>(() =>
          supabase
            .from('attempts')
            .select('total_score')
            .eq('test_id', testId)
            .eq('status', 'submitted'),
        );

        if (!rows.length) return { average: 0, highest: 0 };

        const scores = rows.map((r) => Number(r.total_score) || 0);
        return {
          average: Number(
            (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
          ),
          highest: Math.max(...scores),
        };
      },
    );
  }
}
