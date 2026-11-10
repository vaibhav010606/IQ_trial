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
exports.SubmitAttemptDto = exports.LogViolationDto = exports.ToggleFlagDto = exports.SaveAnswerDto = exports.ANSWER_STATUSES = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.ANSWER_STATUSES = [
    'not_visited',
    'not_answered',
    'answered',
    'marked',
    'answered_marked',
];
class SaveAnswerDto {
    question_id;
    selected_answer;
    status;
    time_spent_seconds;
}
exports.SaveAnswerDto = SaveAnswerDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SaveAnswerDto.prototype, "question_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'One of { index }, { indices: [...] } or { value }',
    }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], SaveAnswerDto.prototype, "selected_answer", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.ANSWER_STATUSES }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.ANSWER_STATUSES),
    __metadata("design:type", String)
], SaveAnswerDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 0 }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(86_400),
    __metadata("design:type", Number)
], SaveAnswerDto.prototype, "time_spent_seconds", void 0);
class ToggleFlagDto {
    question_id;
    flagged;
}
exports.ToggleFlagDto = ToggleFlagDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ToggleFlagDto.prototype, "question_id", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ToggleFlagDto.prototype, "flagged", void 0);
class LogViolationDto {
    type;
    detail;
}
exports.LogViolationDto = LogViolationDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], LogViolationDto.prototype, "type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], LogViolationDto.prototype, "detail", void 0);
class SubmitAttemptDto {
    autoSubmitted;
}
exports.SubmitAttemptDto = SubmitAttemptDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SubmitAttemptDto.prototype, "autoSubmitted", void 0);
//# sourceMappingURL=attempt.dto.js.map