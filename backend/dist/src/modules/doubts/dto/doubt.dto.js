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
exports.DoubtQueueQueryDto = exports.SendMessageDto = exports.CreateDoubtDto = exports.MAX_MESSAGE_LENGTH = exports.DoubtHistoryQueryDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class DoubtHistoryQueryDto {
    page;
    limit;
}
exports.DoubtHistoryQueryDto = DoubtHistoryQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], DoubtHistoryQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 50, maximum: 200 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], DoubtHistoryQueryDto.prototype, "limit", void 0);
exports.MAX_MESSAGE_LENGTH = 4000;
class CreateDoubtDto {
    question_id;
    attempt_id;
    snippet;
    teacher_id;
}
exports.CreateDoubtDto = CreateDoubtDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Question the doubt refers to' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateDoubtDto.prototype, "question_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Attempt the doubt was raised from (must belong to the student)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateDoubtDto.prototype, "attempt_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Short text snippet describing the doubt',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateDoubtDto.prototype, "snippet", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Teacher to assign the doubt to; omit to queue it as pending',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateDoubtDto.prototype, "teacher_id", void 0);
class SendMessageDto {
    message_text;
}
exports.SendMessageDto = SendMessageDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: exports.MAX_MESSAGE_LENGTH }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, exports.MAX_MESSAGE_LENGTH),
    __metadata("design:type", String)
], SendMessageDto.prototype, "message_text", void 0);
class DoubtQueueQueryDto {
    status;
    page;
    limit;
}
exports.DoubtQueueQueryDto = DoubtQueueQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['pending', 'accepted', 'resolved'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['pending', 'accepted', 'resolved']),
    __metadata("design:type", String)
], DoubtQueueQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], DoubtQueueQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 50, maximum: 200 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], DoubtQueueQueryDto.prototype, "limit", void 0);
//# sourceMappingURL=doubt.dto.js.map