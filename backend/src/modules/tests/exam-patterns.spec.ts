import * as fs from 'fs';
import * as path from 'path';
import {
  EXAM_PATTERNS,
  multiCorrectScore,
  paperMarks,
  patternIdOf,
  patternTotals,
  resolveSections,
  scoreInSection,
  subjectQuota,
  validatePaper,
} from './exam-patterns';

/** A paper of `n` questions of one type for one subject, numbered from `start`. */
const block = (subject: string, q_type: string, n: number, start = 1) =>
  Array.from({ length: n }, (_, i) => ({
    question_id: `${subject}-${q_type}-${start + i}`,
    question_order: start + i,
    subject,
    q_type,
  }));

describe('official exam patterns', () => {
  /**
   * The blueprint is copied into both frontends. If a copy drifts, the
   * constructor would count one pattern while the server enforces another.
   */
  it('keeps the frontend copies identical to the backend source', () => {
    const root = path.join(__dirname, '../../../..');
    const source = fs.readFileSync(path.join(__dirname, 'exam-patterns.data.json'), 'utf8');
    for (const copy of [
      'frontend/src/utils/examPatterns.json',
      'exam/frontend/src/lib/examPatterns.json',
    ]) {
      expect(fs.readFileSync(path.join(root, copy), 'utf8')).toBe(source);
    }
  });

  describe('JEE Main (NTA)', () => {
    const p = EXAM_PATTERNS.jee_main;

    it('is 75 questions, 300 marks, 3 hours', () => {
      expect(patternTotals(p)).toEqual({ questions: 75, marks: 300 });
      expect(p.durationMinutes).toBe(180);
    });

    it('is 20 single-correct + 5 numerical per subject, all compulsory', () => {
      for (const subject of ['Physics', 'Chemistry', 'Mathematics']) {
        expect(subjectQuota(p, subject)).toEqual({ single: 20, multi: 0, numerical: 5 });
      }
    });

    it('accepts a paper exactly to pattern and names every shortfall otherwise', () => {
      const paper = ['Physics', 'Chemistry', 'Mathematics'].flatMap((s) => [
        ...block(s, 'single_correct', 20),
        ...block(s, 'numerical', 5, 21),
      ]);
      expect(validatePaper(p, paper)).toEqual([]);

      const short = paper.filter((q) => q.question_id !== 'Physics-numerical-25');
      expect(validatePaper(p, short)).toEqual([
        'Physics: 4 numerical question(s), the pattern needs 5.',
      ]);
    });

    it('refuses multi-correct and subjective questions', () => {
      const paper = [...block('Physics', 'multi_correct', 1), ...block('Physics', 'subjective', 1, 2)];
      const problems = validatePaper(p, paper).join(' ');
      expect(problems).toMatch(/1 one-or-more-correct question\(s\), the pattern needs 0/);
      expect(problems).toMatch(/subjective/);
    });

    it('marks +4 / −1 in both sections', () => {
      const sections = resolveSections(p, [...block('Physics', 'single_correct', 20), ...block('Physics', 'numerical', 5, 21)]);
      const a = sections.get('Physics-single_correct-1')!;
      const b = sections.get('Physics-numerical-21')!;
      expect([a.marks, a.negative, b.marks, b.negative]).toEqual([4, 1, 4, 1]);
    });
  });

  describe('JEE Advanced (IIT) 2025', () => {
    it('Paper 1 is 180 marks; Maths has 4 matching sets at +3, Physics/Chemistry 3 at +4', () => {
      const p = EXAM_PATTERNS.jee_advanced;
      expect(patternTotals(p)).toEqual({ questions: 49, marks: 180 });
      expect(subjectQuota(p, 'Mathematics')).toEqual({ single: 8, multi: 3, numerical: 6 });
      expect(subjectQuota(p, 'Physics')).toEqual({ single: 7, multi: 3, numerical: 6 });
      for (const subject of Object.keys(p.subjects)) {
        expect(paperMarks(p, [
          ...block(subject, 'single_correct', subjectQuota(p, subject).single),
          ...block(subject, 'multi_correct', 3, 50),
          ...block(subject, 'numerical', 6, 60),
        ])).toBe(60);
      }
    });

    it('Paper 2 is 4 single + 4 multi + 8 numerical per subject, 180 marks', () => {
      const p = EXAM_PATTERNS.jee_advanced_p2;
      expect(patternTotals(p)).toEqual({ questions: 48, marks: 180 });
      expect(subjectQuota(p, 'Chemistry')).toEqual({ single: 4, multi: 4, numerical: 8 });
    });

    // Single-correct questions fill Section 1 first, then Section 4 (matching),
    // in paper order — so the first four score +3 and the rest +4 in Physics.
    it('pours single-correct questions into Section 1 then Section 4 in paper order', () => {
      const p = EXAM_PATTERNS.jee_advanced;
      const sections = resolveSections(p, block('Physics', 'single_correct', 7));
      expect([1, 2, 3, 4].map((n) => sections.get(`Physics-single_correct-${n}`)!.id)).toEqual(['1', '1', '1', '1']);
      expect([5, 6, 7].map((n) => sections.get(`Physics-single_correct-${n}`)!.marks)).toEqual([4, 4, 4]);
    });

    /** The worked example printed on the 2025 paper: (A), (B), (D) correct. */
    it('applies the official one-or-more-correct partial marking', () => {
      const s = EXAM_PATTERNS.jee_advanced.subjects.Physics[1];
      const key = [0, 1, 3];
      expect(multiCorrectScore([0, 1, 3], key, s)).toBe(4);
      expect(multiCorrectScore([0, 1], key, s)).toBe(2);
      expect(multiCorrectScore([0, 3], key, s)).toBe(2);
      expect(multiCorrectScore([1], key, s)).toBe(1);
      expect(multiCorrectScore([0, 1, 2], key, s)).toBe(-2);
      expect(multiCorrectScore([2], key, s)).toBe(-2);
      // All four correct, three chosen.
      expect(multiCorrectScore([0, 1, 2], [0, 1, 2, 3], s)).toBe(3);
      // Two correct, both chosen = full; one chosen = +1.
      expect(multiCorrectScore([2], [1, 2], s)).toBe(1);
    });

    it('takes numerical answers to two decimal places, with no negative mark', () => {
      const s = EXAM_PATTERNS.jee_advanced.subjects.Physics[2];
      expect(scoreInSection(s, { value: '2.354' }, { value: '2.35' }, 'decimal2')).toEqual({ score: 4, full: true });
      expect(scoreInSection(s, { value: '2.36' }, { value: '2.35' }, 'decimal2')).toEqual({ score: -0, full: false });
    });
  });

  describe('NEET (NTA, from 2025)', () => {
    const p = EXAM_PATTERNS.neet;

    it('is 180 compulsory questions in 180 minutes for 720 marks', () => {
      expect(patternTotals(p)).toEqual({ questions: 180, marks: 720 });
      expect(p.durationMinutes).toBe(180);
      expect(subjectQuota(p, 'Biology').single).toBe(90);
      expect(subjectQuota(p, 'Physics').single).toBe(45);
    });

    it('counts Botany and Zoology questions as Biology', () => {
      const paper = [
        ...block('Physics', 'single_correct', 45),
        ...block('Chemistry', 'single_correct', 45),
        ...block('Botany', 'single_correct', 45),
        ...block('Zoology', 'single_correct', 45, 46),
      ];
      expect(validatePaper(p, paper)).toEqual([]);
    });
  });

  it('recognises the pattern of tests created before the paper_pattern column', () => {
    expect(patternIdOf({ title: 'Mock 3', instructions: 'Pattern: JEE Main' })).toBe('jee_main');
    expect(patternIdOf({ title: 'JEE Advanced Paper 2 mock' })).toBe('jee_advanced_p2');
    expect(patternIdOf({ title: 'JEE Adv full test' })).toBe('jee_advanced');
    expect(patternIdOf({ paper_pattern: 'custom', title: 'JEE Main style quiz' })).toBeNull();
  });
});
