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
exports.AttemptsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const attempts_service_1 = require("./attempts.service");
const supabase_auth_guard_1 = require("../../common/guards/supabase-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const attempt_dto_1 = require("./dto/attempt.dto");
let AttemptsController = class AttemptsController {
    attemptsService;
    constructor(attemptsService) {
        this.attemptsService = attemptsService;
    }
    startAttempt(testId, user) {
        return this.attemptsService.startAttempt(testId, user.id);
    }
    getMyAttempts(user) {
        return this.attemptsService.getMyAttempts(user.id);
    }
    saveAnswer(id, user, body) {
        return this.attemptsService.saveAnswer(id, user.id, body);
    }
    logViolation(id, user, body) {
        return this.attemptsService.logViolation(id, user.id, body);
    }
    toggleFlag(id, user, body) {
        return this.attemptsService.toggleFlag(id, user.id, body.question_id, body.flagged);
    }
    submit(id, user, body) {
        return this.attemptsService.submitAttempt(id, user.id, body.autoSubmitted);
    }
    getResult(id, user) {
        return this.attemptsService.getAttemptResult(id, user.id);
    }
};
exports.AttemptsController = AttemptsController;
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: 'Start a test attempt (or resume if already started)',
    }),
    (0, common_1.Post)('start/:testId'),
    __param(0, (0, common_1.Param)('testId', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AttemptsController.prototype, "startAttempt", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: "Get all of student's past attempts" }),
    (0, common_1.Get)('my'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AttemptsController.prototype, "getMyAttempts", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Save/update one answer during the exam' }),
    (0, common_1.Patch)(':id/answer'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, attempt_dto_1.SaveAnswerDto]),
    __metadata("design:returntype", void 0)
], AttemptsController.prototype, "saveAnswer", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: 'Record a proctoring violation — terminates the attempt on the 3rd',
    }),
    (0, common_1.Post)(':id/violation'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, attempt_dto_1.LogViolationDto]),
    __metadata("design:returntype", void 0)
], AttemptsController.prototype, "logViolation", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Toggle flag a question for doubt review' }),
    (0, common_1.Patch)(':id/flag'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, attempt_dto_1.ToggleFlagDto]),
    __metadata("design:returntype", void 0)
], AttemptsController.prototype, "toggleFlag", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Submit the exam — backend calculates score' }),
    (0, common_1.Post)(':id/submit'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, attempt_dto_1.SubmitAttemptDto]),
    __metadata("design:returntype", void 0)
], AttemptsController.prototype, "submit", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: 'Get result of a specific attempt (for PostTestResult page)',
    }),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AttemptsController.prototype, "getResult", null);
exports.AttemptsController = AttemptsController = __decorate([
    (0, swagger_1.ApiTags)('Attempts'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(supabase_auth_guard_1.SupabaseAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('student'),
    (0, common_1.Controller)('api/attempts'),
    __metadata("design:paramtypes", [attempts_service_1.AttemptsService])
], AttemptsController);
//# sourceMappingURL=attempts.controller.js.map