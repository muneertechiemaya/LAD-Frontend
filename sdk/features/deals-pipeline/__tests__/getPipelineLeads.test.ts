/**
 * getPipelineLeads — the Pipeline list search has to reach the server.
 *
 * The list view filtered only the page it had loaded, so a lead on page 7 was
 * never found by typing its name on page 1. GET /api/deals-pipeline/leads takes
 * `?search=` (LAD-Backend#960) and matches first/last name, the raw_data name,
 * email, company and phone (digits-only too); the total and pages reflect it.
 * These tests pin the query string the SDK builds.
 *
 * Run: npx vitest run features/deals-pipeline/__tests__/getPipelineLeads.test.ts
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.fn();
vi.mock('../../../shared/apiClient', () => ({
  apiGet: (...args: unknown[]) => apiGet(...args),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  apiPatch: vi.fn(),
  apiClient: {},
}));

import { getPipelineLeads } from '../api';

/** The query string of the one URL getPipelineLeads requested. */
function requestedQuery(): URLSearchParams {
  expect(apiGet).toHaveBeenCalledTimes(1);
  const url = String(apiGet.mock.calls[0][0]);
  expect(url.startsWith('/api/deals-pipeline/leads?')).toBe(true);
  return new URLSearchParams(url.split('?')[1]);
}

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockResolvedValue({ data: { leads: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } } });
});

describe('getPipelineLeads query', () => {
  it('sends the search term with the page and limit', async () => {
    await getPipelineLeads({ search: 'Priya Nair', page: 1, limit: 20 });
    const q = requestedQuery();
    expect(q.get('search')).toBe('Priya Nair');
    expect(q.get('page')).toBe('1');
    expect(q.get('limit')).toBe('20');
  });

  it('trims the search term', async () => {
    await getPipelineLeads({ search: '  +971 50 123  ', page: 1, limit: 20 });
    expect(requestedQuery().get('search')).toBe('+971 50 123');
  });

  it('URL-encodes characters that would otherwise break the query', async () => {
    await getPipelineLeads({ search: 'a&b=c+d@x.com', page: 2, limit: 50 });
    const url = String(apiGet.mock.calls[0][0]);
    expect(url).not.toContain('a&b=c+d@x.com');
    expect(requestedQuery().get('search')).toBe('a&b=c+d@x.com');
  });

  it.each([
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace', '   '],
  ])('omits search when it is %s', async (_label, search) => {
    await getPipelineLeads({ search, page: 3, limit: 20 });
    const q = requestedQuery();
    expect(q.has('search')).toBe(false);
    expect(q.get('page')).toBe('3');
  });

  it('keeps stage and status alongside the search', async () => {
    await getPipelineLeads({ stage: 'contacted', status: 'sent', search: 'acme', page: 1, limit: 20 });
    const q = requestedQuery();
    expect(q.get('stage')).toBe('contacted');
    expect(q.get('status')).toBe('sent');
    expect(q.get('search')).toBe('acme');
  });

  it('builds the same query as before when no search is given', async () => {
    await getPipelineLeads({ stage: 'followup', page: 4, limit: 100 });
    expect(String(apiGet.mock.calls[0][0])).toBe('/api/deals-pipeline/leads?stage=followup&page=4&limit=100');
  });
});

describe('getPipelineLeads rows', () => {
  it('derives the name from first/last and lower-cases the stage', async () => {
    apiGet.mockResolvedValue({
      data: {
        leads: [{ id: 'l1', first_name: 'Priya', last_name: 'Nair', stage: 'Contacted' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });
    const res = await getPipelineLeads({ search: 'priya', page: 1, limit: 20 });
    expect(res.leads[0]).toMatchObject({ name: 'Priya Nair', stage: 'contacted' });
    expect(res.pagination.total).toBe(1);
  });

  it('keeps a server-supplied name (e.g. from raw_data) over first/last', async () => {
    apiGet.mockResolvedValue({
      data: {
        leads: [{ id: 'l2', name: 'Ahmed Al Mansoori', first_name: null, last_name: null, stage: 'new' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });
    const res = await getPipelineLeads({ search: 'ahmed', page: 1, limit: 20 });
    expect(res.leads[0].name).toBe('Ahmed Al Mansoori');
  });
});
