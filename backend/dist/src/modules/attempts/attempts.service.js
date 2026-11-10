"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AttemptsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttemptsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../../config/supabase.config");
const spaced_repetition_service_1 = require("../analytics/spaced-repetition.service");
const cache_service_1 = require("../../common/cache/cache.service");
const query_util_1 = require("../../common/db/query.util");
const tests_service_1 = require("../tests/tests.service");
const exam_patterns_1 = require("../tests/exam-patterns");
const CLOCK_GRACE_SECONDS = 30;
const VIOLATION_LIMIT = 3;
const ALREADY_SUBMITTED = 'You have already submitted this test. Each test can be taken only once.';
const ANSWER_STATUSES = [
    'not_visited',
    'not_answered',
    'answered',
    'marked',
    'answered_marked',
];
const COHORT_STATS_TTL_SECONDS = 60;
const SWEEP_BATCH_LIMIT = 200;
const MAX_SWEEP_PAGES = 50;
let AttemptsService = AttemptsService_1 = class AttemptsService {
    srsService;
    cache;
    logger = new common_1.Logger(AttemptsService_1.name);
    hasAnswerStatus = null;
    hasViolationsTable = null;
    constructor(srsService, cache) {
        this.srsService = srsService;
        this.cache = cache;
    }
    isMissingSchema(error) {
        if (!error)
            return false;
        const code = String(error.code || '');
        if (code === 'PGRST204' ||
            code === 'PGRST205' ||
            code === '42703' ||
            code === '42P01') {
            return true;
        }
        return /does not exist|schema cache/i.test(String(error.message || ''));
    }
    isUniqueViolation(error) {
        if (!error)
            return false;
        return (String(error.code || '') === '23505' ||
            /duplicate key value/i.test(String(error.message || '')));
    }
    warnMigrationMissing(what) {
        this.logger.warn(`${what} is missing — run backend/migrations/005_exam_session_sync.sql. ` +
            'Running degraded until then.');
    }
    async loadWindow(attemptId, studentId) {
        const { data: attempt } = await supabase_config_1.supabase
            .from('attempts')
            .select('id, test_id, status, started_at')
            .eq('id', attemptId)
            .eq('student_id', studentId)
            .single();
        if (!attempt)
            throw new common_1.NotFoundException('Attempt not found');
        const { data: test } = await supabase_config_1.supabase
            .from('tests')
            .select('duration_minutes')
            .eq('id', attempt.test_id)
            .single();
        const durationMinutes = test?.duration_minutes || 60;
        const startedAt = new Date(attempt.started_at || Date.now());
        const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
        return {
            attemptId: attempt.id,
            testId: attempt.test_id,
            status: attempt.status,
            startedAt,
            expiresAt,
            durationMinutes,
        };
    }
    isExpired(window) {
        return Date.now() > window.expiresAt.getTime() + CLOCK_GRACE_SECONDS * 1000;
    }
    async getMarkingScheme(testId) {
        const { data } = await supabase_config_1.supabase
            .from('tests')
            .select('*')
            .eq('id', testId)
            .single();
        const row = data || {};
        return {
            negativeMarking: row.negative_marking === true,
            negativeMarks: Number(row.negative_marks) || 0,
            resultsPublished: (0, tests_service_1.isTestResultsPublished)(row),
            pattern: (0, exam_patterns_1.getPattern)((0, exam_patterns_1.patternIdOf)(row)),
        };
    }
    async resolveAssignmentWindow(testId, studentId) {
        const { data: rows, error } = await supabase_config_1.supabase
            .from('test_assignments')
            .select('id, scheduled_start, scheduled_end')
            .eq('test_id', testId)
            .eq('student_id', studentId);
        if (error)
            throw new Error(error.message);
        if (!rows?.length)
            return null;
        let start = null;
        let end = null;
        let unboundedStart = false;
        let unboundedEnd = false;
        for (const row of rows) {
            if (!row.scheduled_start)
                unboundedStart = true;
            else {
                const t = new Date(row.scheduled_start).getTime();
                start = start === null ? t : Math.min(start, t);
            }
            if (!row.scheduled_end)
                unboundedEnd = true;
            else {
                const t = new Date(row.scheduled_end).getTime();
                end = end === null ? t : Math.max(end, t);
            }
        }
        return {
            scheduled_start: unboundedStart || start === null ? null : new Date(start).toISOString(),
            scheduled_end: unboundedEnd || end === null ? null : new Date(end).toISOString(),
        };
    }
    assertWritable(window) {
        if (window.status === 'submitted') {
            throw new common_1.BadRequestException('Test already submitted');
        }
        if (this.isExpired(window)) {
            throw new common_1.ForbiddenException('Time is up for this attempt. Your answers can no longer be changed.');
        }
    }
    async attemptsFor(testId, studentId) {
        const { data, error } = await supabase_config_1.supabase
            .from('attempts')
            .select('id, status, started_at')
            .eq('test_id', testId)
            .eq('student_id', studentId)
            .order('started_at', { ascending: true })
            .order('id', { ascending: true });
        if (error)
            throw new Error(error.message);
        if (!data)
            return [];
        return Array.isArray(data) ? data : [data];
    }
    async hasOtherSubmittedAttempt(attempt) {
        const all = await this.attemptsFor(attempt.test_id, attempt.student_id);
        return all.some((a) => a.id !== attempt.id && a.status === 'submitted');
    }
    async startAttempt(testId, studentId) {
        const assignment = await this.resolveAssignmentWindow(testId, studentId);
        if (!assignment) {
            throw new common_1.ForbiddenException('You are not assigned to this test');
        }
        const now = Date.now();
        if (assignment.scheduled_start) {
            const opensAt = new Date(assignment.scheduled_start).getTime();
            if (now < opensAt - CLOCK_GRACE_SECONDS * 1000) {
                throw new common_1.ForbiddenException(`This test opens at ${new Date(assignment.scheduled_start).toLocaleString()}.`);
            }
        }
        if (assignment.scheduled_end) {
            const closesAt = new Date(assignment.scheduled_end).getTime();
            if (now > closesAt + CLOCK_GRACE_SECONDS * 1000) {
                throw new common_1.ForbiddenException('The window for this test has closed.');
            }
        }
        const priorAttempts = await this.attemptsFor(testId, studentId);
        if (priorAttempts.some((a) => a.status === 'submitted')) {
            throw new common_1.BadRequestException(ALREADY_SUBMITTED);
        }
        const existing = priorAttempts.find((a) => a.status === 'in_progress');
        const { data: test } = await supabase_config_1.supabase
            .from('tests')
            .select('duration_minutes, status')
            .eq('id', testId)
            .single();
        if (!test)
            throw new common_1.NotFoundException('Test not found');
        if (test.status !== 'published') {
            throw new common_1.ForbiddenException('This test is not available yet.');
        }
        if (existing?.status === 'in_progress') {
            return this.resumeAttempt(existing, testId, test.duration_minutes || 60, studentId);
        }
        const startedAt = new Date();
        const expiresAt = new Date(startedAt.getTime() + test.duration_minutes * 60 * 1000);
        const { data: attempt, error } = await supabase_config_1.supabase
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
            if (this.isUniqueViolation(error)) {
                const { data: raced } = await supabase_config_1.supabase
                    .from('attempts')
                    .select('id, status, started_at')
                    .eq('test_id', testId)
                    .eq('student_id', studentId)
                    .maybeSingle();
                if (raced?.status === 'in_progress') {
                    return this.resumeAttempt(raced, testId, test.duration_minutes || 60, studentId);
                }
                throw new common_1.BadRequestException(ALREADY_SUBMITTED);
            }
            throw new Error(error.message);
        }
        const all = await this.attemptsFor(testId, studentId);
        const canonical = all[0];
        if (canonical && canonical.id !== attempt.id) {
            await supabase_config_1.supabase.from('attempts').delete().eq('id', attempt.id).eq('status', 'in_progress');
            this.logger.warn(`Duplicate start for test ${testId} by ${studentId}; kept attempt ${canonical.id}.`);
            if (canonical.status === 'submitted') {
                throw new common_1.BadRequestException(ALREADY_SUBMITTED);
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
    async resumeAttempt(existing, testId, durationMinutes, studentId) {
        const startedAt = new Date(existing.started_at || Date.now());
        const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
        if (Date.now() > expiresAt.getTime() + CLOCK_GRACE_SECONDS * 1000) {
            await this.submitAttempt(existing.id, studentId, true).catch(() => undefined);
            throw new common_1.BadRequestException('Your time for this test had already expired. The attempt was submitted automatically.');
        }
        return {
            attemptId: existing.id,
            testId,
            resumed: true,
            startedAt: startedAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            timeLeftSeconds: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
            savedAnswers: await this.getSavedAnswers(existing.id),
        };
    }
    async getSavedAnswers(attemptId) {
        const columns = 'question_id, selected_answer, flagged_for_doubt, time_spent_seconds';
        if (this.hasAnswerStatus !== false) {
            const { data, error } = await supabase_config_1.supabase
                .from('answers')
                .select(`${columns}, status`)
                .eq('attempt_id', attemptId);
            if (!error) {
                this.hasAnswerStatus = true;
                return data || [];
            }
            if (!this.isMissingSchema(error))
                throw new Error(error.message);
            this.hasAnswerStatus = false;
            this.warnMigrationMissing('answers.status');
        }
        const { data, error } = await supabase_config_1.supabase
            .from('answers')
            .select(columns)
            .eq('attempt_id', attemptId);
        if (error)
            throw new Error(error.message);
        return data || [];
    }
    async saveAnswer(attemptId, studentId, body) {
        const window = await this.loadWindow(attemptId, studentId);
        this.assertWritable(window);
        const status = ANSWER_STATUSES.includes(body.status)
            ? body.status
            : body.selected_answer
                ? 'answered'
                : 'not_answered';
        const row = {
            attempt_id: attemptId,
            question_id: body.question_id,
            selected_answer: body.selected_answer,
            time_spent_seconds: Math.max(0, Number(body.time_spent_seconds) || 0),
        };
        if (this.hasAnswerStatus !== false)
            row.status = status;
        const { error } = await supabase_config_1.supabase
            .from('answers')
            .upsert(row, { onConflict: 'attempt_id,question_id' });
        if (error) {
            if (this.hasAnswerStatus === null && this.isMissingSchema(error)) {
                this.hasAnswerStatus = false;
                this.warnMigrationMissing('answers.status');
                return this.saveAnswer(attemptId, studentId, body);
            }
            throw new Error(error.message);
        }
        if (this.hasAnswerStatus === null)
            this.hasAnswerStatus = true;
        return { saved: true, status };
    }
    async logViolation(attemptId, studentId, body) {
        const { data: attempt } = await supabase_config_1.supabase
            .from('attempts')
            .select('id, test_id, status, started_at, student_id')
            .eq('id', attemptId)
            .eq('student_id', studentId)
            .single();
        if (!attempt)
            throw new common_1.NotFoundException('Attempt not found');
        if (attempt.status === 'submitted') {
            return {
                terminated: true,
                strikes: VIOLATION_LIMIT,
                limit: VIOLATION_LIMIT,
            };
        }
        const { error } = await supabase_config_1.supabase.from('attempt_violations').insert({
            attempt_id: attemptId,
            student_id: studentId,
            type: (body?.type || 'unknown').slice(0, 64),
            detail: body?.detail ? String(body.detail).slice(0, 500) : null,
        });
        if (error) {
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
        const { count } = await supabase_config_1.supabase
            .from('attempt_violations')
            .select('*', { count: 'exact', head: true })
            .eq('attempt_id', attemptId);
        const strikes = count ?? 0;
        const terminated = strikes >= VIOLATION_LIMIT;
        if (terminated) {
            this.logger.warn(`Attempt ${attemptId} terminated after ${strikes} violations.`);
            const duplicate = await this.hasOtherSubmittedAttempt(attempt).catch(() => false);
            if (duplicate)
                return { terminated, strikes, limit: VIOLATION_LIMIT };
            await this.gradeAndFinalise(attempt, true).catch((e) => this.logger.error(`Failed to finalise terminated attempt ${attemptId}: ${e?.message}`));
        }
        return { terminated, strikes, limit: VIOLATION_LIMIT };
    }
    async toggleFlag(attemptId, studentId, questionId, flagged) {
        const window = await this.loadWindow(attemptId, studentId);
        this.assertWritable(window);
        const { error } = await supabase_config_1.supabase.from('answers').upsert({
            attempt_id: attemptId,
            question_id: questionId,
            flagged_for_doubt: flagged,
        }, { onConflict: 'attempt_id,question_id' });
        if (error)
            throw new Error(error.message);
        return { flagged };
    }
    async submitAttempt(attemptId, studentId, autoSubmitted = false) {
        const { data: attempt } = await supabase_config_1.supabase
            .from('attempts')
            .select('id, test_id, status, started_at, student_id')
            .eq('id', attemptId)
            .eq('student_id', studentId)
            .single();
        if (!attempt)
            throw new common_1.NotFoundException('Attempt not found');
        if (attempt.status === 'submitted')
            throw new common_1.BadRequestException('Already submitted');
        if (await this.hasOtherSubmittedAttempt(attempt)) {
            throw new common_1.BadRequestException(ALREADY_SUBMITTED);
        }
        return this.gradeAndFinalise(attempt, autoSubmitted);
    }
    async gradeAndFinalise(attempt, autoSubmitted) {
        const attemptId = attempt.id;
        const { data: test } = await supabase_config_1.supabase
            .from('tests')
            .select('duration_minutes')
            .eq('id', attempt.test_id)
            .single();
        const durationMinutes = test?.duration_minutes || 60;
        const startedAt = new Date(attempt.started_at || Date.now());
        const expiresAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
        const lateSubmit = Date.now() > expiresAt.getTime() + CLOCK_GRACE_SECONDS * 1000;
        const effectiveAutoSubmit = autoSubmitted || lateSubmit;
        const scheme = await this.getMarkingScheme(attempt.test_id);
        const testQuestions = await (0, query_util_1.fetchAll)(() => supabase_config_1.supabase
            .from('test_questions')
            .select('question_id, question_order, marks_override, questions(correct_answer, marks, subject, q_type, options)')
            .eq('test_id', attempt.test_id));
        const pattern = scheme.pattern;
        const sections = pattern
            ? (0, exam_patterns_1.resolveSections)(pattern, testQuestions.map((tq) => ({
                question_id: tq.question_id,
                question_order: tq.question_order,
                subject: tq.questions?.subject,
                q_type: tq.questions?.q_type,
                options: tq.questions?.options,
            })))
            : new Map();
        const studentAnswers = await (0, query_util_1.fetchAll)(() => supabase_config_1.supabase
            .from('answers')
            .select('question_id, selected_answer')
            .eq('attempt_id', attemptId));
        const answerMap = new Map(studentAnswers.map((a) => [a.question_id, a.selected_answer]));
        let totalScore = 0;
        const answerUpdates = [];
        for (const tq of testQuestions) {
            const questionId = tq.question_id;
            const correctAnswer = tq.questions?.correct_answer;
            const marks = Number(tq.marks_override || tq.questions?.marks || 4);
            const studentAnswer = answerMap.get(questionId);
            const attempted = !this.isEmptyAnswer(studentAnswer);
            const section = sections.get(questionId);
            let isCorrect = false;
            if (section && pattern) {
                if (attempted) {
                    const scored = (0, exam_patterns_1.scoreInSection)(section, studentAnswer, correctAnswer, pattern.numericAnswer);
                    totalScore += scored.score;
                    isCorrect = scored.full;
                }
            }
            else {
                isCorrect = attempted && this.answersMatch(studentAnswer, correctAnswer);
                if (isCorrect) {
                    totalScore += marks;
                }
                else if (attempted && scheme.negativeMarking) {
                    totalScore -= scheme.negativeMarks;
                }
            }
            answerUpdates.push({
                attempt_id: attemptId,
                question_id: questionId,
                is_correct: attempted ? isCorrect : null,
            });
        }
        const attemptedUpdates = answerUpdates.filter((u) => u.is_correct !== null);
        for (const batch of (0, query_util_1.chunk)(attemptedUpdates, 500)) {
            const { error } = await supabase_config_1.supabase
                .from('answers')
                .upsert(batch, { onConflict: 'attempt_id,question_id' });
            if (error)
                throw new Error(error.message);
        }
        const submittedAt = new Date();
        const rawSeconds = Math.floor((submittedAt.getTime() - startedAt.getTime()) / 1000);
        const timeTakenSeconds = Math.min(rawSeconds, durationMinutes * 60);
        const { data: claimed, error } = await supabase_config_1.supabase
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
        if (error)
            throw new Error(error.message);
        if (claimed) {
            await this.srsService
                .processAttempt(attemptId, attempt.student_id)
                .catch((e) => this.logger.error(`Spaced-repetition update failed for ${attemptId}: ${e?.message}`));
            await this.cache.invalidate('leaderboard:').catch(() => undefined);
            await this.cache.invalidate('analytics:cohort:').catch(() => undefined);
            await this.cache
                .invalidate(`attempt-cohort:${attempt.test_id}`)
                .catch(() => undefined);
        }
        else {
            this.logger.log(`Attempt ${attemptId} was already finalised by a concurrent submit.`);
        }
        const correct = answerUpdates.filter((a) => a.is_correct === true).length;
        const incorrect = answerUpdates.filter((a) => a.is_correct === false).length;
        const unattempted = answerUpdates.filter((a) => a.is_correct === null).length;
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
                message: 'Your attempt has been noted and securely recorded. Results will be released once approved by the administrator.',
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
    isEmptyAnswer(answer) {
        if (answer === undefined || answer === null)
            return true;
        if (typeof answer !== 'object')
            return String(answer).trim() === '';
        if (Array.isArray(answer.indices))
            return answer.indices.length === 0;
        if ('value' in answer)
            return answer.value === null || String(answer.value).trim() === '';
        if ('index' in answer)
            return (answer.index === null ||
                answer.index === undefined ||
                answer.index === '');
        return Object.keys(answer).filter((k) => k !== 'status').length === 0;
    }
    answersMatch(submitted, correct) {
        if (submitted == null || correct == null)
            return false;
        const subIdx = submitted?.indices;
        const corIdx = correct?.indices;
        if (Array.isArray(subIdx) || Array.isArray(corIdx)) {
            const a = [...(subIdx || [])].sort();
            const b = [...(corIdx || [])].sort();
            return a.length === b.length && a.every((v, i) => v === b[i]);
        }
        if (correct?.value !== undefined && submitted?.value !== undefined) {
            const a = String(submitted.value).trim().toLowerCase();
            const b = String(correct.value).trim().toLowerCase();
            if (a === b)
                return true;
            const na = Number(a);
            const nb = Number(b);
            return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
        }
        if (correct?.index !== undefined) {
            return Number(submitted?.index) === Number(correct.index);
        }
        return JSON.stringify(submitted) === JSON.stringify(correct);
    }
    async autoSubmitExpiredAttempts() {
        const open = [];
        for (let page = 0; page < MAX_SWEEP_PAGES; page++) {
            const from = page * SWEEP_BATCH_LIMIT;
            const { data: rows, error } = await supabase_config_1.supabase
                .from('attempts')
                .select('id, test_id, started_at, student_id, tests(duration_minutes)')
                .eq('status', 'in_progress')
                .order('started_at', { ascending: true })
                .range(from, from + SWEEP_BATCH_LIMIT - 1);
            if (error)
                throw new Error(error.message);
            open.push(...(rows || []));
            if (!rows || rows.length < SWEEP_BATCH_LIMIT)
                break;
            if (page === MAX_SWEEP_PAGES - 1) {
                this.logger.warn(`Expiry sweep stopped after ${MAX_SWEEP_PAGES} full pages.`);
            }
        }
        let submitted = 0;
        for (const attempt of open) {
            const durationMinutes = attempt.tests?.duration_minutes || 60;
            const startedAt = new Date(attempt.started_at || Date.now()).getTime();
            const expiresAt = startedAt + durationMinutes * 60 * 1000;
            if (Date.now() <= expiresAt + CLOCK_GRACE_SECONDS * 1000)
                continue;
            try {
                if (await this.hasOtherSubmittedAttempt(attempt)) {
                    await supabase_config_1.supabase.from('answers').delete().eq('attempt_id', attempt.id);
                    await supabase_config_1.supabase
                        .from('attempts')
                        .delete()
                        .eq('id', attempt.id)
                        .eq('status', 'in_progress');
                    this.logger.warn(`Discarded duplicate attempt ${attempt.id}: test already submitted by this student.`);
                    continue;
                }
                await this.gradeAndFinalise({
                    id: attempt.id,
                    test_id: attempt.test_id,
                    started_at: attempt.started_at,
                    student_id: attempt.student_id,
                }, true);
                submitted += 1;
            }
            catch (e) {
                this.logger.error(`Failed to auto-submit attempt ${attempt.id}: ${e?.message}`);
            }
        }
        if (submitted > 0) {
            this.logger.log(`Auto-submitted ${submitted} expired attempt(s).`);
        }
        return submitted;
    }
    async getMyAttempts(studentId) {
        const { data, error } = await supabase_config_1.supabase
            .from('attempts')
            .select('id, test_id, status, total_score, started_at, submitted_at, tests(id, title, total_marks, instructions, description)')
            .eq('student_id', studentId)
            .order('started_at', { ascending: false })
            .limit(200);
        if (error)
            throw new Error(error.message);
        return (data || []).map((a) => {
            const published = (0, tests_service_1.isTestResultsPublished)(a.tests);
            return {
                ...a,
                results_published: published,
                total_score: published ? a.total_score : null,
            };
        });
    }
    async getAttemptResult(attemptId, studentId) {
        const { data: attempt, error } = await supabase_config_1.supabase
            .from('attempts')
            .select(`
        id, status, total_score, started_at, submitted_at, auto_submitted,
        tests(id, title, total_marks, duration_minutes, instructions, description),
        answers(
          question_id, selected_answer, is_correct, time_spent_seconds, flagged_for_doubt,
          questions(id, question_text, options, correct_answer, subject, topic, difficulty, marks)
        )
      `)
            .eq('id', attemptId)
            .eq('student_id', studentId)
            .single();
        if (error || !attempt)
            throw new common_1.NotFoundException('Attempt not found');
        const resultsPublished = (0, tests_service_1.isTestResultsPublished)(attempt.tests);
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
        if (attempt.status !== 'submitted') {
            for (const ans of attempt.answers || []) {
                if (ans.questions)
                    delete ans.questions.correct_answer;
            }
            return { ...attempt, cohort: null };
        }
        return { ...attempt, cohort: await this.getCohortPosition(attempt) };
    }
    async getCohortPosition(attempt) {
        const testId = attempt.tests?.id;
        if (!testId)
            return null;
        const score = Number(attempt.total_score) || 0;
        const countWhere = async (apply) => {
            const { count } = await apply(supabase_config_1.supabase
                .from('attempts')
                .select('*', { count: 'exact', head: true })
                .eq('test_id', testId)
                .eq('status', 'submitted'));
            return count ?? 0;
        };
        const [totalStudents, above, below] = await Promise.all([
            countWhere((q) => q),
            countWhere((q) => q.gt('total_score', score)),
            countWhere((q) => q.lt('total_score', score)),
        ]);
        if (!totalStudents)
            return null;
        const stats = await this.getTestScoreStats(testId);
        return {
            rank: above + 1,
            totalStudents,
            percentile: Math.round((below / totalStudents) * 100),
            average: stats.average,
            highest: stats.highest,
        };
    }
    async getTestScoreStats(testId) {
        return this.cache.wrap(`attempt-cohort:${testId}`, COHORT_STATS_TTL_SECONDS, async () => {
            const rows = await (0, query_util_1.fetchAll)(() => supabase_config_1.supabase
                .from('attempts')
                .select('total_score')
                .eq('test_id', testId)
                .eq('status', 'submitted'));
            if (!rows.length)
                return { average: 0, highest: 0 };
            const scores = rows.map((r) => Number(r.total_score) || 0);
            return {
                average: Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)),
                highest: Math.max(...scores),
            };
        });
    }
};
exports.AttemptsService = AttemptsService;
exports.AttemptsService = AttemptsService = AttemptsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [spaced_repetition_service_1.SpacedRepetitionService,
        cache_service_1.CacheService])
], AttemptsService);
//# sourceMappingURL=attempts.service.js.map