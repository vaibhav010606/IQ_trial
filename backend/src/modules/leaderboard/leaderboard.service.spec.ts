import { supabaseMock } from '../../test-utils/supabase-mock';

jest.mock('../../config/supabase.config', () => ({
  supabase: supabaseMock,
}));

import { LeaderboardService } from './leaderboard.service';

/** A cache that always misses, so every call computes. */
const passthroughCache: any = {
  wrap: (_key: string, _ttl: number, fn: () => any) => fn(),
  invalidate: async () => undefined,
};

describe('LeaderboardService', () => {
  let service: LeaderboardService;

  beforeEach(() => {
    supabaseMock.reset();
    service = new LeaderboardService(passthroughCache);
  });

  /**
   * Scores only count once an admin has released that test's results. Before
   * this, a student saw their rank move — and could work out their score — the
   * moment they submitted, before the results were approved.
   */
  it('ignores attempts on tests whose results are not released', async () => {
    supabaseMock.queueResult('attempts', {
      data: [
        {
          student_id: 's1',
          test_id: 'released',
          total_score: 40,
          users: { id: 's1', full_name: 'Asha' },
        },
        {
          student_id: 's2',
          test_id: 'released',
          total_score: 20,
          users: { id: 's2', full_name: 'Bilal' },
        },
        {
          student_id: 's2',
          test_id: 'withheld',
          total_score: 100,
          users: { id: 's2', full_name: 'Bilal' },
        },
      ],
    });
    supabaseMock.queueResult('tests', {
      data: [
        { id: 'released', results_published: true },
        { id: 'withheld', results_published: false },
      ],
    });

    const board = await service.getGlobal();

    expect(board.data.map((r: any) => [r.id, r.totalScore])).toEqual([
      ['s1', 40],
      ['s2', 20],
    ]);
  });

  it('honours the legacy instructions tag when the column is absent', async () => {
    supabaseMock.queueResult('attempts', {
      data: [
        {
          student_id: 's1',
          test_id: 't1',
          total_score: 12,
          users: { id: 's1', full_name: 'Asha' },
        },
      ],
    });
    supabaseMock.queueResult('tests', {
      data: [
        {
          id: 't1',
          instructions: 'Pattern: JEE Main\n[RESULTS_PUBLISHED:true]',
        },
      ],
    });

    const board = await service.getGlobal();
    expect(board.data).toHaveLength(1);
    expect(board.data[0].totalScore).toBe(12);
  });
});
