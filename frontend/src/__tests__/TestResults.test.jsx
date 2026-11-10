import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Shaped like the live data that crashed the page: one candidate scored −2/300.
vi.mock('../api/client', () => ({
  apiClient: {
    getList: vi.fn(async () => [{ id: 't1', title: 'trial test 2', subject: 'Mixed', status: 'published' }]),
    get: vi.fn(async () => ({
      test: { id: 't1', title: 'trial test 2', total_marks: 300 },
      results_published: false,
      summary: { submitted: 1, assigned: 1, notAttempted: 0, maxMarks: 300, highest: -2, lowest: -2, average: -2, median: -2, autoSubmitted: 0 },
      results: [{ id: 'a1', rank: 1, total_score: -2, percentage: -1, users: { full_name: 'Alex Johnson', email: 'student@edu.com' } }],
      questionStats: [],
    })),
    patch: vi.fn(),
  },
}));

// recharts needs real layout; a stub keeps the test about the page itself.
vi.mock('recharts', () => {
  const Stub = ({ children }) => <div>{children}</div>;
  return { ResponsiveContainer: Stub, BarChart: Stub, Bar: Stub, XAxis: Stub, YAxis: Stub, CartesianGrid: Stub, Tooltip: Stub, Cell: Stub };
});

import TestResults from '../pages/teacher/TestResults';

describe('Test results page', () => {
  it('renders a negative (negative-marking) score instead of crashing', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/test-results']}>
        <Routes>
          <Route path="/admin/test-results" element={<TestResults />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Alex Johnson')).toBeTruthy();
    expect(screen.getByText('-1%')).toBeTruthy();
  });
});
