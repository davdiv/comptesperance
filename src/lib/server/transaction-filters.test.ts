import { expect, it, vi } from 'vitest';
import { parseTransactionFilters, transactionWhere, visiblePage } from './transaction-filters';
import { filterHref, resetFilterHref } from '$lib/transaction-filters';
import { thirdPartyPerspective, transactionFilterState } from './transaction-list';
vi.mock('./queries', () => ({
	listAccountsWithTotals: vi.fn().mockResolvedValue([]),
	listThirdPartiesWithCounts: vi.fn().mockResolvedValue([]),
	listProjectsWithTotals: vi.fn().mockResolvedValue([]),
	listTransactions: vi.fn()
}));
it('does not read the unavailable fragment in SvelteKit server loads', async () => {
	const url = new URL('http://localhost/accounts/cash?search=cake');
	Object.defineProperty(url, 'hash', {
		get() {
			throw new Error('url_hash_unavailable');
		}
	});
	expect(await transactionFilterState(url, { account_id: 'cash' })).toMatchObject({
		filterUrl: '/accounts/cash?search=cake',
		filters: { account_id: 'cash', search: 'cake' }
	});
});
it('parses shared filters, clamps pagination and enforces fixed dimensions', () => {
	const parsed = parseTransactionFilters(
		new URL(
			'http://localhost/accounts/cash?account_id=other&search=%20cake%20&date_from=2026-10-01&date_to=2026-10-03&include_transfers=0&excluded=1&allocation_status=partial&limit=99999&offset=20'
		),
		{ account_id: 'cash' },
		{ include_transfers: true }
	);
	expect(parsed).toMatchObject({
		account_id: 'cash',
		search: 'cake',
		date_from: '2026-10-01',
		date_to: '2026-10-03',
		include_transfers: false,
		excluded: '1',
		allocation_status: 'partial',
		limit: 1000,
		offset: 20
	});
	expect(parseTransactionFilters(new URL('http://localhost/'))).toMatchObject({
		limit: 500,
		offset: 0
	});
	expect(
		parseTransactionFilters(
			new URL(
				'http://localhost/?date_from=2026-99-99&date_to=2026-02-30&allocation_status=bad&excluded=bad&limit=NaN&offset=-1'
			)
		)
	).toEqual({ limit: 500, offset: 0 });
	expect(
		parseTransactionFilters(
			new URL('http://localhost/?project_id=p&allocation_status=allocated&excluded=1'),
			{ project_id: undefined, allocation_status: undefined, excluded: '0' }
		)
	).toMatchObject({ project_id: undefined, allocation_status: undefined, excluded: '0' });
});
it('uses bound SQL parameters rather than interpolating filter values', () => {
	const { where, params } = transactionWhere({
		search: "x' OR 1=1",
		account_id: 'cash',
		category_id: 'c',
		payment_mode_id: 'p',
		third_party_id: 't',
		project_id: 'project',
		allocation_status: 'partial',
		excluded: '0'
	});
	expect(where.join(' ')).not.toContain("x' OR");
	expect(params).toContain("%x' OR 1=1%");
	expect(where.join(' ')).toContain('JOIN projects');
	expect(transactionWhere({})).toEqual({ where: [], params: [] });
});
it('keeps page params and anchors while changing filters or pagination', () => {
	const base = '/projects/p?search=cake&offset=50&limit=5&mode=custom#allocations';
	const url = new URL(filterHref(base, { payment_mode_id: 'card' }), 'http://localhost');
	expect(url.pathname).toBe('/projects/p');
	expect(url.hash).toBe('#allocations');
	expect(url.searchParams.get('search')).toBe('cake');
	expect(url.searchParams.get('mode')).toBe('custom');
	expect(url.searchParams.has('offset')).toBe(false);
	expect(
		new URL(filterHref(base, { offset: 55 }), 'http://localhost').searchParams.get('offset')
	).toBe('55');
	expect(resetFilterHref(base)).toBe('/projects/p?mode=custom#allocations');
});
it('filters visible rows before pagination without changing the underlying matching set', () => {
	const items = [
		{ transfer_id: 'group', id: 1 },
		{ transfer_id: null, id: 2 },
		{ transfer_id: null, id: 3 }
	];
	expect(visiblePage(items, { limit: 1, offset: 1 }, (t) => !!t.transfer_id)).toEqual({
		rows: [items[2]],
		hidden_transfer_count: 1
	});
	expect(items).toHaveLength(3);
});
it('negates third-party transactions, allocations and total, swapping incoming/outgoing without mutation', () => {
	const result = {
		transactions: [
			{
				amount_cents: 500,
				allocations: [{ amount_cents: 300 }],
				allocation_details: [{ amount_cents: 300 }]
			}
		],
		total_cents: 300,
		incoming_cents: 500,
		outgoing_cents: -200
	};
	const reversed = thirdPartyPerspective(result as never);
	expect(reversed).toMatchObject({
		total_cents: -300,
		incoming_cents: 200,
		outgoing_cents: -500,
		transactions: [
			{
				amount_cents: -500,
				allocations: [{ amount_cents: -300 }],
				allocation_details: [{ amount_cents: -300 }]
			}
		]
	});
	expect(result.transactions[0].amount_cents).toBe(500);
	const empty = thirdPartyPerspective({
		transactions: [],
		total_cents: 0,
		incoming_cents: 0,
		outgoing_cents: 0
	} as never);
	expect(Object.is(empty.total_cents, -0)).toBe(false);
});
