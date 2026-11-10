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
exports.TestsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const tests_service_1 = require("./tests.service");
const supabase_auth_guard_1 = require("../../common/guards/supabase-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const test_dto_1 = require("./dto/test.dto");
let TestsController = class TestsController {
    testsService;
    constructor(testsService) {
        this.testsService = testsService;
    }
    saveFullTest(body, user) {
        return this.testsService.saveFullTest(body, user);
    }
    findAll(user, query) {
        return this.testsService.findAll(user, query);
    }
    create(body, user) {
        return this.testsService.create(body, user);
    }
    getStudentTests(user) {
        return this.testsService.getStudentTests(user.id);
    }
    publish(id, user) {
        return this.testsService.publish(id, user);
    }
    publishResults(id, body, user) {
        return this.testsService.setResultsPublished(id, body?.published !== false, user);
    }
    addQuestions(id, body, user) {
        return this.testsService.addQuestions(id, body.question_ids, user);
    }
    assignTeachers(id, body) {
        return this.testsService.assignTeachers(id, body.teacher_ids ?? []);
    }
    assign(id, body, user) {
        return this.testsService.assign(id, body, user);
    }
    getResults(id, user) {
        return this.testsService.getResults(id, user);
    }
    getQuestionsForStudent(id, user) {
        return this.testsService.getTestQuestionsForStudent(id, user.id);
    }
    update(id, body, user) {
        return this.testsService.update(id, body, user);
    }
    remove(id, user) {
        return this.testsService.remove(id, user);
    }
    findOne(id, user) {
        return this.testsService.findOne(id, user);
    }
};
exports.TestsController = TestsController;
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: '[Admin] Create a full test (Metadata + Questions + Assignment)',
    }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Post)('constructor'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [test_dto_1.SaveFullTestDto, Object]),
    __metadata("design:returntype", void 0)
], TestsController.prototype, "saveFullTest", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: '[Teacher] List all tests' }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('teacher', 'admin'),
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, test_dto_1.TestListQueryDto]),
    __metadata("design:returntype", void 0)
], TestsController.prototype, "findAll", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: '[Admin] Create a new test shell' }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [test_dto_1.CreateTestDto, Object]),
    __metadata("design:returntype", void 0)
], TestsController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: '[Student] Get tests assigned to this student' }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('student'),
    (0, common_1.Get)('available'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TestsController.prototype, "getStudentTests", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: '[Teacher] Publish a draft test' }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('teacher', 'admin'),
    (0, common_1.Patch)(':id/publish'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TestsController.prototype, "publish", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: '[Admin] Approve and release (or withhold) test results for students',
    }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Patch)(':id/publish-results'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, test_dto_1.PublishResultsDto, Object]),
    __metadata("design:returntype", void 0)
], TestsController.prototype, "publishResults", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: '[Teacher] Add/replace questions on a test you own or are assigned',
    }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('teacher', 'admin'),
    (0, common_1.Post)(':id/questions'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, test_dto_1.TestQuestionsDto, Object]),
    __metadata("design:returntype", void 0)
], TestsController.prototype, "addQuestions", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: '[Admin] Assign teachers (multi) to fill questions for this test',
    }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Patch)(':id/assign-teacher'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, test_dto_1.AssignTeachersDto]),
    __metadata("design:returntype", void 0)
], TestsController.prototype, "assignTeachers", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: '[Teacher] Assign test to batches with schedule' }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('teacher', 'admin'),
    (0, common_1.Post)(':id/assign'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, test_dto_1.AssignTestDto, Object]),
    __metadata("design:returntype", void 0)
], TestsController.prototype, "assign", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: '[Teacher] Get all student results for a test' }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('teacher', 'admin'),
    (0, common_1.Get)(':id/results'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TestsController.prototype, "getResults", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: '[Student] Get test questions (no correct answers)',
    }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('student'),
    (0, common_1.Get)(':id/questions'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TestsController.prototype, "getQuestionsForStudent", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: '[Teacher] Update test metadata' }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('teacher', 'admin'),
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, test_dto_1.UpdateTestDto, Object]),
    __metadata("design:returntype", void 0)
], TestsController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: '[Teacher] Delete a test' }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('teacher', 'admin'),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TestsController.prototype, "remove", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get test details' }),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TestsController.prototype, "findOne", null);
exports.TestsController = TestsController = __decorate([
    (0, swagger_1.ApiTags)('Tests'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(supabase_auth_guard_1.SupabaseAuthGuard),
    (0, common_1.Controller)('api/tests'),
    __metadata("design:paramtypes", [tests_service_1.TestsService])
], TestsController);
//# sourceMappingURL=tests.controller.js.map