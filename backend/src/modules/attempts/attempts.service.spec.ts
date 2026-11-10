import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { supabaseMock } from '../../test-utils/supabase-mock';

// Must be mocked before the service is imported, since it captures the client at module load.
jest.mock('../../config/supabase.config', () => ({
  supabase: supabaseMock,
}));

import { AttemptsService } from './attempts.service';

const srsStub = {
  processAttempt: jest.fn().mockResolvedValue(undefined),
} as any;
const cacheStub = { invalidate: jest.fn().mockResolvedValue(undefined) } as any;

const STUDENT = 'student-1';
const TEST_ID = 'test-1';
const ATTEMPT_ID = 'attempt-1';

/** A test row whose window is still open. */
const openAttempt = (startedMinutesAgo = 5) => ({
  id: ATTEMPT_ID,
  test_id: TEST_ID,
  student_id: STUDENT,
  status: 'in_progress',
  started_at: new Date(Date.now() - startedMinutesAgo * 60_000).toISOString(),
});

describe('AttemptsService', () => {
  let service: AttemptsService;

  beforeEach(() => {
    supabaseMock.reset();
    jest.clearAllMocks();
    service = new AttemptsService(srsStub, cacheStub);
  });

  describe('startAttempt', () => {
    /** Assignment rows come back as a list — a student can be in several batches. */
    const assignments = (...rows: any[]) =>
      supabaseMock.queueResult('test_assignments', { data: rows });

    it('refuses a test the student is not assigned', async () => {
      assignments();

      await expect(
        service.startAttempt(TEST_ID, STUDENT),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses to open before the scheduled start', async () => {
      assignments({
        id: 'a1',
        scheduled_start: new Date(Date.now() + 60 * 60_000).toISOString(),
        scheduled_end: new Date(Date.now() + 120 * 60_000).toISOString(),
      });

      await expect(service.startAttempt(TEST_ID, STUDENT)).rejects.toThrow(
        /opens at/i,
      );
    });

    it('refuses to open after the window has closed', async () => {
      assignments({
        id: 'a1',
        scheduled_start: new Date(Date.now() - 180 * 60_000).toISOString(),
        scheduled_end: new Date(Date.now() - 60 * 60_000).toISOString(),
      });

      await expect(service.startAttempt(TEST_ID, STUDENT)).rejects.toThrow(
        /window .* closed/i,
      );
    });

    // The dashboard listed the test but starting it said "not assigned": a student
    // in two batches had two assignment rows, and `.single()` errors on the second.
    it('starts when the student is assigned via more than one batch', async () => {
      assignments(
        {
          id: 'a1',
          scheduled_start: new Date(Date.now() - 10 * 60_000).toISOString(),
          scheduled_end: new Date(Date.now() + 10 * 60_000).toISOString(),
        },
        {
          id: 'a2',
          scheduled_start: new Date(Date.now() - 5 * 60_000).toISOString(),
          scheduled_end: new Date(Date.now() + 5 * 60_000).toISOString(),
        },
      );
      supabaseMock.queueResult('attempts', { data: null }); // no prior attempt
      supabaseMock.queueResult('tests', {
        data: { duration_minutes: 60, status: 'published' },
      });
      supabaseMock.queueResult('attempts', { data: { id: ATTEMPT_ID } }); // insert

      const result = await service.startAttempt(TEST_ID, STUDENT);

      expect(result.attemptId).toBe(ATTEMPT_ID);
      expect(result.resumed).toBe(false);
    });

    // Overlapping batch windows merge to the widest: open at the earliest start,
    // close at the latest end. A student inside either window can sit the test.
    it('merges several assignment windows into the widest one', async () => {
      assignments(
        {
          id: 'a1',
          scheduled_start: new Date(Date.now() + 30 * 60_000).toISOString(), // not open yet
          scheduled_end: new Date(Date.now() + 90 * 60_000).toISOString(),
        },
        {
          id: 'a2',
          scheduled_start: new Date(Date.now() - 30 * 60_000).toISOString(), // already open
          scheduled_end: new Date(Date.now() + 30 * 60_000).toISOString(),
        },
      );
      supabaseMock.queueResult('attempts', { data: null });
      supabaseMock.queueResult('tests', {
        data: { duration_minutes: 60, status: 'published' },
      });
      supabaseMock.queueResult('attempts', { data: { id: ATTEMPT_ID } });

      await expect(
        service.startAttempt(TEST_ID, STUDENT),
      ).resolves.toMatchObject({
        attemptId: ATTEMPT_ID,
      });
    });

    it('rejects a second attempt once submitted', async () => {
      assignments({ id: 'a1', scheduled_start: null, scheduled_end: null });
      supabaseMock.queueResult('attempts', {
        data: { id: ATTEMPT_ID, status: 'submitted' },
      });

      await expect(
        service.startAttempt(TEST_ID, STUDENT),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('returns saved answers when resuming an open attempt', async () => {
      assignments({ id: 'a1', scheduled_start: null, scheduled_end: null });
      supabaseMock.queueResult('attempts', { data: openAttempt(10) });
      supabaseMock.queueResult('tests', {
        data: { duration_minutes: 60, status: 'published' },
      });
      supabaseMock.queueResult('answers', {
        data: [
          {
            question_id: 'q1',
            selected_answer: { index: 2 },
            status: 'answered_marked',
            flagged_for_doubt: true,
          },
        ],
      });

      const result = await service.startAttempt(TEST_ID, STUDENT);

      expect(result.resumed).toBe(true);
      expect(result.savedAnswers).toHaveLength(1);
      // The palette state must survive a resume, not just the answer itself.
      expect(result.savedAnswers[0].status).toBe('answered_marked');
      // ~50 minutes of a 60 minute exam should remain.
      expect(result.timeLeftSeconds).toBeGreaterThan(2900);
      expect(result.timeLeftSeconds).toBeLessThanOrEqual(3000);
    });
  });

  /**
   * Each test can be taken once. These cover every route by which a student
   * could otherwise end up with a second attempt or a second result.
   */
  describe('one attempt per test', () => {
    const published = () =>
      supabaseMock.queueResult('tests', { data: { duration_minutes: 60, status: 'published' } });
    const assigned = () =>
      supabaseMock.queueResult('test_assignments', {
        data: [{ id: 'a1', scheduled_start: null, scheduled_end: null }],
      });

    it('refuses to start again once the test is submitted', async () => {
      assigned();
      supabaseMock.queueResult('attempts', {
        data: [{ id: ATTEMPT_ID, status: 'submitted', started_at: new Date().toISOString() }],
      });

      await expect(service.startAttempt(TEST_ID, STUDENT)).rejects.toThrow(/only once/i);
      expect(supabaseMock.calls.some((c) => c.table === 'attempts' && c.op === 'insert')).toBe(false);
    });

    // The old check read only the newest attempt. With a stray duplicate, a
    // student who had submitted the older one could reopen the newer one.
    it('refuses even when a newer duplicate attempt is still open', async () => {
      assigned();
      supabaseMock.queueResult('attempts', {
        data: [
          { id: 'older', status: 'submitted', started_at: new Date(Date.now() - 60_000).toISOString() },
          { id: 'newer', status: 'in_progress', started_at: new Date().toISOString() },
        ],
      });

      await expect(service.startAttempt(TEST_ID, STUDENT)).rejects.toThrow(/only once/i);
    });

    // Two tabs / a double-click racing the start on a database without the
    // unique key: the loser drops its own empty row and joins the winner's.
    it('collapses a racing duplicate start onto the earliest attempt', async () => {
      assigned();
      supabaseMock.queueResult('attempts', { data: [] }); // nothing before the insert
      published();
      supabaseMock.queueResult('attempts', { data: { id: 'mine' } }); // our insert
      supabaseMock.queueResult('attempts', {
        data: [
          { id: 'theirs', status: 'in_progress', started_at: new Date(Date.now() - 1_000).toISOString() },
          { id: 'mine', status: 'in_progress', started_at: new Date().toISOString() },
        ],
      });
      supabaseMock.queueResult('attempts', { data: null }); // delete of our row
      supabaseMock.queueResult('answers', { data: [] }); // resume reads saved answers

      const result = await service.startAttempt(TEST_ID, STUDENT);

      expect(result.attemptId).toBe('theirs');
      expect(result.resumed).toBe(true);
      expect(supabaseMock.calls.some((c) => c.table === 'attempts' && c.op === 'delete')).toBe(true);
    });

    it('refuses to submit a second attempt on the same test', async () => {
      supabaseMock.queueResult('attempts', { data: openAttempt(10) }); // the attempt being submitted
      supabaseMock.queueResult('attempts', {
        data: [
          { id: 'first', status: 'submitted', started_at: new Date(Date.now() - 3_600_000).toISOString() },
          { id: ATTEMPT_ID, status: 'in_progress', started_at: new Date().toISOString() },
        ],
      });

      await expect(service.submitAttempt(ATTEMPT_ID, STUDENT)).rejects.toThrow(/only once/i);
      // Nothing was graded or written.
      expect(supabaseMock.calls.some((c) => c.table === 'attempts' && c.op === 'update')).toBe(false);
    });

    it('lets the expiry sweeper discard, not grade, a stray duplicate', async () => {
      supabaseMock.queueResult('attempts', {
        data: [
          {
            id: 'stray',
            test_id: TEST_ID,
            student_id: STUDENT,
            started_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
            tests: { duration_minutes: 60 },
          },
        ],
      });
      supabaseMock.queueResult('attempts', {
        data: [
          { id: 'first', status: 'submitted', started_at: new Date(Date.now() - 4 * 3_600_000).toISOString() },
          { id: 'stray', status: 'in_progress', started_at: new Date(Date.now() - 3 * 3_600_000).toISOString() },
        ],
      });

      const graded = await service.autoSubmitExpiredAttempts();

      expect(graded).toBe(0);
      expect(supabaseMock.calls.some((c) => c.table === 'attempts' && c.op === 'update')).toBe(false);
      expect(supabaseMock.calls.some((c) => c.table === 'attempts' && c.op === 'delete')).toBe(true);
    });
  });

  describe('startAttempt on an unpublished test', () => {
    // An admin may schedule batches on a draft before publishing it. The start
    // endpoint must refuse it, not just the dashboard that hides it.
    it('refuses a draft even when the student is assigned', async () => {
      supabaseMock.queueResult('test_assignments', {
        data: [{ id: 'a1', scheduled_start: null, scheduled_end: null }],
      });
      supabaseMock.queueResult('attempts', { data: null });
      supabaseMock.queueResult('tests', {
        data: { duration_minutes: 60, status: 'draft' },
      });

      await expect(
        service.startAttempt(TEST_ID, STUDENT),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('saveAnswer', () => {
    it('rejects a write after the deadline has passed', async () => {
      // Started 90 minutes ago on a 60 minute test.
      supabaseMock.queueResult('attempts', { data: openAttempt(90) });
      supabaseMock.queueResult('tests', { data: { duration_minutes: 60 } });

      await expect(
        service.saveAnswer(ATTEMPT_ID, STUDENT, {
          question_id: 'q1',
          selected_answer: { index: 1 },
          time_spent_seconds: 10,
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('saves while the window is still open', async () => {
      supabaseMock.queueResult('attempts', { data: openAttempt(5) });
      supabaseMock.queueResult('tests', { data: { duration_minutes: 60 } });
      supabaseMock.queueResult('answers', { data: null, error: null });

      await expect(
        service.saveAnswer(ATTEMPT_ID, STUDENT, {
          question_id: 'q1',
          selected_answer: { index: 1 },
          status: 'answered_marked',
          time_spent_seconds: 10,
        }),
      ).resolves.toEqual({ saved: true, status: 'answered_marked' });
    });

    it('falls back to a derived status rather than storing junk', async () => {
      supabaseMock.queueResult('attempts', { data: openAttempt(5) });
      supabaseMock.queueResult('tests', { data: { duration_minutes: 60 } });
      supabaseMock.queueResult('answers', { data: null, error: null });

      await expect(
        service.saveAnswer(ATTEMPT_ID, STUDENT, {
          question_id: 'q1',
          selected_answer: null,
          status: 'definitely-not-a-status',
          time_spent_seconds: 10,
        }),
      ).resolves.toEqual({ saved: true, status: 'not_answered' });
    });
  });

  // Migration 005 adds answers.status and attempt_violations. Until it is run,
  // the exam must keep working rather than 500-ing on every answer.
  describe('when migration 005 has not been applied', () => {
    const missingColumn = {
      message: 'column answers.status does not exist',
      code: '42703',
    };
    const missingTable = {
      message: "Could not find the table 'public.attempt_violations'",
      code: 'PGRST205',
    };

    it('still saves the answer when answers.status is missing', async () => {
      supabaseMock.queueResult('attempts', { data: openAttempt(5) });
      supabaseMock.queueResult('tests', { data: { duration_minutes: 60 } });
      supabaseMock.queueResult('answers', { data: null, error: missingColumn });
      // The retry re-reads the window, then writes without the status column.
      supabaseMock.queueResult('attempts', { data: openAttempt(5) });
      supabaseMock.queueResult('tests', { data: { duration_minutes: 60 } });
      supabaseMock.queueResult('answers', { data: null, error: null });

      await expect(
        service.saveAnswer(ATTEMPT_ID, STUDENT, {
          question_id: 'q1',
          selected_answer: { index: 1 },
          status: 'answered',
          time_spent_seconds: 10,
        }),
      ).resolves.toEqual({ saved: true, status: 'answered' });
    });

    it('reports violations as degraded rather than failing the request', async () => {
      supabaseMock.queueResult('attempts', { data: openAttempt(5) });
      supabaseMock.queueResult('attempt_violations', {
        data: null,
        error: missingTable,
      });

      await expect(
        service.logViolation(ATTEMPT_ID, STUDENT, { type: 'tab_hidden' }),
      ).resolves.toEqual({
        terminated: false,
        strikes: 0,
        limit: 3,
        degraded: true,
      });
    });
  });

  describe('logViolation', () => {
    const queueStrike = (count: number) => {
      supabaseMock.queueResult('attempts', { data: openAttempt(5) }); // ownership lookup
      supabaseMock.queueResult('attempt_violations', { data: null }); // insert
      supabaseMock.queueResult('attempt_violations', { count }); // running total
    };

    it('warns but does not terminate below the limit', async () => {
      queueStrike(2);

      await expect(
        service.logViolation(ATTEMPT_ID, STUDENT, { type: 'tab_hidden' }),
      ).resolves.toEqual({ terminated: false, strikes: 2, limit: 3 });
    });

    it('terminates and grades the attempt on the third strike', async () => {
      queueStrike(3);
      supabaseMock.queueResult('attempts', { data: [openAttempt(5)] }); // no other submitted attempt
      // gradeAndFinalise reads the duration, marking scheme, paper and answers.
      supabaseMock.queueResult('tests', { data: { duration_minutes: 60 } });
      supabaseMock.queueResult('tests', {
        data: {
          negative_marking: false,
          negative_marks: 0,
          results_published: true,
        },
      });
      supabaseMock.queueResult('test_questions', { data: [] });
      supabaseMock.queueResult('answers', { data: [] });
      supabaseMock.queueResult('attempts', { data: { id: ATTEMPT_ID } });

      const result = await service.logViolation(ATTEMPT_ID, STUDENT, {
        type: 'fullscreen_exit',
      });

      expect(result.terminated).toBe(true);
      // The attempt must not be left dangling open — it is graded on the spot.
      expect(srsStub.processAttempt).toHaveBeenCalledWith(ATTEMPT_ID, STUDENT);
    });

    it("refuses to touch another student's attempt", async () => {
      supabaseMock.queueResult('attempts', { data: null });

      await expect(
        service.logViolation(ATTEMPT_ID, 'someone-else', {
          type: 'tab_hidden',
        }),
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('toggleFlag', () => {
    it("refuses to touch another student's attempt", async () => {
      // Ownership is enforced by the student_id filter — no row comes back.
      supabaseMock.queueResult('attempts', { data: null });

      await expect(
        service.toggleFlag(ATTEMPT_ID, 'someone-else', 'q1', true),
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('submitAttempt — grading', () => {
    /** Queues everything gradeAndFinalise reads, in order. */
    const queueGrading = (opts: {
      negativeMarking?: boolean;
      negativeMarks?: number;
      resultsPublished?: boolean;
      paperPattern?: string;
      testQuestions: any[];
      studentAnswers: any[];
    }) => {
      supabaseMock.queueResult('attempts', { data: openAttempt(10) }); // submitAttempt lookup
      supabaseMock.queueResult('attempts', { data: [openAttempt(10)] }); // no other submitted attempt
      supabaseMock.queueResult('tests', { data: { duration_minutes: 60 } }); // duration
      supabaseMock.queueResult('tests', {
        // marking scheme
        data: {
          negative_marking: opts.negativeMarking ?? false,
          negative_marks: opts.negativeMarks ?? 0,
          results_published: opts.resultsPublished ?? true,
          paper_pattern: opts.paperPattern ?? null,
        },
      });
      supabaseMock.queueResult('test_questions', { data: opts.testQuestions });
      supabaseMock.queueResult('answers', { data: opts.studentAnswers });
      // Correctness is written back in a single batched upsert, not one call per
      // question — and only for questions that actually have an answer row.
      if (opts.studentAnswers.length) {
        supabaseMock.queueResult('answers', { data: null });
      }
      supabaseMock.queueResult('attempts', { data: { id: ATTEMPT_ID } });
    };

    /**
     * An official paper is marked by its sections, not a flat +4/−n. JEE
     * Advanced Paper 1 Physics: Section 1 +3/−1, Section 2 +4 with partial
     * credit/−2, Section 3 +4/0, Section 4 (matching) +4/−1.
     */
    it('grades a JEE Advanced paper section by section', async () => {
      const q = (id: string, order: number, q_type: string, correct_answer: any) => ({
        question_id: id,
        question_order: order,
        marks_override: null,
        questions: { correct_answer, marks: 4, subject: 'Physics', q_type, options: ['a', 'b', 'c', 'd'] },
      });
      queueGrading({
        paperPattern: 'jee_advanced',
        testQuestions: [
          q('s1', 1, 'single_correct', { index: 0 }),
          q('s2', 2, 'single_correct', { index: 1 }),
          q('s3', 3, 'single_correct', { index: 2 }),
          q('s4', 4, 'single_correct', { index: 3 }),
          q('m1', 5, 'multi_correct', { indices: [0, 1, 3] }),
          q('n1', 6, 'numerical', { value: '2.35' }),
          q('n2', 7, 'numerical', { value: '10' }),
          q('x1', 8, 'single_correct', { index: 2 }), // 5th single -> Section 4 (matching)
        ],
        studentAnswers: [
          { question_id: 's1', selected_answer: { index: 0 } },      // Sec 1 right: +3
          { question_id: 's2', selected_answer: { index: 0 } },      // Sec 1 wrong: −1
          { question_id: 'm1', selected_answer: { indices: [0, 1] } }, // partial: +2
          { question_id: 'n1', selected_answer: { value: '2.354' } }, // to 2 dp: +4
          { question_id: 'n2', selected_answer: { value: '11' } },    // wrong, no negative: 0
          { question_id: 'x1', selected_answer: { index: 2 } },      // Sec 4 right: +4
        ],
      });

      const result: any = await service.submitAttempt(ATTEMPT_ID, STUDENT);

      expect(result.score).toBe(3 - 1 + 2 + 4 + 0 + 4);
      // 4 × 3 + 4 + 2 × 4 + 4 for the questions on this (partial) paper.
      expect(result.maxScore).toBe(12 + 4 + 8 + 4);
    });

    // Unticking every option, or pressing Clear on the numeric keypad, saves an
    // empty response. That is a skipped question, not a wrong one.
    it('does not apply negative marking to cleared responses', async () => {
      queueGrading({
        negativeMarking: true,
        negativeMarks: 1,
        testQuestions: [
          {
            question_id: 'q1',
            marks_override: null,
            questions: { correct_answer: { indices: [0, 2] }, marks: 4 },
          },
          {
            question_id: 'q2',
            marks_override: null,
            questions: { correct_answer: { value: '12' }, marks: 4 },
          },
          {
            question_id: 'q3',
            marks_override: null,
            questions: { correct_answer: { index: 1 }, marks: 4 },
          },
        ],
        studentAnswers: [
          { question_id: 'q1', selected_answer: { indices: [] } },
          { question_id: 'q2', selected_answer: { value: '' } },
          { question_id: 'q3', selected_answer: { index: 3 } }, // genuinely wrong
        ],
      });

      const result: any = await service.submitAttempt(ATTEMPT_ID, STUDENT);

      expect(result.score).toBe(-1);
      expect(result.unattempted).toBe(2);
      expect(result.incorrect).toBe(1);
    });

    it('awards marks for correct answers only', async () => {
      queueGrading({
        testQuestions: [
          {
            question_id: 'q1',
            marks_override: null,
            questions: { correct_answer: { index: 0 }, marks: 4 },
          },
          {
            question_id: 'q2',
            marks_override: null,
            questions: { correct_answer: { index: 1 }, marks: 4 },
          },
          {
            question_id: 'q3',
            marks_override: null,
            questions: { correct_answer: { index: 2 }, marks: 4 },
          },
        ],
        studentAnswers: [
          { question_id: 'q1', selected_answer: { index: 0 } }, // correct
          { question_id: 'q2', selected_answer: { index: 3 } }, // wrong
          // q3 unattempted
        ],
      });

      const result = await service.submitAttempt(ATTEMPT_ID, STUDENT);

      expect(result.score).toBe(4);
      expect(result.correct).toBe(1);
      expect(result.incorrect).toBe(1);
      expect(result.unattempted).toBe(1);
      expect(result.maxScore).toBe(12);
    });

    it('applies negative marking to wrong answers but never to skipped ones', async () => {
      queueGrading({
        negativeMarking: true,
        negativeMarks: 1,
        testQuestions: [
          {
            question_id: 'q1',
            marks_override: null,
            questions: { correct_answer: { index: 0 }, marks: 4 },
          },
          {
            question_id: 'q2',
            marks_override: null,
            questions: { correct_answer: { index: 1 }, marks: 4 },
          },
          {
            question_id: 'q3',
            marks_override: null,
            questions: { correct_answer: { index: 2 }, marks: 4 },
          },
        ],
        studentAnswers: [
          { question_id: 'q1', selected_answer: { index: 0 } }, // +4
          { question_id: 'q2', selected_answer: { index: 3 } }, // -1
          // q3 skipped -> 0
        ],
      });

      const result = await service.submitAttempt(ATTEMPT_ID, STUDENT);

      expect(result.score).toBe(3);
      expect(result.negativeMarking).toBe(true);
    });

    it('marks a late submission as auto-submitted and clamps the reported time', async () => {
      supabaseMock.queueResult('attempts', { data: openAttempt(120) }); // 2h into a 1h test
      supabaseMock.queueResult('tests', { data: { duration_minutes: 60 } });
      supabaseMock.queueResult('tests', {
        data: {
          negative_marking: false,
          negative_marks: 0,
          results_published: true,
        },
      });
      supabaseMock.queueResult('test_questions', { data: [] });
      supabaseMock.queueResult('answers', { data: [] });
      supabaseMock.queueResult('attempts', { data: { id: ATTEMPT_ID } });

      const result = await service.submitAttempt(ATTEMPT_ID, STUDENT, false);

      expect(result.autoSubmitted).toBe(true);
      expect(result.timeTakenSeconds).toBe(3600);
    });

    it('matches numeric answers regardless of formatting', async () => {
      queueGrading({
        testQuestions: [
          {
            question_id: 'q1',
            marks_override: null,
            questions: { correct_answer: { value: '2.50' }, marks: 4 },
          },
        ],
        studentAnswers: [
          { question_id: 'q1', selected_answer: { value: ' 2.5 ' } },
        ],
      });

      const result = await service.submitAttempt(ATTEMPT_ID, STUDENT);
      expect(result.correct).toBe(1);
    });

    it('treats multi-select answers as order-insensitive', async () => {
      queueGrading({
        testQuestions: [
          {
            question_id: 'q1',
            marks_override: null,
            questions: { correct_answer: { indices: [0, 2] }, marks: 4 },
          },
        ],
        studentAnswers: [
          { question_id: 'q1', selected_answer: { indices: [2, 0] } },
        ],
      });

      const result = await service.submitAttempt(ATTEMPT_ID, STUDENT);
      expect(result.correct).toBe(1);
    });

    it('withholds score breakdown when results are not yet published by admin', async () => {
      queueGrading({
        resultsPublished: false,
        testQuestions: [
          {
            question_id: 'q1',
            marks_override: null,
            questions: { correct_answer: { index: 0 }, marks: 4 },
          },
        ],
        studentAnswers: [{ question_id: 'q1', selected_answer: { index: 0 } }],
      });

      const result = await service.submitAttempt(ATTEMPT_ID, STUDENT);

      expect(result.results_published).toBe(false);
      expect((result as any).score).toBeUndefined();
      expect(result.message).toContain(
        'Results will be released once approved by the administrator',
      );
    });

    it('refuses to submit an attempt twice', async () => {
      supabaseMock.queueResult('attempts', {
        data: { ...openAttempt(), status: 'submitted' },
      });

      await expect(
        service.submitAttempt(ATTEMPT_ID, STUDENT),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('updates spaced repetition and drops the cached leaderboard', async () => {
      queueGrading({
        testQuestions: [
          {
            question_id: 'q1',
            marks_override: null,
            questions: { correct_answer: { index: 0 }, marks: 4 },
          },
        ],
        studentAnswers: [{ question_id: 'q1', selected_answer: { index: 0 } }],
      });

      await service.submitAttempt(ATTEMPT_ID, STUDENT);

      expect(srsStub.processAttempt).toHaveBeenCalledWith(ATTEMPT_ID, STUDENT);
      expect(cacheStub.invalidate).toHaveBeenCalledWith('leaderboard:');
    });

    /**
     * Correctness used to be written one UPDATE per question. A 90-question
     * paper meant 90 sequential round-trips per submit, and a cohort finishing
     * together turned that into ~90,000 serialised calls.
     */
    it('writes every answer’s correctness in one batched call', async () => {
      const testQuestions = Array.from({ length: 90 }, (_, i) => ({
        question_id: `q${i}`,
        marks_override: null,
        questions: { correct_answer: { index: 0 }, marks: 4 },
      }));

      queueGrading({
        testQuestions,
        studentAnswers: testQuestions.map((tq) => ({
          question_id: tq.question_id,
          selected_answer: { index: 0 },
        })),
      });

      await service.submitAttempt(ATTEMPT_ID, STUDENT);

      const writes = supabaseMock.calls.filter(
        (c) =>
          c.table === 'answers' && (c.op === 'upsert' || c.op === 'update'),
      );
      expect(writes).toHaveLength(1);
      expect(writes[0].payload).toHaveLength(90);
    });

    // Unanswered questions have no row to update, so nothing is written for them.
    it('writes nothing back when the student answered nothing', async () => {
      queueGrading({
        testQuestions: [
          {
            question_id: 'q1',
            marks_override: null,
            questions: { correct_answer: { index: 0 }, marks: 4 },
          },
        ],
        studentAnswers: [],
      });

      const result = await service.submitAttempt(ATTEMPT_ID, STUDENT);

      expect(result.unattempted).toBe(1);
      expect(
        supabaseMock.calls.filter(
          (c) => c.table === 'answers' && c.op === 'upsert',
        ),
      ).toHaveLength(0);
    });

    /**
     * Two submits can race — a student's click landing at the same moment as the
     * expiry sweeper. The status update is conditional on the attempt still
     * being in progress, so only the winner runs the post-submit side effects.
     */
    it('does not re-run post-submit work when another submit won the race', async () => {
      supabaseMock.queueResult('attempts', { data: openAttempt(10) });
      supabaseMock.queueResult('tests', { data: { duration_minutes: 60 } });
      supabaseMock.queueResult('tests', {
        data: {
          negative_marking: false,
          negative_marks: 0,
          results_published: true,
        },
      });
      supabaseMock.queueResult('test_questions', {
        data: [
          {
            question_id: 'q1',
            marks_override: null,
            questions: { correct_answer: { index: 0 }, marks: 4 },
          },
        ],
      });
      supabaseMock.queueResult('answers', {
        data: [{ question_id: 'q1', selected_answer: { index: 0 } }],
      });
      supabaseMock.queueResult('answers', { data: null });
      // The conditional update matches no row: someone else already finalised it.
      supabaseMock.queueResult('attempts', { data: null });

      const result = await service.submitAttempt(ATTEMPT_ID, STUDENT);

      // The caller still gets a coherent result…
      expect(result.score).toBe(4);
      // …but the side effects belong to whoever actually claimed the attempt.
      expect(srsStub.processAttempt).not.toHaveBeenCalled();
      expect(cacheStub.invalidate).not.toHaveBeenCalled();
    });

    // A failure in the analytics write must never lose a student's submission.
    it('still returns a result when spaced repetition fails', async () => {
      srsStub.processAttempt.mockRejectedValueOnce(new Error('srs exploded'));

      queueGrading({
        testQuestions: [
          {
            question_id: 'q1',
            marks_override: null,
            questions: { correct_answer: { index: 0 }, marks: 4 },
          },
        ],
        studentAnswers: [{ question_id: 'q1', selected_answer: { index: 0 } }],
      });

      await expect(
        service.submitAttempt(ATTEMPT_ID, STUDENT),
      ).resolves.toMatchObject({ score: 4 });
    });
  });
});
