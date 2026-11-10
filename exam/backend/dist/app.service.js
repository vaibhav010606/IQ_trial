"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AppService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppService = void 0;
if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = class WebSocketDummy {
    };
}
const common_1 = require("@nestjs/common");
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = __importStar(require("dotenv"));
const path_1 = require("path");
dotenv.config({ path: (0, path_1.resolve)(process.cwd(), '.env') });
const CLOCK_GRACE_SECONDS = 30;
const VIOLATION_LIMIT = 3;
const VIOLATION_TYPES = [
    'tab_hidden',
    'window_blur',
    'fullscreen_exit',
    'devtools_suspected',
];
const RESPONSE_STATUSES = [
    'not_visited',
    'not_answered',
    'answered',
    'marked',
    'answered_marked',
];
function isValidUUID(id) {
    if (typeof id !== 'string' || id.length !== 36)
        return false;
    for (let i = 0; i < 36; i++) {
        if (i === 8 || i === 13 || i === 18 || i === 23) {
            if (id.charCodeAt(i) !== 45)
                return false;
        }
        else {
            const code = id.charCodeAt(i);
            const isHex = (code >= 48 && code <= 57) || (code >= 65 && code <= 70) || (code >= 97 && code <= 102);
            if (!isHex)
                return false;
        }
    }
    return true;
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let AppService = AppService_1 = class AppService {
    logger = new common_1.Logger(AppService_1.name);
    supabase;
    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL?.trim();
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in exam/backend/.env. ' +
                'The exam backend cannot start without valid Supabase credentials.');
        }
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });
    }
    isMissingSchema(error) {
        const code = String(error?.code || '');
        if (code === 'PGRST205' || code === '42P01')
            return true;
        return /could not find the table|does not exist|schema cache/i.test(String(error?.message || ''));
    }
    assertSchemaPresent(error, operation) {
        if (!error || !this.isMissingSchema(error))
            return;
        this.logger.error(`${operation} failed: the exam tables are missing. Run exam/backend/schema.sql and ` +
            'then exam/backend/migrations/001_exam_hardening.sql against this Supabase project.');
        throw new common_1.ServiceUnavailableException('The secure exam service is not set up yet. Ask an administrator to run the exam schema.');
    }
    async loadOwnedSession(sessionId, studentId) {
        if (!isValidUUID(sessionId))
            throw new common_1.NotFoundException('Exam session not found');
        const { data: session, error } = await this.supabase
            .from('exam_sessions')
            .select('id, student_id, exam_id, started_at, ends_at, status, score')
            .eq('id', sessionId)
            .single();
        this.assertSchemaPresent(error, 'Loading an exam session');
        if (error || !session)
            throw new common_1.NotFoundException('Exam session not found');
        if (session.student_id !== studentId) {
            throw new common_1.ForbiddenException('This exam session does not belong to you.');
        }
        return session;
    }
    isExpired(endsAt) {
        return Date.now() > new Date(endsAt).getTime() + CLOCK_GRACE_SECONDS * 1000;
    }
    async startSession(examId, studentId) {
        if (!isValidUUID(examId))
            throw new common_1.NotFoundException('Test not found');
        const { data: testData, error: testError } = await this.supabase
            .from('tests')
            .select('id, title, duration_minutes, total_marks, status, negative_marking, negative_marks')
            .eq('id', examId)
            .single();
        if (testError || !testData)
            throw new common_1.NotFoundException('Test not found');
        if (testData.status !== 'published') {
            throw new common_1.ForbiddenException('This test is not published.');
        }
        const { data: assignment } = await this.supabase
            .from('test_assignments')
            .select('id, scheduled_start, scheduled_end')
            .eq('test_id', examId)
            .eq('student_id', studentId)
            .maybeSingle();
        if (!assignment)
            throw new common_1.ForbiddenException('You are not assigned to this test.');
        const now = Date.now();
        if (assignment.scheduled_start &&
            now < new Date(assignment.scheduled_start).getTime() - CLOCK_GRACE_SECONDS * 1000) {
            throw new common_1.ForbiddenException('This test has not opened yet.');
        }
        if (assignment.scheduled_end &&
            now > new Date(assignment.scheduled_end).getTime() + CLOCK_GRACE_SECONDS * 1000) {
            throw new common_1.ForbiddenException('The window for this test has closed.');
        }
        const { data: existing, error: existingError } = await this.supabase
            .from('exam_sessions')
            .select('*')
            .eq('exam_id', examId)
            .eq('student_id', studentId)
            .maybeSingle();
        this.assertSchemaPresent(existingError, 'Starting an exam session');
        if (existing && existing.status !== 'in_progress') {
            throw new common_1.BadRequestException('You have already completed this exam.');
        }
        if (existing) {
            return {
                sessionId: existing.id,
                startedAt: existing.started_at,
                endsAt: existing.ends_at,
                resumed: true,
                testDetails: testData,
                savedResponses: await this.loadResponses(existing.id),
            };
        }
        const startedAt = new Date();
        const endsAt = new Date(startedAt.getTime() + (testData.duration_minutes || 60) * 60 * 1000);
        const { data: newSession, error: createError } = await this.supabase
            .from('exam_sessions')
            .insert({
            student_id: studentId,
            exam_id: examId,
            started_at: startedAt.toISOString(),
            ends_at: endsAt.toISOString(),
            status: 'in_progress',
        })
            .select()
            .single();
        if (createError) {
            this.assertSchemaPresent(createError, 'Creating an exam session');
            if (this.isUniqueViolation(createError)) {
                const { data: raced } = await this.supabase
                    .from('exam_sessions')
                    .select('*')
                    .eq('exam_id', examId)
                    .eq('student_id', studentId)
                    .maybeSingle();
                if (raced) {
                    return {
                        sessionId: raced.id,
                        startedAt: raced.started_at,
                        endsAt: raced.ends_at,
                        resumed: true,
                        testDetails: testData,
                        savedResponses: await this.loadResponses(raced.id),
                    };
                }
            }
            throw new common_1.InternalServerErrorException('Failed to create session');
        }
        return {
            sessionId: newSession.id,
            startedAt: newSession.started_at,
            endsAt: newSession.ends_at,
            resumed: false,
            testDetails: testData,
            savedResponses: [],
        };
    }
    async loadResponses(sessionId) {
        const { data } = await this.supabase
            .from('exam_responses')
            .select('question_id, selected_answer, status, time_spent_seconds')
            .eq('session_id', sessionId);
        return data || [];
    }
    async getQuestions(sessionId, studentId) {
        const session = await this.loadOwnedSession(sessionId, studentId);
        const { data, error } = await this.supabase
            .from('test_questions')
            .select(`
        question_order, marks_override,
        questions(id, subject, topic, question_text, options, difficulty, q_type, image_url, marks)
      `)
            .eq('test_id', session.exam_id)
            .order('question_order', { ascending: true });
        if (error)
            throw new common_1.InternalServerErrorException('Failed to load questions');
        return (data || []).map((row, idx) => ({
            id: row.questions?.id,
            order: row.question_order ?? idx + 1,
            subject: row.questions?.subject,
            topic: row.questions?.topic,
            question_text: row.questions?.question_text,
            options: row.questions?.options,
            image_url: row.questions?.image_url,
            difficulty: row.questions?.difficulty,
            type: row.questions?.q_type,
            marks: row.marks_override || row.questions?.marks || 4,
        }));
    }
    async heartbeat(sessionId, studentId) {
        const session = await this.loadOwnedSession(sessionId, studentId);
        const remainingSeconds = Math.max(0, Math.floor((new Date(session.ends_at).getTime() - Date.now()) / 1000));
        if (remainingSeconds <= 0 && session.status === 'in_progress') {
            await this.submitSession(sessionId, studentId, true);
            return { remainingSeconds: 0, status: 'auto_submitted' };
        }
        return { remainingSeconds, status: session.status };
    }
    async saveResponse(sessionId, studentId, payload) {
        const session = await this.loadOwnedSession(sessionId, studentId);
        if (session.status !== 'in_progress') {
            throw new common_1.BadRequestException('This exam has already been submitted.');
        }
        if (this.isExpired(session.ends_at)) {
            throw new common_1.ForbiddenException('Time is up — your answers can no longer be changed.');
        }
        const { question_id, selected_answer, status, time_spent_seconds } = payload || {};
        if (typeof question_id !== 'string' || !question_id.trim()) {
            throw new common_1.BadRequestException('question_id is required');
        }
        if (question_id.length > 100) {
            throw new common_1.BadRequestException('question_id is not valid');
        }
        const safeStatus = RESPONSE_STATUSES.includes(status)
            ? status
            : selected_answer
                ? 'answered'
                : 'not_answered';
        const { error } = await this.supabase
            .from('exam_responses')
            .upsert({
            session_id: sessionId,
            question_id,
            selected_answer: selected_answer ?? null,
            status: safeStatus,
            time_spent_seconds: Math.min(86_400, Math.max(0, Number(time_spent_seconds) || 0)),
            last_updated_at: new Date().toISOString(),
        }, { onConflict: 'session_id,question_id' });
        if (error)
            throw new common_1.InternalServerErrorException('Failed to save response');
        return { success: true };
    }
    async logViolation(sessionId, studentId, payload) {
        const session = await this.loadOwnedSession(sessionId, studentId);
        if (session.status !== 'in_progress') {
            return { success: true, terminated: true, strikes: VIOLATION_LIMIT };
        }
        const type = VIOLATION_TYPES.includes(payload?.type)
            ? payload.type
            : null;
        if (!type) {
            throw new common_1.BadRequestException(`type must be one of: ${VIOLATION_TYPES.join(', ')}.`);
        }
        const durationMs = Number(payload?.duration_ms);
        const { error } = await this.supabase.from('exam_violations').insert({
            session_id: sessionId,
            type,
            duration_ms: Number.isFinite(durationMs)
                ? Math.min(86_400_000, Math.max(0, Math.round(durationMs)))
                : null,
        });
        if (error)
            throw new common_1.InternalServerErrorException('Failed to log violation');
        const { count } = await this.supabase
            .from('exam_violations')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sessionId);
        if (count !== null && count >= VIOLATION_LIMIT) {
            await this.finaliseSession(sessionId, session.exam_id, 'violation_terminated');
            return { success: true, terminated: true, strikes: count };
        }
        return { success: true, terminated: false, strikes: count ?? 0 };
    }
    async submitSession(sessionId, studentId, autoSubmitted = false) {
        const session = await this.loadOwnedSession(sessionId, studentId);
        if (session.status !== 'in_progress') {
            return { success: true, alreadySubmitted: true, score: session.score };
        }
        const late = this.isExpired(session.ends_at);
        const status = autoSubmitted || late ? 'auto_submitted' : 'submitted';
        const result = await this.finaliseSession(sessionId, session.exam_id, status);
        const { data: test } = await this.supabase
            .from('tests')
            .select('instructions, description')
            .eq('id', session.exam_id)
            .single();
        const resultsPublished = this.isResultsPublished(test);
        if (!resultsPublished) {
            return {
                success: true,
                submitted: true,
                results_published: false,
                autoSubmitted: autoSubmitted || late,
                message: 'Exam submitted successfully. Results will be released once approved by the administrator.',
            };
        }
        return { success: true, autoSubmitted: autoSubmitted || late, results_published: true, ...result };
    }
    async finaliseSession(sessionId, examId, status) {
        const result = await this.gradeSession(sessionId, examId);
        const { error } = await this.supabase
            .from('exam_sessions')
            .update({
            status,
            submitted_at: new Date().toISOString(),
            score: result.score,
        })
            .eq('id', sessionId)
            .eq('status', 'in_progress');
        if (error)
            throw new common_1.InternalServerErrorException('Failed to submit exam');
        return result;
    }
    isUniqueViolation(error) {
        return (String(error?.code || '') === '23505' ||
            /duplicate key value/i.test(String(error?.message || '')));
    }
    async gradeSession(sessionId, examId) {
        const { data: test } = await this.supabase
            .from('tests')
            .select('negative_marking, negative_marks')
            .eq('id', examId)
            .single();
        const negativeMarking = test?.negative_marking === true;
        const negativeMarks = Number(test?.negative_marks) || 0;
        const { data: testQuestions } = await this.supabase
            .from('test_questions')
            .select('question_id, marks_override, questions(correct_answer, marks)')
            .eq('test_id', examId);
        const { data: responses } = await this.supabase
            .from('exam_responses')
            .select('question_id, selected_answer')
            .eq('session_id', sessionId);
        const responseMap = new Map((responses || []).map((r) => [r.question_id, r.selected_answer]));
        let score = 0;
        let correct = 0;
        let incorrect = 0;
        let unattempted = 0;
        let maxScore = 0;
        for (const tq of (testQuestions || [])) {
            const marks = Number(tq.marks_override || tq.questions?.marks || 4);
            maxScore += marks;
            const submitted = responseMap.get(tq.question_id);
            if (submitted === undefined || submitted === null) {
                unattempted += 1;
                continue;
            }
            if (this.answersMatch(submitted, tq.questions?.correct_answer)) {
                score += marks;
                correct += 1;
            }
            else {
                if (negativeMarking)
                    score -= negativeMarks;
                incorrect += 1;
            }
        }
        const answered = correct + incorrect;
        return {
            score,
            maxScore,
            correct,
            incorrect,
            unattempted,
            accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
        };
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
    async getResult(sessionId, studentId) {
        const session = await this.loadOwnedSession(sessionId, studentId);
        if (session.status === 'in_progress') {
            throw new common_1.BadRequestException('This exam has not been submitted yet.');
        }
        const { data: test } = await this.supabase
            .from('tests')
            .select('title, total_marks, duration_minutes, instructions, description')
            .eq('id', session.exam_id)
            .single();
        const resultsPublished = this.isResultsPublished(test);
        if (!resultsPublished) {
            return {
                sessionId,
                status: session.status,
                test,
                results_published: false,
                violations: 0,
                message: 'Results are pending administrator review and approval.',
            };
        }
        const { count: violations } = await this.supabase
            .from('exam_violations')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sessionId);
        const graded = await this.gradeSession(sessionId, session.exam_id);
        return {
            sessionId,
            status: session.status,
            test,
            violations: violations ?? 0,
            storedScore: session.score,
            ...graded,
        };
    }
    isResultsPublished(test) {
        if (!test)
            return false;
        if (test.results_published === true)
            return true;
        if (typeof test.instructions === 'string' && test.instructions.includes('[RESULTS_PUBLISHED:true]')) {
            return true;
        }
        if (typeof test.description === 'string' && test.description.includes('[RESULTS_PUBLISHED:true]')) {
            return true;
        }
        return false;
    }
};
exports.AppService = AppService;
exports.AppService = AppService = AppService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AppService);
//# sourceMappingURL=app.service.js.map