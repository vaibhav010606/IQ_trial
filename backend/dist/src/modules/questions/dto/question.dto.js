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
exports.PdfUploadDto = exports.ReviewQueueQueryDto = exports.QuestionQueryDto = exports.BulkConfirmDto = exports.MAX_CSV_ROWS = exports.CsvRowDto = exports.BulkIdsDto = exports.MAX_BULK_IDS = exports.ApproveQuestionDto = exports.UpdateQuestionDto = exports.CreateQuestionDto = exports.QUESTION_TYPES = exports.DIFFICULTIES = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.DIFFICULTIES = ['easy', 'medium', 'hard'];
exports.QUESTION_TYPES = [
    'single_correct',
    'multi_correct',
    'numerical',
    'assertion',
    'subjective',
];
const MAX_QUESTION_TEXT = 8000;
const MAX_OPTIONS = 10;
class CreateQuestionDto {
    subject;
    topic;
    subtopic;
    question_text;
    options;
    correct_answer;
    difficulty;
    q_type;
    marks;
    image_url;
}
exports.CreateQuestionDto = CreateQuestionDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateQuestionDto.prototype, "subject", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateQuestionDto.prototype, "topic", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateQuestionDto.prototype, "subtopic", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(MAX_QUESTION_TEXT),
    __metadata("design:type", String)
], CreateQuestionDto.prototype, "question_text", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [String] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(MAX_OPTIONS),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(2000, { each: true }),
    __metadata("design:type", Array)
], CreateQuestionDto.prototype, "options", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'One of { index }, { indices: [...] } or { value }',
    }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateQuestionDto.prototype, "correct_answer", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.DIFFICULTIES }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.DIFFICULTIES),
    __metadata("design:type", String)
], CreateQuestionDto.prototype, "difficulty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.QUESTION_TYPES }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.QUESTION_TYPES),
    __metadata("design:type", String)
], CreateQuestionDto.prototype, "q_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 4 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], CreateQuestionDto.prototype, "marks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], CreateQuestionDto.prototype, "image_url", void 0);
class UpdateQuestionDto extends (0, swagger_1.PartialType)(CreateQuestionDto) {
}
exports.UpdateQuestionDto = UpdateQuestionDto;
class ApproveQuestionDto {
    corrections;
}
exports.ApproveQuestionDto = ApproveQuestionDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: UpdateQuestionDto }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => UpdateQuestionDto),
    __metadata("design:type", UpdateQuestionDto)
], ApproveQuestionDto.prototype, "corrections", void 0);
exports.MAX_BULK_IDS = 500;
class BulkIdsDto {
    ids;
}
exports.BulkIdsDto = BulkIdsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [String], maxItems: exports.MAX_BULK_IDS }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.ArrayMaxSize)(exports.MAX_BULK_IDS),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], BulkIdsDto.prototype, "ids", void 0);
class CsvRowDto extends CreateQuestionDto {
    valid;
    errorMsg;
}
exports.CsvRowDto = CsvRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CsvRowDto.prototype, "valid", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", Object)
], CsvRowDto.prototype, "errorMsg", void 0);
exports.MAX_CSV_ROWS = 2000;
class BulkConfirmDto {
    rows;
}
exports.BulkConfirmDto = BulkConfirmDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [CsvRowDto], maxItems: exports.MAX_CSV_ROWS }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(exports.MAX_CSV_ROWS),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => CsvRowDto),
    __metadata("design:type", Array)
], BulkConfirmDto.prototype, "rows", void 0);
class QuestionQueryDto {
    subject;
    difficulty;
    q_type;
    topic;
    search;
    review_status;
    exclude_subjective;
    page;
    limit;
}
exports.QuestionQueryDto = QuestionQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], QuestionQueryDto.prototype, "subject", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.DIFFICULTIES }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.DIFFICULTIES),
    __metadata("design:type", String)
], QuestionQueryDto.prototype, "difficulty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: exports.QUESTION_TYPES }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.QUESTION_TYPES),
    __metadata("design:type", String)
], QuestionQueryDto.prototype, "q_type", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], QuestionQueryDto.prototype, "topic", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], QuestionQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['pending', 'approved', 'rejected', 'all'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['pending', 'approved', 'rejected', 'all']),
    __metadata("design:type", String)
], QuestionQueryDto.prototype, "review_status", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QuestionQueryDto.prototype, "exclude_subjective", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], QuestionQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 20, maximum: 200 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], QuestionQueryDto.prototype, "limit", void 0);
class ReviewQueueQueryDto {
    subject;
    exclude_subjective;
    page;
    limit;
}
exports.ReviewQueueQueryDto = ReviewQueueQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], ReviewQueueQueryDto.prototype, "subject", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReviewQueueQueryDto.prototype, "exclude_subjective", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ReviewQueueQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 20, maximum: 200 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], ReviewQueueQueryDto.prototype, "limit", void 0);
class PdfUploadDto {
    examType;
}
exports.PdfUploadDto = PdfUploadDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['jee', 'neet', 'cbse', 'general'],
        default: 'jee',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['jee', 'neet', 'cbse', 'general']),
    __metadata("design:type", String)
], PdfUploadDto.prototype, "examType", void 0);
//# sourceMappingURL=question.dto.js.map