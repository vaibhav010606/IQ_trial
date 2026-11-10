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
exports.PublishResultsDto = exports.TestListQueryDto = exports.SaveFullTestDto = exports.AssignTestDto = exports.AssignTeachersDto = exports.TestQuestionsDto = exports.UpdateTestDto = exports.CreateTestDto = exports.MAX_BATCHES_PER_ASSIGNMENT = exports.MAX_QUESTIONS_PER_TEST = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.MAX_QUESTIONS_PER_TEST = 300;
exports.MAX_BATCHES_PER_ASSIGNMENT = 50;
class CreateTestDto {
    title;
    description;
    subject;
    t_type;
    paper_pattern;
    duration_minutes;
    negative_marking;
    negative_marks;
    instructions;
    teacher_ids;
    total_marks;
    status;
}
exports.CreateTestDto = CreateTestDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateTestDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreateTestDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateTestDto.prototype, "subject", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'jee_main',
        description: 'quiz | mock_test | assignment | exam, or a pattern: jee_main | jee_advanced | neet | custom',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreateTestDto.prototype, "t_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['jee_main', 'jee_advanced', 'neet', 'custom'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['jee_main', 'jee_advanced', 'jee_advanced_p2', 'neet', 'custom']),
    __metadata("design:type", String)
], CreateTestDto.prototype, "paper_pattern", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, maximum: 600 }),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(600),
    __metadata("design:type", Number)
], CreateTestDto.prototype, "duration_minutes", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateTestDto.prototype, "negative_marking", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ minimum: 0, maximum: 10 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(10),
    __metadata("design:type", Number)
], CreateTestDto.prototype, "negative_marks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(5000),
    __metadata("design:type", String)
], CreateTestDto.prototype, "instructions", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], CreateTestDto.prototype, "teacher_ids", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Ignored — derived from the linked questions.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateTestDto.prototype, "total_marks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['draft', 'published'], default: 'draft' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['draft', 'published']),
    __metadata("design:type", String)
], CreateTestDto.prototype, "status", void 0);
class UpdateTestDto extends (0, swagger_1.PartialType)(CreateTestDto) {
}
exports.UpdateTestDto = UpdateTestDto;
class TestQuestionsDto {
    question_ids;
}
exports.TestQuestionsDto = TestQuestionsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], maxItems: exports.MAX_QUESTIONS_PER_TEST }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(exports.MAX_QUESTIONS_PER_TEST),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], TestQuestionsDto.prototype, "question_ids", void 0);
class AssignTeachersDto {
    teacher_ids;
}
exports.AssignTeachersDto = AssignTeachersDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], AssignTeachersDto.prototype, "teacher_ids", void 0);
class AssignTestDto {
    batch_ids;
    scheduled_start;
    scheduled_end;
}
exports.AssignTestDto = AssignTestDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], maxItems: exports.MAX_BATCHES_PER_ASSIGNMENT }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(exports.MAX_BATCHES_PER_ASSIGNMENT),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], AssignTestDto.prototype, "batch_ids", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'ISO timestamp the exam opens' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], AssignTestDto.prototype, "scheduled_start", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'ISO timestamp the exam closes' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], AssignTestDto.prototype, "scheduled_end", void 0);
class SaveFullTestDto extends CreateTestDto {
    question_ids;
    batch_ids;
    scheduled_start;
    scheduled_end;
}
exports.SaveFullTestDto = SaveFullTestDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], maxItems: exports.MAX_QUESTIONS_PER_TEST }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(exports.MAX_QUESTIONS_PER_TEST),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], SaveFullTestDto.prototype, "question_ids", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String], maxItems: exports.MAX_BATCHES_PER_ASSIGNMENT }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(exports.MAX_BATCHES_PER_ASSIGNMENT),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], SaveFullTestDto.prototype, "batch_ids", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], SaveFullTestDto.prototype, "scheduled_start", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsISO8601)(),
    __metadata("design:type", String)
], SaveFullTestDto.prototype, "scheduled_end", void 0);
class TestListQueryDto {
    status;
    page;
    limit;
}
exports.TestListQueryDto = TestListQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['draft', 'published', 'archived'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['draft', 'published', 'archived']),
    __metadata("design:type", String)
], TestListQueryDto.prototype, "status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], TestListQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 50, maximum: 200 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], TestListQueryDto.prototype, "limit", void 0);
class PublishResultsDto {
    published;
}
exports.PublishResultsDto = PublishResultsDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'Whether results are visible to students',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PublishResultsDto.prototype, "published", void 0);
//# sourceMappingURL=test.dto.js.map