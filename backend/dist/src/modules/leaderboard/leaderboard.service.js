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
exports.LeaderboardService = void 0;
const common_1 = require("@nestjs/common");
const supabase_config_1 = require("../../config/supabase.config");
const cache_service_1 = require("../../common/cache/cache.service");
const query_util_1 = require("../../common/db/query.util");
const tests_service_1 = require("../tests/tests.service");
const LEADERBOARD_TTL_SECONDS = Number(process.env.LEADERBOARD_TTL_SECONDS) || 300;
const CACHE_PREFIX = 'leaderboard:';
let LeaderboardService = class LeaderboardService {
    cache;
    constructor(cache) {
        this.cache = cache;
    }
    async buildRanking() {
        return this.cache.wrap(`${CACHE_PREFIX}global`, LEADERBOARD_TTL_SECONDS, async () => {
            const all = await (0, query_util_1.fetchAll)(() => supabase_config_1.supabase
                .from('attempts')
                .select('student_id, test_id, total_score, users(id, full_name)')
                .eq('status', 'submitted')
                .order('id', { ascending: true }));
            const released = await (0, tests_service_1.releasedTestIds)(all.map((a) => a.test_id));
            const data = all.filter((a) => released.has(a.test_id));
            const totals = new Map();
            for (const attempt of data) {
                const id = attempt.student_id;
                const score = Number(attempt.total_score) || 0;
                const name = attempt.users?.full_name || 'Unknown';
                const entry = totals.get(id) ?? {
                    id,
                    name,
                    totalScore: 0,
                    testCount: 0,
                    bestScore: 0,
                };
                entry.totalScore += score;
                entry.testCount += 1;
                entry.bestScore = Math.max(entry.bestScore, score);
                totals.set(id, entry);
            }
            const sorted = Array.from(totals.values()).sort((a, b) => b.totalScore - a.totalScore);
            let lastScore = null;
            let lastRank = 0;
            return sorted.map((student, idx) => {
                const rank = student.totalScore === lastScore ? lastRank : idx + 1;
                lastScore = student.totalScore;
                lastRank = rank;
                return { rank, ...student };
            });
        });
    }
    async getGlobal(page = 1, limit = 50) {
        const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
        const safePage = Math.max(Number(page) || 1, 1);
        const from = (safePage - 1) * safeLimit;
        const ranking = await this.buildRanking();
        return {
            data: ranking.slice(from, from + safeLimit),
            total: ranking.length,
            page: safePage,
            limit: safeLimit,
        };
    }
    async assertCanViewBatch(batchId, user) {
        if (user.role === 'teacher' || user.role === 'admin')
            return;
        const { data: membership } = await supabase_config_1.supabase
            .from('batch_students')
            .select('batch_id')
            .eq('batch_id', batchId)
            .eq('student_id', user.id)
            .maybeSingle();
        if (!membership) {
            throw new common_1.ForbiddenException('You are not a member of this batch.');
        }
    }
    async getBatch(batchId) {
        return this.cache.wrap(`${CACHE_PREFIX}batch:${batchId}`, LEADERBOARD_TTL_SECONDS, async () => {
            const batchStudents = await (0, query_util_1.fetchAll)(() => supabase_config_1.supabase
                .from('batch_students')
                .select('student_id')
                .eq('batch_id', batchId));
            const studentIds = new Set(batchStudents.map((b) => b.student_id));
            if (!studentIds.size)
                return [];
            const ranking = await this.buildRanking();
            let lastScore = null;
            let lastRank = 0;
            return ranking
                .filter((s) => studentIds.has(s.id))
                .map((student, idx) => {
                const rank = student.totalScore === lastScore ? lastRank : idx + 1;
                lastScore = student.totalScore;
                lastRank = rank;
                return { ...student, rank };
            });
        });
    }
    async getMyRank(studentId) {
        const ranking = await this.buildRanking();
        const myIdx = ranking.findIndex((s) => s.id === studentId);
        if (myIdx === -1) {
            return { rank: null, totalStudents: ranking.length, neighbors: [] };
        }
        const start = Math.max(0, myIdx - 2);
        const end = Math.min(ranking.length, myIdx + 3);
        return {
            rank: ranking[myIdx].rank,
            totalScore: ranking[myIdx].totalScore,
            totalStudents: ranking.length,
            neighbors: ranking
                .slice(start, end)
                .map((s) => ({ ...s, isMe: s.id === studentId })),
        };
    }
    async invalidate() {
        await this.cache.invalidate(CACHE_PREFIX);
    }
};
exports.LeaderboardService = LeaderboardService;
exports.LeaderboardService = LeaderboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cache_service_1.CacheService])
], LeaderboardService);
//# sourceMappingURL=leaderboard.service.js.map