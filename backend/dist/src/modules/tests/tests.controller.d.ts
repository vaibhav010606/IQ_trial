import { TestsService } from './tests.service';
import { AssignTeachersDto, AssignTestDto, CreateTestDto, SaveFullTestDto, PublishResultsDto, TestListQueryDto, TestQuestionsDto, UpdateTestDto } from './dto/test.dto';
export declare class TestsController {
    private readonly testsService;
    constructor(testsService: TestsService);
    saveFullTest(body: SaveFullTestDto, user: any): Promise<any>;
    findAll(user: any, query: TestListQueryDto): Promise<{
        data: any[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    create(body: CreateTestDto, user: any): Promise<any>;
    getStudentTests(user: any): Promise<any[]>;
    publish(id: string, user: any): Promise<any>;
    publishResults(id: string, body: PublishResultsDto, user: any): Promise<{
        success: boolean;
        testId: string;
        results_published: boolean;
    }>;
    addQuestions(id: string, body: TestQuestionsDto, user: any): Promise<{
        message: string;
        total_marks: number;
    }>;
    assignTeachers(id: string, body: AssignTeachersDto): Promise<{
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
    assign(id: string, body: AssignTestDto, user: any): Promise<{
        message: string;
    }>;
    getResults(id: string, user: any): Promise<{
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
    getQuestionsForStudent(id: string, user: any): Promise<any[]>;
    update(id: string, body: UpdateTestDto, user: any): Promise<any>;
    remove(id: string, user: any): Promise<{
        message: string;
    }>;
    findOne(id: string, user: any): Promise<any>;
}
