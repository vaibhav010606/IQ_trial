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
exports.QuestionsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const questions_service_1 = require("./questions.service");
const pdf_processor_service_1 = require("./pdf-processor.service");
const supabase_auth_guard_1 = require("../../common/guards/supabase-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const question_dto_1 = require("./dto/question.dto");
const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const CSV_MIME = [
    'text/csv',
    'application/vnd.ms-excel',
    'text/plain',
    'application/csv',
];
const PDF_MIME = ['application/pdf'];
const mimeFilter = (allowed, label) => (_req, file, cb) => {
    if (!allowed.includes(file.mimetype)) {
        return cb(new common_1.BadRequestException(`Expected ${label}.`), false);
    }
    cb(null, true);
};
let QuestionsController = class QuestionsController {
    questionsService;
    pdfProcessorService;
    constructor(questionsService, pdfProcessorService) {
        this.questionsService = questionsService;
        this.pdfProcessorService = pdfProcessorService;
    }
    findAll(user, query) {
        return this.questionsService.findAll(query, user);
    }
    getReviewQueue(user, query) {
        return this.questionsService.getReviewQueue(query, user);
    }
    create(body, user) {
        return this.questionsService.create(body, user);
    }
    bulkApprove(body, user) {
        return this.questionsService.bulkApprove(body.ids, user);
    }
    bulkDelete(body, user) {
        return this.questionsService.bulkRemove(body.ids, user);
    }
    bulkUpload(file) {
        if (!file?.buffer?.length)
            throw new common_1.BadRequestException('No CSV file provided.');
        return this.questionsService.parseCSV(file.buffer, question_dto_1.MAX_CSV_ROWS);
    }
    bulkConfirm(body, user) {
        return this.questionsService.bulkInsert(body.rows, user);
    }
    bulkUploadPdf(file, body, user) {
        if (!file?.buffer?.length)
            throw new common_1.BadRequestException('No PDF file provided.');
        return this.pdfProcessorService.processPdf(file.buffer, user.id, body.examType || 'jee');
    }
    deleteImageQuestions(user) {
        return this.questionsService.deleteImageQuestions(user);
    }
    findOne(id, user) {
        return this.questionsService.findOne(id, user);
    }
    update(id, body, user) {
        return this.questionsService.update(id, body, user);
    }
    remove(id, user) {
        return this.questionsService.remove(id, user);
    }
    duplicate(id, user) {
        return this.questionsService.duplicate(id, user);
    }
    approve(id, body, user) {
        return this.questionsService.approve(id, user, body?.corrections);
    }
    reject(id, user) {
        return this.questionsService.reject(id, user);
    }
};
exports.QuestionsController = QuestionsController;
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: 'List all questions with filters (server-side pagination)',
    }),
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, question_dto_1.QuestionQueryDto]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "findAll", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: 'QA queue — AI-extracted questions awaiting verification',
    }),
    (0, common_1.Get)('review-queue'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, question_dto_1.ReviewQueueQueryDto]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "getReviewQueue", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Create one question manually' }),
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [question_dto_1.CreateQuestionDto, Object]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Approve many questions at once' }),
    (0, common_1.Post)('bulk-approve'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [question_dto_1.BulkIdsDto, Object]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "bulkApprove", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Soft-delete many questions at once' }),
    (0, common_1.Post)('bulk-delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [question_dto_1.BulkIdsDto, Object]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "bulkDelete", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Upload CSV and get a preview (does not save yet)' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.Post)('bulk-upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: { fileSize: MAX_CSV_BYTES, files: 1 },
        fileFilter: mimeFilter(CSV_MIME, 'a CSV file'),
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "bulkUpload", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Confirm CSV preview — saves valid rows to DB' }),
    (0, common_1.Post)('bulk-confirm'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [question_dto_1.BulkConfirmDto, Object]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "bulkConfirm", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: 'Upload PDF to extract and classify image questions',
    }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.Post)('bulk-upload-pdf'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        limits: { fileSize: MAX_PDF_BYTES, files: 1 },
        fileFilter: mimeFilter(PDF_MIME, 'a PDF file'),
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, question_dto_1.PdfUploadDto, Object]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "bulkUploadPdf", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: 'Soft-delete ALL image-based questions (admin only)',
        description: 'Removes every active question that has an image_url set. ' +
            'These are questions whose content was extracted from a PDF as an image. ' +
            'The deletion is a soft-delete (is_active = false) so the records are retained for auditing.',
    }),
    (0, roles_decorator_1.Roles)('admin'),
    (0, common_1.Delete)('image-questions'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "deleteImageQuestions", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get one question by ID' }),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "findOne", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Edit a question' }),
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, question_dto_1.UpdateQuestionDto, Object]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "update", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Delete a question (soft delete)' }),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "remove", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Duplicate a question' }),
    (0, common_1.Post)(':id/duplicate'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "duplicate", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: 'Approve a question from the QA queue (optionally with corrections)',
    }),
    (0, common_1.Patch)(':id/approve'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, question_dto_1.ApproveQuestionDto, Object]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "approve", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Reject a question from the QA queue' }),
    (0, common_1.Patch)(':id/reject'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], QuestionsController.prototype, "reject", null);
exports.QuestionsController = QuestionsController = __decorate([
    (0, swagger_1.ApiTags)('Questions'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(supabase_auth_guard_1.SupabaseAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('teacher', 'admin'),
    (0, common_1.Controller)('api/questions'),
    __metadata("design:paramtypes", [questions_service_1.QuestionsService,
        pdf_processor_service_1.PdfProcessorService])
], QuestionsController);
//# sourceMappingURL=questions.controller.js.map