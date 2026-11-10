"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const cache_module_1 = require("./common/cache/cache.module");
const health_controller_1 = require("./common/health/health.controller");
const redis_throttler_storage_1 = require("./common/throttler/redis-throttler.storage");
const user_throttler_guard_1 = require("./common/throttler/user-throttler.guard");
const auth_module_1 = require("./modules/auth/auth.module");
const users_module_1 = require("./modules/users/users.module");
const batches_module_1 = require("./modules/batches/batches.module");
const questions_module_1 = require("./modules/questions/questions.module");
const tests_module_1 = require("./modules/tests/tests.module");
const attempts_module_1 = require("./modules/attempts/attempts.module");
const doubts_module_1 = require("./modules/doubts/doubts.module");
const lectures_module_1 = require("./modules/lectures/lectures.module");
const analytics_module_1 = require("./modules/analytics/analytics.module");
const leaderboard_module_1 = require("./modules/leaderboard/leaderboard.module");
const DEFAULT_THROTTLE_TTL_MS = 60_000;
const DEFAULT_THROTTLE_LIMIT = Number(process.env.THROTTLE_LIMIT) || 300;
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            throttler_1.ThrottlerModule.forRoot({
                throttlers: [
                    { ttl: DEFAULT_THROTTLE_TTL_MS, limit: DEFAULT_THROTTLE_LIMIT },
                ],
            }),
            cache_module_1.CacheModule,
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            batches_module_1.BatchesModule,
            questions_module_1.QuestionsModule,
            tests_module_1.TestsModule,
            attempts_module_1.AttemptsModule,
            doubts_module_1.DoubtsModule,
            lectures_module_1.LecturesModule,
            analytics_module_1.AnalyticsModule,
            leaderboard_module_1.LeaderboardModule,
        ],
        controllers: [health_controller_1.HealthController],
        providers: [
            { provide: core_1.APP_GUARD, useClass: user_throttler_guard_1.UserThrottlerGuard },
            { provide: throttler_1.ThrottlerStorage, useClass: redis_throttler_storage_1.RedisThrottlerStorage },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map