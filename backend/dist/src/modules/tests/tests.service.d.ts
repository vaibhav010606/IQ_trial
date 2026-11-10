import { CacheService } from '../../common/cache/cache.service';
import { AssignTestDto, CreateTestDto, SaveFullTestDto, UpdateTestDto } from './dto/test.dto';
export interface Requester {
    id: string;
    role?: string;
    subject?: string;
}
export declare function isTestResultsPublished(test: any): boolean;
export declare function releasedTestIds(testIds: string[]): Promise<Set<string>>;
export declare function stripInternalTags(text?: string): string;
export declare class TestsService {
    private readonly cache?;
    private readonly logger;
    private hasPaperPattern;
    constructor(cache?: CacheService | undefined);
    private loadForAccess;
    private assertCanAdminister;
    private assertCanContribute;
    private assertStudentMaySit;
    private pickWritable;
    private resolveTypeAndPattern;
    private insertTest;
    private isMissingColumn;
    private paperPatternAvailable;
    private withPattern;
    isTestResultsPublished(test: any): boolean;
    stripInternalTags(text?: string): string;
    private attachInferredPattern;
    findAll(user: Requester, filters?: {
        status?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    findOne(id: string, user: Requester): Promise<any>;
    create(body: CreateTestDto, user: Requester): Promise<any>;
    assignTeachers(testId: string, teacherIds: string[]): Promise<{
        id: any;
        title: any;
        test_teachers: {
            teacher_id: any;
            users: {
                id: any;
                full_name: any;
                email: any;
            }[];
        }[];
    }>;
    update(id: string, body: UpdateTestDto, user: Requester): Promise<any>;
    remove(id: string, user: Requester): Promise<{
        message: string;
    }>;
    addQuestions(testId: string, questionIds: string[], user: Requester): Promise<{
        message: string;
        total_marks: number;
    }>;
    private assertQuestionsUsable;
    private paperRows;
    private patternOfTest;
    private assertMatchesPattern;
    private recalculateTotalMarks;
    publish(id: string, user: Requester): Promise<any>;
    assign(testId: string, body: AssignTestDto, user: Requester): Promise<{
        message: string;
    }>;
    private buildAssignments;
    private replaceAssignments;
    private assertWindowSane;
    getStudentTests(studentId: string): Promise<any[]>;
    getTestQuestionsForStudent(testId: string, studentId: string): Promise<any[]>;
    getResults(testId: string, user: Requester): Promise<{
        test: {
            results_published: boolean;
            instructions: string;
            id: any;
            title: any;
            total_marks: any;
            duration_minutes: any;
            description: any;
        };
        results_published: boolean;
        summary: {
            submitted: number;
            assigned: number;
            notAttempted: number;
            maxMarks: number;
            highest: number;
            lowest: number;
            average: number;
            median: number;
            autoSubmitted: number;
        };
        results: any[];
        questionStats: any[];
    }>;
    setResultsPublished(testId: string, published: boolean, user: Requester): Promise<{
        success: boolean;
        testId: string;
        results_published: boolean;
    }>;
    private buildQuestionStats;
    saveFullTest(body: SaveFullTestDto, user: Requester): Promise<any>;
}
