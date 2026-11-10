import { AttemptsService } from './attempts.service';
import { LogViolationDto, SaveAnswerDto, SubmitAttemptDto, ToggleFlagDto } from './dto/attempt.dto';
export declare class AttemptsController {
    private readonly attemptsService;
    constructor(attemptsService: AttemptsService);
    startAttempt(testId: string, user: any): Promise<{
        attemptId: string;
        testId: string;
        resumed: boolean;
        startedAt: string;
        expiresAt: string;
        timeLeftSeconds: number;
        savedAnswers: any[];
    } | {
        attemptId: any;
        testId: string;
        resumed: boolean;
        startedAt: string;
        expiresAt: string;
        timeLeftSeconds: number;
        savedAnswers: never[];
    }>;
    getMyAttempts(user: any): Promise<{
        results_published: boolean;
        total_score: any;
        id: any;
        test_id: any;
        status: any;
        started_at: any;
        submitted_at: any;
        tests: {
            id: any;
            title: any;
            total_marks: any;
            instructions: any;
            description: any;
        }[];
    }[]>;
    saveAnswer(id: string, user: any, body: SaveAnswerDto): any;
    logViolation(id: string, user: any, body: LogViolationDto): Promise<{
        terminated: boolean;
        strikes: number;
        limit: number;
        degraded?: undefined;
    } | {
        terminated: boolean;
        strikes: number;
        limit: number;
        degraded: boolean;
    }>;
    toggleFlag(id: string, user: any, body: ToggleFlagDto): Promise<{
        flagged: boolean;
    }>;
    submit(id: string, user: any, body: SubmitAttemptDto): Promise<{
        attemptId: string;
        testId: string;
        submitted: boolean;
        results_published: boolean;
        autoSubmitted: boolean;
        timeTakenSeconds: number;
        message: string;
        score?: undefined;
        maxScore?: undefined;
        correct?: undefined;
        incorrect?: undefined;
        unattempted?: undefined;
        accuracy?: undefined;
        negativeMarking?: undefined;
        negativeMarks?: undefined;
    } | {
        attemptId: string;
        testId: string;
        results_published: boolean;
        score: number;
        maxScore: any;
        correct: number;
        incorrect: number;
        unattempted: number;
        accuracy: number;
        timeTakenSeconds: number;
        autoSubmitted: boolean;
        negativeMarking: boolean;
        negativeMarks: number;
        submitted?: undefined;
        message?: undefined;
    }>;
    getResult(id: string, user: any): Promise<{
        id: any;
        status: any;
        started_at: any;
        submitted_at: any;
        auto_submitted: any;
        results_published: boolean;
        tests: {
            id: any;
            title: any;
            total_marks: any;
            duration_minutes: any;
            instructions: any;
            description: any;
        }[];
        total_score: null;
        cohort: null;
        answers: never[];
    } | {
        cohort: {
            rank: number;
            totalStudents: number;
            percentile: number;
            average: number;
            highest: number;
        } | null;
        id: any;
        status: any;
        total_score: any;
        started_at: any;
        submitted_at: any;
        auto_submitted: any;
        tests: {
            id: any;
            title: any;
            total_marks: any;
            duration_minutes: any;
            instructions: any;
            description: any;
        }[];
        answers: {
            question_id: any;
            selected_answer: any;
            is_correct: any;
            time_spent_seconds: any;
            flagged_for_doubt: any;
            questions: {
                id: any;
                question_text: any;
                options: any;
                correct_answer: any;
                subject: any;
                topic: any;
                difficulty: any;
                marks: any;
            }[];
        }[];
        results_published?: undefined;
    }>;
}
