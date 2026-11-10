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
exports.AdminUserListQueryDto = exports.StudentListQueryDto = exports.UserListQueryDto = exports.AdminResetPasswordDto = exports.AdminCreateUserDto = exports.ChangePasswordDto = exports.UpdateProfileDto = exports.MIN_PASSWORD_LENGTH = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
exports.MIN_PASSWORD_LENGTH = 10;
const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const PWD_COMPLEXITY_MSG = 'Password must be at least 10 characters and include an uppercase letter, a lowercase letter and a digit.';
class UpdateProfileDto {
    full_name;
}
exports.UpdateProfileDto = UpdateProfileDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateProfileDto.prototype, "full_name", void 0);
class ChangePasswordDto {
    currentPassword;
    newPassword;
}
exports.ChangePasswordDto = ChangePasswordDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Your existing password. Required.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1, { message: 'Your current password is required.' }),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "currentPassword", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(exports.MIN_PASSWORD_LENGTH, { message: PWD_COMPLEXITY_MSG }),
    (0, class_validator_1.MaxLength)(128),
    (0, class_validator_1.Matches)(PASSWORD_RULE, { message: PWD_COMPLEXITY_MSG }),
    __metadata("design:type", String)
], ChangePasswordDto.prototype, "newPassword", void 0);
class AdminCreateUserDto {
    full_name;
    email;
    password;
    role;
    subject;
}
exports.AdminCreateUserDto = AdminCreateUserDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AdminCreateUserDto.prototype, "full_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsEmail)({}, { message: 'Please provide a valid email address' }),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], AdminCreateUserDto.prototype, "email", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(exports.MIN_PASSWORD_LENGTH, { message: PWD_COMPLEXITY_MSG }),
    (0, class_validator_1.MaxLength)(128),
    (0, class_validator_1.Matches)(PASSWORD_RULE, { message: PWD_COMPLEXITY_MSG }),
    __metadata("design:type", String)
], AdminCreateUserDto.prototype, "password", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['student', 'teacher'] }),
    (0, class_validator_1.IsIn)(['student', 'teacher'], { message: 'Role must be student or teacher.' }),
    __metadata("design:type", String)
], AdminCreateUserDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Subject a teacher is scoped to; "All" for unrestricted.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], AdminCreateUserDto.prototype, "subject", void 0);
class AdminResetPasswordDto {
    newPassword;
}
exports.AdminResetPasswordDto = AdminResetPasswordDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(exports.MIN_PASSWORD_LENGTH, { message: PWD_COMPLEXITY_MSG }),
    (0, class_validator_1.MaxLength)(128),
    (0, class_validator_1.Matches)(PASSWORD_RULE, { message: PWD_COMPLEXITY_MSG }),
    __metadata("design:type", String)
], AdminResetPasswordDto.prototype, "newPassword", void 0);
class UserListQueryDto {
    search;
    page;
    limit;
}
exports.UserListQueryDto = UserListQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UserListQueryDto.prototype, "search", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UserListQueryDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 50, maximum: 200 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    __metadata("design:type", Number)
], UserListQueryDto.prototype, "limit", void 0);
class StudentListQueryDto extends UserListQueryDto {
    batchId;
}
exports.StudentListQueryDto = StudentListQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], StudentListQueryDto.prototype, "batchId", void 0);
class AdminUserListQueryDto extends UserListQueryDto {
    role;
}
exports.AdminUserListQueryDto = AdminUserListQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['student', 'teacher', 'admin', 'all'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['student', 'teacher', 'admin', 'all']),
    __metadata("design:type", String)
], AdminUserListQueryDto.prototype, "role", void 0);
//# sourceMappingURL=user.dto.js.map