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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../../config/supabase.config");
const query_util_1 = require("../../common/db/query.util");
const cache_service_1 = require("../../common/cache/cache.service");
const tests_service_1 = require("../tests/tests.service");
const COHORT_TTL_SECONDS = Number(process.env.COHORT_TTL_SECONDS) || 120;
const COHORT_CACHE_PREFIX = 'analytics:cohort:';
let AnalyticsService = class AnalyticsService {
    cache;
    constructor(cache) {
        this.cache = cache;
    }
    async getStudentAnalytics(studentId) {
        const submitted = await (0, query_util_1.fetchAll)(() => supabase_config_1.supabase
            .from('attempts')
            .select('id, test_id, total_score, started_at, submitted_at, tests(title, total_marks)')
            .eq('student_id', studentId)
            .eq('status', 'submitted')
            .order('submitted_at', { ascending: true }));
        const released = await (0, tests_service_1.releasedTestIds)(submitted.map((a) => a.test_id));
        const attempts = submitted.filter((a) => released.has(a.test_id));
        const attemptIds = attempts.map((a) => a.id);
        const answers = await (0, query_util_1.fetchAllIn)(attemptIds, (idChunk) => supabase_config_1.supabase
            .from('answers')
            .select('is_correct, time_spent_seconds, questions(subject, topic, difficulty)')
            .in('attempt_id', idChunk));
        const subjectMap = {};
        const topicMap = {};
        let totalTimeSeconds = 0;
        let timedAnswers = 0;
        for (const ans of answers) {
            const q = ans.questions;
            const subject = q?.subject || 'Unknown';
            const topic = q?.topic;
            if (!subjectMap[subject])
                subjectMap[subject] = { correct: 0, total: 0 };
            subjectMap[subject].total += 1;
            if (ans.is_correct)
                subjectMap[subject].correct += 1;
            if (topic) {
                const key = `${subject}::${topic}`;
                if (!topicMap[key])
                    topicMap[key] = { subject, correct: 0, total: 0 };
                topicMap[key].total += 1;
                if (ans.is_correct)
                    topicMap[key].correct += 1;
            }
            const secs = Number(ans.time_spent_seconds) || 0;
            if (secs > 0) {
                totalTimeSeconds += secs;
                timedAnswers += 1;
            }
        }
        const subjectBreakdown = Object.entries(subjectMap).map(([subject, stats]) => ({
            subject,
            accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
            totalAnswered: stats.total,
        }));
        const topicBreakdown = Object.entries(topicMap)
            .map(([key, stats]) => ({
            topic: key.split('::')[1],
            subject: stats.subject,
            accuracy: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
            totalAnswered: stats.total,
        }))
            .sort((a, b) => a.accuracy - b.accuracy);
        const totalAnswered = Object.values(subjectMap).reduce((s, v) => s + v.total, 0);
        const totalCorrect = Object.values(subjectMap).reduce((s, v) => s + v.correct, 0);
        const scoreHistory = attempts.map((a) => ({
            title: a.tests?.title,
            score: a.total_score,
            maxScore: a.tests?.total_marks,
            date: a.submitted_at,
        }));
        const { data: srState } = await supabase_config_1.supabase
            .from('spaced_repetition_state')
            .select('priority_weight, mastery_level, questions(subject, topic, question_text)')
            .eq('student_id', studentId)
            .order('priority_weight', { ascending: false })
            .limit(10);
        const { data: predictions } = await supabase_config_1.supabase
            .from('predictions')
            .select('subject, topic, predicted_score, risk_flag, computed_at')
            .eq('student_id', studentId)
            .order('computed_at', { ascending: false })
            .limit(100);
        return {
            testsAttempted: attempts.length,
            totalScore: attempts.reduce((s, a) => s + (Number(a.total_score) || 0), 0),
            avgAccuracy: totalAnswered > 0
                ? Math.round((totalCorrect / totalAnswered) * 100)
                : 0,
            avgSecondsPerQuestion: timedAnswers > 0 ? Math.round(totalTimeSeconds / timedAnswers) : 0,
            subjectBreakdown,
            topicBreakdown,
            weakTopics: topicBreakdown
                .filter((t) => t.totalAnswered >= 3)
                .slice(0, 5),
            scoreHistory,
            spacedRepetition: srState || [],
            predictions: predictions || [],
        };
    }
    async getCohortAnalytics(batchId) {
        return this.cache.wrap(`${COHORT_CACHE_PREFIX}${batchId || 'all'}`, COHORT_TTL_SECONDS, () => this.computeCohortAnalytics(batchId));
    }
    async computeCohortAnalytics(batchId) {
        let studentIds;
        if (batchId) {
            const members = await (0, query_util_1.fetchAll)(() => supabase_config_1.supabase
                .from('batch_students')
                .select('student_id')
                .eq('batch_id', batchId));
            const memberIds = [...new Set(members.map((m) => m.student_id))];
            if (!memberIds.length) {
                return {
                    totalStudents: 0,
                    avgScore: 0,
                    atRiskCount: 0,
                    totalAttempts: 0,
                };
            }
            const students = await (0, query_util_1.fetchAllIn)(memberIds, (idChunk) => supabase_config_1.supabase
                .from('users')
                .select('id')
                .eq('role', 'student')
                .in('id', idChunk));
            studentIds = students.map((s) => s.id);
        }
        else {
            const students = await (0, query_util_1.fetchAll)(() => supabase_config_1.supabase.from('users').select('id').eq('role', 'student'));
            studentIds = students.map((s) => s.id);
        }
        if (!studentIds.length) {
            return {
                totalStudents: 0,
                avgScore: 0,
                atRiskCount: 0,
                totalAttempts: 0,
            };
        }
        const attempts = await (0, query_util_1.fetchAllIn)(studentIds, (idChunk) => supabase_config_1.supabase
            .from('attempts')
            .select('student_id, total_score, tests(total_marks)')
            .in('student_id', idChunk)
            .eq('status', 'submitted'));
        const avgScore = attempts.length
            ? Math.round(attempts.reduce((sum, a) => sum + (Number(a.total_score) || 0), 0) /
                attempts.length)
            : 0;
        const riskStudents = await (0, query_util_1.fetchAllIn)(studentIds, (idChunk) => supabase_config_1.supabase
            .from('predictions')
            .select('student_id')
            .in('student_id', idChunk)
            .eq('risk_flag', true));
        return {
            totalStudents: studentIds.length,
            avgScore,
            atRiskCount: new Set(riskStudents.map((r) => r.student_id)).size,
            totalAttempts: attempts.length,
        };
    }
    async getStudentAnalyticsForTeacher(studentId) {
        return this.getStudentAnalytics(studentId);
    }
    async invalidateCohortCache() {
        await this.cache.invalidate(COHORT_CACHE_PREFIX);
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cache_service_1.CacheService])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map