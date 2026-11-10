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
exports.AnalyticsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const analytics_service_1 = require("./analytics.service");
const spaced_repetition_service_1 = require("./spaced-repetition.service");
const supabase_auth_guard_1 = require("../../common/guards/supabase-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
class RevisionQueryDto {
    limit;
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 20, maximum: 100 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], RevisionQueryDto.prototype, "limit", void 0);
class CohortQueryDto {
    batchId;
}
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CohortQueryDto.prototype, "batchId", void 0);
let AnalyticsController = class AnalyticsController {
    analyticsService;
    srsService;
    constructor(analyticsService, srsService) {
        this.analyticsService = analyticsService;
        this.srsService = srsService;
    }
    getMyAnalytics(user) {
        return this.analyticsService.getStudentAnalytics(user.id);
    }
    getDueQuestions(user, query) {
        return this.srsService.getDueQuestions(user.id, query.limit || 20);
    }
    getCohort(query) {
        return this.analyticsService.getCohortAnalytics(query.batchId);
    }
    getStudentAnalytics(id) {
        return this.analyticsService.getStudentAnalyticsForTeacher(id);
    }
};
exports.AnalyticsController = AnalyticsController;
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: '[Student] Get own analytics — for AnalyticsHub page',
    }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('student'),
    (0, common_1.Get)('me'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getMyAnalytics", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: '[Student] Questions due for spaced-repetition revision',
    }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('student'),
    (0, common_1.Get)('revision-due'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, RevisionQueryDto]),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getDueQuestions", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: '[Teacher] Get cohort overview analytics' }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('teacher', 'admin'),
    (0, common_1.Get)('cohort'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CohortQueryDto]),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getCohort", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: '[Teacher] Get individual student analytics' }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('teacher', 'admin'),
    (0, common_1.Get)('student/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AnalyticsController.prototype, "getStudentAnalytics", null);
exports.AnalyticsController = AnalyticsController = __decorate([
    (0, swagger_1.ApiTags)('Analytics'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(supabase_auth_guard_1.SupabaseAuthGuard),
    (0, common_1.Controller)('api/analytics'),
    __metadata("design:paramtypes", [analytics_service_1.AnalyticsService,
        spaced_repetition_service_1.SpacedRepetitionService])
], AnalyticsController);
//# sourceMappingURL=analytics.controller.js.map