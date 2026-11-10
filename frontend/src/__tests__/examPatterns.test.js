import { describe, it, expect } from 'vitest';
import {
  getPattern, patternTotals, subjectQuota, paperQuota, validatePaper, kindOfQuestion, toPreset,
} from '../utils/examPatterns';

const qs = (subject, q_type, n, extra = {}) =>
  Array.from({ length: n }, (_, i) => ({ id: `${subject}-${q_type}-${i}`, subject, q_type, options: ['a', 'b', 'c', 'd'], ...extra }));

describe('official exam patterns (portal copy)', () => {
  it('JEE Main is 75 questions: 20 single + 5 numerical per subject', () => {
    const p = getPattern('jee_main');
    expect(patternTotals(p)).toEqual({ questions: 75, marks: 300 });
    expect(subjectQuota(p, 'Physics')).toEqual({ single: 20, multi: 0, numerical: 5, total: 25 });
    expect(paperQuota(p).total).toBe(75);
  });

  it('JEE Advanced papers follow the 2025 IIT blueprint', () => {
    expect(patternTotals(getPattern('jee_advanced'))).toEqual({ questions: 49, marks: 180 });
    expect(patternTotals(getPattern('jee_advanced_p2'))).toEqual({ questions: 48, marks: 180 });
    expect(subjectQuota(getPattern('jee_advanced'), 'Mathematics')).toEqual({ single: 8, multi: 3, numerical: 6, total: 17 });
  });

  it('NEET is 180 questions in 180 minutes', () => {
    const preset = toPreset('neet');
    expect(preset.totalQuestions).toBe(180);
    expect(preset.duration_minutes).toBe(180);
    expect(preset.totalMarks).toBe(720);
  });

  it('JEE Main numericals need a whole-number key; JEE Advanced takes decimals', () => {
    const decimal = { q_type: 'numerical', correct_answer: { value: '2.5' } };
    expect(kindOfQuestion(decimal, getPattern('jee_main'))).toBeNull();
    expect(kindOfQuestion(decimal, getPattern('jee_advanced'))).toBe('numerical');
  });

  it('validates a subject teacher’s share against their subject only', () => {
    const p = getPattern('jee_main');
    const physics = [...qs('Physics', 'single_correct', 20), ...qs('Physics', 'numerical', 5, { correct_answer: { value: '4' } })];
    expect(validatePaper(p, physics, 'Physics')).toEqual([]);
    expect(validatePaper(p, physics).some((line) => line.startsWith('Chemistry'))).toBe(true);
  });
});
