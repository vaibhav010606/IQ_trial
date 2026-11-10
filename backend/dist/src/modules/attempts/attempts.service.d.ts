import { SpacedRepetitionService } from '../analytics/spaced-repetition.service';
import { CacheService } from '../../common/cache/cache.service';
export declare class AttemptsService {
    private readonly srsService;
    private readonly cache;
    private readonly logger;
    private hasAnswerStatus;
    private hasViolationsTable;
    constructor(srsService: SpacedRepetitionService, cache: CacheService);
    private isMissingSchema;
    private isUniqueViolation;
    private warnMigrationMissing;
    private loadWindow;
    private isExpired;
    private getMarkingScheme;
    private resolveAssignmentWindow;
    private assertWritable;
    private attemptsFor;
    private hasOtherSubmittedAttempt;
    startAttempt(testId: string, studentId: string): Promise<{
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
    private resumeAttempt;
    getSavedAnswers(attemptId: string): Promise<any[]>;
    saveAnswer(attemptId: string, studentId: string, body: {
        question_id: string;
        selected_answer?: any;
        status?: string;
        time_spent_seconds: number;
    }): any;
    logViolation(attemptId: string, studentId: string, body: {
        type?: string;
        detail?: string;
    }): Promise<{
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
    toggleFlag(attemptId: string, studentId: string, questionId: string, flagged: boolean): Promise<{
        flagged: boolean;
    }>;
    submitAttempt(attemptId: string, studentId: string, autoSubmitted?: boolean): Promise<{
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
    private gradeAndFinalise;
    private isEmptyAnswer;
    private answersMatch;
    autoSubmitExpiredAttempts(): Promise<number>;
    getMyAttempts(studentId: string): Promise<{
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
    getAttemptResult(attemptId: string, studentId: string): Promise<{
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
    private getCohortPosition;
    private getTestScoreStats;
}
