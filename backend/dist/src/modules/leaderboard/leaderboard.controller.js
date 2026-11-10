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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaderboardController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const leaderboard_service_1 = require("./leaderboard.service");
const supabase_auth_guard_1 = require("../../common/guards/supabase-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
let LeaderboardController = class LeaderboardController {
    leaderboardService;
    constructor(leaderboardService) {
        this.leaderboardService = leaderboardService;
    }
    getGlobal(page, limit) {
        return this.leaderboardService.getGlobal(page, limit);
    }
    getMyRank(user) {
        return this.leaderboardService.getMyRank(user.id);
    }
    async getBatch(batchId, user) {
        await this.leaderboardService.assertCanViewBatch(batchId, user);
        return this.leaderboardService.getBatch(batchId);
    }
};
exports.LeaderboardController = LeaderboardController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Global all-student leaderboard' }),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", void 0)
], LeaderboardController.prototype, "getGlobal", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Get logged-in student's rank + neighbors" }),
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LeaderboardController.prototype, "getMyRank", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: 'Batch-specific leaderboard (members and staff only)',
    }),
    (0, common_1.Get)('batch/:batchId'),
    __param(0, (0, common_1.Param)('batchId', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LeaderboardController.prototype, "getBatch", null);
exports.LeaderboardController = LeaderboardController = __decorate([
    (0, swagger_1.ApiTags)('Leaderboard'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(supabase_auth_guard_1.SupabaseAuthGuard),
    (0, common_1.Controller)('api/leaderboard'),
    __metadata("design:paramtypes", [leaderboard_service_1.LeaderboardService])
], LeaderboardController);
//# sourceMappingURL=leaderboard.controller.js.map