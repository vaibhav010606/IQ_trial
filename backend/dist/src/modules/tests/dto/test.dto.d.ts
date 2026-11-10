export declare const MAX_QUESTIONS_PER_TEST = 300;
export declare const MAX_BATCHES_PER_ASSIGNMENT = 50;
export declare class CreateTestDto {
    title: string;
    description?: string;
    subject?: string;
    t_type?: string;
    paper_pattern?: string;
    duration_minutes: number;
    negative_marking?: boolean;
    negative_marks?: number;
    instructions?: string;
    teacher_ids?: string[];
    total_marks?: number;
    status?: 'draft' | 'published';
}
declare const UpdateTestDto_base: import("@nestjs/common").Type<Partial<CreateTestDto>>;
export declare class UpdateTestDto extends UpdateTestDto_base {
}
export declare class TestQuestionsDto {
    question_ids: string[];
}
export declare class AssignTeachersDto {
    teacher_ids: string[];
}
export declare class AssignTestDto {
    batch_ids: string[];
    scheduled_start?: string;
    scheduled_end?: string;
}
export declare class SaveFullTestDto extends CreateTestDto {
    question_ids?: string[];
    batch_ids?: string[];
    scheduled_start?: string;
    scheduled_end?: string;
}
export declare class TestListQueryDto {
    status?: string;
    page?: number;
    limit?: number;
}
export declare class PublishResultsDto {
    published?: boolean;
}
export {};
