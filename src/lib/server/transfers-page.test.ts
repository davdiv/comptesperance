import { beforeEach, expect, it, vi } from 'vitest';
import { actions, load } from '../../routes/transfers/+page.server';
import {
	listTransferGroups,
	listTransferPool,
	listAccountsWithTotals,
	type TransactionView
} from './queries';
import { unlinkTransfer, createTransferGroup } from './repository';
import { suggestTransferGroups } from './transfer-matcher';
import { summarizeTransferGroup } from './transfer-groups';
vi.mock('./queries', () => ({
	listTransferGroups: vi.fn(),
	listTransferPool: vi.fn(),
	listAccountsWithTotals: vi.fn()
}));
vi.mock('./repository', () => ({ unlinkTransfer: vi.fn(), createTransferGroup: vi.fn() }));
vi.mock('./transfer-matcher', () => ({ suggestTransferGroups: vi.fn() }));
beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(listTransferGroups).mockResolvedValue([]);
	vi.mocked(listTransferPool).mockResolvedValue([]);
	vi.mocked(listAccountsWithTotals).mockResolvedValue([
		{ account_id: 'a', name: 'Cash' },
		{ account_id: 'b', name: 'Bank' }
	] as never);
	vi.mocked(suggestTransferGroups).mockReturnValue([]);
});
it('removes an existing member from the transfers page and rejects invalid members', async () => {
	vi.mocked(listTransferGroups).mockResolvedValue([
		{ members: [{ account_id: 'a', id: 'one' }] }
	] as never);
	for (const value of ['a:one', 'a:missing']) {
		const form = new FormData();
		form.set('member', value);
		const result = await actions.unlink_transfer!({
			request: new Request('http://localhost/transfers', { method: 'POST', body: form }),
			locals: { user: { canWrite: true, canEdit: true, editMode: true } }
		} as never);
		expect(result).toMatchObject(value === 'a:one' ? { ok: true } : { status: 400 });
	}
	expect(unlinkTransfer).toHaveBeenCalledExactlyOnceWith({
		account_id: 'a',
		transaction_id: 'one'
	});
});

function group(index: number) {
	return summarizeTransferGroup(
		String(index),
		['a', 'b'].map((account_id, i) => ({
			id: String(index) + '-' + i,
			account_id,
			date: '2026-10-01',
			label: 'Transfer ' + index,
			amount_cents: i ? 100 : -100,
			allocations: [],
			allocation_details: []
		})) as unknown as TransactionView[]
	);
}
async function page(query = '', canWrite = true) {
	return (await load({
		url: new URL('http://localhost/transfers?' + query),
		locals: { user: { canWrite } }
	} as never)) as {
		groups: ReturnType<typeof group>[];
		suggestions: ReturnType<typeof suggestTransferGroups>;
		groupCount: number;
		suggestionCount: number;
		pool: { rows: TransactionView[]; total: number };
	};
}

it('paginates complete groups and suggestions, preserving counterpart members under account filters', async () => {
	const groups = Array.from({ length: 60 }, (_, index) => group(index));
	vi.mocked(listTransferGroups).mockResolvedValue(groups);
	vi.mocked(suggestTransferGroups).mockReturnValue(
		groups.map((item) => ({ key: item.id, reference: null, members: item.members }))
	);
	const first = await page();
	expect(first.groups).toHaveLength(50);
	expect(first.suggestions).toHaveLength(0);
	expect(first.groupCount).toBe(60);
	const last = await page('offset=999&account_id=a');
	expect(last.groups).toHaveLength(10);
	expect(last.groups.every((item) => item.members.length === 2)).toBe(true);
	const suggestions = await page('tab=suggestions&limit=25&offset=25&search=Bank');
	expect(suggestions.groups).toHaveLength(0);
	expect(suggestions.suggestions).toHaveLength(25);
	expect(suggestions.suggestionCount).toBe(60);
});

it('filters statuses and pages manual candidates separately without exposing the full pool', async () => {
	vi.mocked(listTransferGroups).mockResolvedValue([group(1), { ...group(2), balanced: false }]);
	vi.mocked(listTransferPool).mockResolvedValue(
		Array.from({ length: 60 }, (_, index) => group(index).members).flat()
	);
	const result = await page('balance=unbalanced&pool_account_id=a&pool_limit=25&pool_offset=999');
	expect(result.groups.map((item) => item.id)).toEqual(['2']);
	expect(result.pool.total).toBe(60);
	expect(result.pool.rows).toHaveLength(10);
	expect(result.pool.rows.every((item) => item.account_id === 'a')).toBe(true);
	expect((await page('', false)).pool).toEqual({ rows: [], total: 0 });
});

it('creates a manual group from selections spanning candidate pages and rejects stale selections', async () => {
	const members = [...group(1).members, ...group(2).members];
	vi.mocked(listTransferPool).mockResolvedValue(members);
	for (const ids of [
		[members[0], members[3]],
		[members[0], { ...members[3], id: 'stale' }]
	]) {
		const body = new FormData();
		for (const item of ids) body.append('members', JSON.stringify([item.account_id, item.id]));
		const result = await actions.create!({
			request: new Request('http://localhost/transfers', { method: 'POST', body }),
			locals: { user: { canWrite: true, canEdit: true, editMode: true } }
		} as never);
		expect(result).toMatchObject(ids[1].id === 'stale' ? { status: 400 } : { ok: true });
	}
	expect(createTransferGroup).toHaveBeenCalledExactlyOnceWith([
		{ account_id: 'a', transaction_id: '1-0' },
		{ account_id: 'b', transaction_id: '2-1' }
	]);
});
