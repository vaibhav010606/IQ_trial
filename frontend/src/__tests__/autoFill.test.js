import { describe, it, expect } from 'vitest';
import { apportion, getQuestionType, selectQuestions, topicStats } from '../utils/autoFill';

let seq = 0;
const mcq = (topic, extra = {}) => ({
  id: `m${++seq}`, subject: 'Physics', topic, q_type: 'single_correct',
  options: ['a', 'b', 'c', 'd'], correct_answer: { index: 0 }, difficulty: 'medium', review_status: 'approved', ...extra,
});
const nat = (topic, value = '5', extra = {}) => ({
  id: `n${++seq}`, subject: 'Physics', topic, q_type: 'numerical',
  options: [], correct_answer: { value }, difficulty: 'medium', review_status: 'approved', ...extra,
});
const fixedRand = () => 0.42;

describe('apportion', () => {
  it('always sums to the total', () => {
    expect(apportion(5, [34, 33, 33]).reduce((a, b) => a + b)).toBe(5);
    expect(apportion(20, [50, 50])).toEqual([10, 10]);
    expect(apportion(3, [0, 0, 0])).toEqual([1, 1, 1]);
  });
});

describe('getQuestionType', () => {
  it('only counts whole-number numericals as NAT', () => {
    expect(getQuestionType(nat('K', '12'))).toBe('nat');
    expect(getQuestionType(nat('K', '12.5'))).toBe('subjective');
    expect(getQuestionType(mcq('K'))).toBe('mcq');
    expect(getQuestionType({ q_type: 'subjective' })).toBe('subjective');
  });
});

describe('selectQuestions', () => {
  const bank = [
    ...Array.from({ length: 15 }, () => mcq('Kinematics')),
    ...Array.from({ length: 15 }, () => mcq('Electrostatics')),
    ...Array.from({ length: 4 }, () => nat('Kinematics')),
    ...Array.from({ length: 4 }, () => nat('Electrostatics')),
    nat('Kinematics', '2.5'), // not an integer: never picked as NAT
    { id: 's1', subject: 'Physics', topic: 'Kinematics', q_type: 'subjective', options: [] },
  ];

  it('fills the exact MCQ / NAT split with no duplicates', () => {
    const { chosen, shortMcq, shortNat } = selectQuestions(bank, {
      topics: ['Kinematics', 'Electrostatics'],
      weights: { Kinematics: 50, Electrostatics: 50 },
      mcq: 20, nat: 5, mix: { easy: 20, medium: 60, hard: 20 }, rand: fixedRand,
    });
    expect(chosen).toHaveLength(25);
    expect(new Set(chosen.map(q => q.id)).size).toBe(25);
    expect(chosen.filter(q => getQuestionType(q) === 'mcq')).toHaveLength(20);
    expect(chosen.filter(q => getQuestionType(q) === 'nat')).toHaveLength(5);
    expect(shortMcq).toBe(0);
    expect(shortNat).toBe(0);
  });

  it('spreads numericals across topics by weight', () => {
    const { chosen } = selectQuestions(bank, {
      topics: ['Kinematics', 'Electrostatics'],
      weights: { Kinematics: 50, Electrostatics: 50 },
      mcq: 0, nat: 4, mix: { medium: 100 }, rand: fixedRand,
    });
    expect(chosen.filter(q => q.topic === 'Kinematics')).toHaveLength(2);
    expect(chosen.filter(q => q.topic === 'Electrostatics')).toHaveLength(2);
  });

  it('borrows from other topics when one runs dry, and reports a real shortfall', () => {
    const { chosen, shortNat } = selectQuestions(bank, {
      topics: ['Kinematics'], weights: { Kinematics: 100 },
      mcq: 0, nat: 10, mix: { medium: 100 }, rand: fixedRand,
    });
    expect(chosen).toHaveLength(8); // only 8 integer NATs exist in the subject
    expect(shortNat).toBe(2);
  });

  it('never re-picks questions already on the paper', () => {
    const exclude = new Set(bank.slice(0, 10).map(q => q.id));
    const { chosen } = selectQuestions(bank, {
      topics: ['Kinematics'], weights: { Kinematics: 100 },
      mcq: 20, nat: 0, mix: { medium: 100 }, excludeIds: exclude, rand: fixedRand,
    });
    expect(chosen.some(q => exclude.has(q.id))).toBe(false);
  });

  it('prefers approved questions over pending ones', () => {
    const mixed = [
      ...Array.from({ length: 5 }, () => mcq('Optics', { review_status: 'pending' })),
      ...Array.from({ length: 5 }, () => mcq('Optics')),
    ];
    const { chosen } = selectQuestions(mixed, {
      topics: ['Optics'], weights: { Optics: 100 }, mcq: 5, nat: 0, mix: { medium: 100 }, rand: fixedRand,
    });
    expect(chosen.every(q => q.review_status === 'approved')).toBe(true);
  });

  it('honours the difficulty mix when the bank allows it', () => {
    const graded = [
      ...Array.from({ length: 10 }, () => mcq('Optics', { difficulty: 'easy' })),
      ...Array.from({ length: 10 }, () => mcq('Optics', { difficulty: 'hard' })),
    ];
    const { chosen } = selectQuestions(graded, {
      topics: ['Optics'], weights: { Optics: 100 }, mcq: 10, nat: 0, mix: { easy: 30, medium: 0, hard: 70 }, rand: fixedRand,
    });
    expect(chosen.filter(q => q.difficulty === 'easy')).toHaveLength(3);
    expect(chosen.filter(q => q.difficulty === 'hard')).toHaveLength(7);
  });
});

describe('topicStats', () => {
  it('counts usable questions per topic', () => {
    const s = topicStats([mcq('A'), nat('A'), nat('A', '1.5'), mcq('B')]);
    expect(s.get('A')).toEqual({ mcq: 1, nat: 1 });
    expect(s.get('B')).toEqual({ mcq: 1, nat: 0 });
  });
});
