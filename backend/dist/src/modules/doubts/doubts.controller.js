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
exports.DoubtsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const platform_express_1 = require("@nestjs/platform-express");
const doubts_service_1 = require("./doubts.service");
const doubts_gateway_1 = require("./doubts.gateway");
const supabase_auth_guard_1 = require("../../common/guards/supabase-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const doubt_dto_1 = require("./dto/doubt.dto");
const ALLOWED_UPLOAD_MIME = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
];
let DoubtsController = class DoubtsController {
    doubtsService;
    doubtsGateway;
    constructor(doubtsService, doubtsGateway) {
        this.doubtsService = doubtsService;
        this.doubtsGateway = doubtsGateway;
    }
    create(user, body) {
        return this.doubtsService.create(user.id, body);
    }
    getMyDoubts(user, query) {
        return this.doubtsService.getMyDoubts(user.id, query.page, query.limit);
    }
    findAll(user, query) {
        return this.doubtsService.findAll(user, query.status, query.page, query.limit);
    }
    findOne(id, user) {
        return this.doubtsService.findOne(id, user);
    }
    async accept(id, user) {
        const doubt = await this.doubtsService.accept(id, user);
        this.doubtsGateway.notifyStatusChange(id, 'accepted');
        return doubt;
    }
    async resolve(id, user) {
        const doubt = await this.doubtsService.resolve(id, user);
        this.doubtsGateway.notifyStatusChange(id, 'resolved');
        return doubt;
    }
    getMessages(id, user) {
        return this.doubtsService.getMessages(id, user);
    }
    sendMessage(id, user, body) {
        return this.doubtsService.sendMessage(id, user, body.message_text);
    }
    async uploadImage(id, user, file) {
        const result = await this.doubtsService.uploadImage(id, user, file);
        const { imageUrl, ...message } = result;
        this.doubtsGateway.broadcastMessage(id, message, {
            id: user.id,
            full_name: user.full_name,
            role: user.role,
        });
        return result;
    }
    remove(id, user) {
        return this.doubtsService.remove(id, user);
    }
};
exports.DoubtsController = DoubtsController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: '[Student] Submit a new doubt' }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('student'),
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, doubt_dto_1.CreateDoubtDto]),
    __metadata("design:returntype", void 0)
], DoubtsController.prototype, "create", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: '[Student] Get own doubts history' }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('student'),
    (0, common_1.Get)('my'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, doubt_dto_1.DoubtHistoryQueryDto]),
    __metadata("design:returntype", void 0)
], DoubtsController.prototype, "getMyDoubts", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: '[Teacher] Get doubts queue (unclaimed + own)' }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('teacher', 'admin'),
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, doubt_dto_1.DoubtQueueQueryDto]),
    __metadata("design:returntype", void 0)
], DoubtsController.prototype, "findAll", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get one doubt details (participants only)' }),
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DoubtsController.prototype, "findOne", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: '[Teacher] Accept a doubt (take ownership)' }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('teacher', 'admin'),
    (0, common_1.Patch)(':id/accept'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DoubtsController.prototype, "accept", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: '[Teacher] Mark doubt as resolved' }),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('teacher', 'admin'),
    (0, common_1.Patch)(':id/resolve'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], DoubtsController.prototype, "resolve", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: 'Get chat messages for a doubt (participants only)',
    }),
    (0, common_1.Get)(':id/messages'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DoubtsController.prototype, "getMessages", null);
__decorate([
    (0, swagger_1.ApiOperation)({
        summary: 'Send a message (REST fallback when Socket.IO not available)',
    }),
    (0, common_1.Post)(':id/messages'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, doubt_dto_1.SendMessageDto]),
    __metadata("design:returntype", void 0)
], DoubtsController.prototype, "sendMessage", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Upload an image to a doubt chat' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.Post)(':id/upload-image'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('image', {
        limits: { fileSize: 5 * 1024 * 1024, files: 1 },
        fileFilter: (_req, file, cb) => {
            if (!ALLOWED_UPLOAD_MIME.includes(file.mimetype)) {
                return cb(new common_1.BadRequestException('Only JPG, PNG, GIF and WEBP images are supported.'), false);
            }
            cb(null, true);
        },
    })),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], DoubtsController.prototype, "uploadImage", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Delete a doubt' }),
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], DoubtsController.prototype, "remove", null);
exports.DoubtsController = DoubtsController = __decorate([
    (0, swagger_1.ApiTags)('Doubts'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(supabase_auth_guard_1.SupabaseAuthGuard),
    (0, common_1.Controller)('api/doubts'),
    __metadata("design:paramtypes", [doubts_service_1.DoubtsService,
        doubts_gateway_1.DoubtsGateway])
], DoubtsController);
//# sourceMappingURL=doubts.controller.js.map