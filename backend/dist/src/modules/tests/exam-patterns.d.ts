export type SectionKind = 'single' | 'multi' | 'numerical';
export interface SectionSpec {
    id: string;
    label: string;
    kind: SectionKind;
    count: number;
    marks: number;
    negative: number;
    partial?: boolean;
}
export interface PatternSpec {
    label: string;
    authority: string;
    edition: string;
    durationMinutes: number;
    numericAnswer: 'integer' | 'decimal2';
    subjects: Record<string, SectionSpec[]>;
}
export declare const EXAM_PATTERNS: Record<string, PatternSpec>;
export declare const STANDARD_PATTERN_IDS: string[];
export declare function getPattern(id?: string | null): PatternSpec | null;
export declare function patternIdOf(test: any): string | null;
export declare function patternTotals(pattern: PatternSpec): {
    questions: number;
    marks: number;
};
export declare function kindOfQuestion(q: {
    q_type?: string | null;
    options?: any;
}): SectionKind | null;
export declare function canonicalSubject(subject: string | null | undefined, pattern: PatternSpec): string | null;
export interface PaperQuestion {
    question_id: string;
    question_order?: number | null;
    subject?: string | null;
    q_type?: string | null;
    options?: any;
}
export declare function resolveSections(pattern: PatternSpec, rows: PaperQuestion[]): Map<string, SectionSpec & {
    subject: string;
}>;
export declare function subjectQuota(pattern: PatternSpec, subject: string): Record<SectionKind, number>;
export declare function validatePaper(pattern: PatternSpec, rows: PaperQuestion[]): string[];
export declare function paperMarks(pattern: PatternSpec, rows: (PaperQuestion & {
    marks?: number | null;
    marks_override?: number | null;
})[]): number;
export declare function multiCorrectScore(chosen: number[], correct: number[], section: SectionSpec): number;
export declare function scoreInSection(section: SectionSpec, submitted: any, correct: any, numericRule: PatternSpec['numericAnswer']): {
    score: number;
    full: boolean;
};
