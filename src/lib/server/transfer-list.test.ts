import { expect, it } from 'vitest';
import { matchingTransferGroup, matchingTransferMembers, transferFilters } from './transfer-list';
import { summarizeTransferGroup } from './transfer-groups';
import type { TransactionView } from './queries';

const members = [
	{
		id: 'out',
		account_id: 'a',
		transfer_id: 'group-unique',
		date: '2026-10-01T23:00:00',
		label: 'Outgoing',
		notes: 'Donation',
		amount_cents: -100,
		allocations: [],
		allocation_details: []
	},
	{
		id: 'in',
		account_id: 'b',
		date: '2026-10-02',
		label: 'Incoming',
		amount_cents: 100,
		allocations: [],
		allocation_details: [{ project_name: 'Concert' }]
	}
] as unknown as TransactionView[];
const names = { a: 'Cash', b: 'Bank' };
const filters = (query = '') => transferFilters(new URL('http://localhost/transfers?' + query));

it('uses shared pagination/date validation and isolates candidate filters from group filters', () => {
	expect(filters()).toMatchObject({ limit: 50, offset: 0, balance: '' });
	expect(filters('date_from=2026-02-30&balance=invalid&limit=-1&offset=NaN')).toMatchObject({
		date_from: undefined,
		balance: '',
		limit: 50,
		offset: 0
	});
	expect(
		transferFilters(
			new URL('http://localhost/?search=group&pool_search=Bank&pool_limit=25&pool_offset=50'),
			'pool_'
		)
	).toMatchObject({ search: 'Bank', limit: 25, offset: 50 });
});

it('matches complete groups by a member, including account/project names, notes and inclusive dates', () => {
	for (const query of [
		'search=BANK',
		'search=Donation',
		'search=concert',
		'search=group-unique',
		'date_from=2026-10-01&date_to=2026-10-01&account_id=a'
	])
		expect(matchingTransferMembers(members, filters(query), names)).toBe(true);
	for (const query of [
		'search=missing',
		'account_id=missing',
		'date_to=2026-09-30',
		'date_from=2026-10-03',
		'account_id=a&search=Bank'
	])
		expect(matchingTransferMembers(members, filters(query), names)).toBe(false);
});

it('distinguishes transaction balance from allocation balance', () => {
	const balanced = summarizeTransferGroup('g', members);
	const unbalanced = summarizeTransferGroup('u', members.slice(0, 1));
	expect(matchingTransferGroup(balanced, filters('balance=balanced'))).toBe(true);
	expect(matchingTransferGroup(unbalanced, filters('balance=balanced'))).toBe(false);
	expect(matchingTransferGroup(unbalanced, filters('balance=unbalanced'))).toBe(true);
	expect(
		matchingTransferGroup(
			{ ...balanced, allocations_balanced: false },
			filters('balance=allocations_unbalanced')
		)
	).toBe(true);
	expect(matchingTransferGroup(balanced, filters('balance=allocations_unbalanced'))).toBe(false);
});
