import { expect, it } from 'vitest';
import type { TransactionView } from './queries';
import { summarizeTransferGroup } from './transfer-groups';
const member = (account_id: string, amount_cents: number, allocated: number) =>
	({
		id: account_id,
		account_id,
		amount_cents,
		allocations: [{ project_id: 'p', amount_cents: allocated }],
		allocation_details: []
	}) as unknown as TransactionView;
it('reports transaction and per-project balance independently without blocking unbalanced groups', () => {
	expect(summarizeTransferGroup('g', [member('a', -100, -30), member('b', 100, 30)])).toMatchObject(
		{ balanced: true, allocations_balanced: true, total_cents: 0 }
	);
	expect(summarizeTransferGroup('g', [member('a', -100, -30), member('b', 100, 20)])).toMatchObject(
		{ balanced: true, allocations_balanced: false }
	);
	expect(summarizeTransferGroup('g', [member('a', -100, -30), member('b', 90, 30)])).toMatchObject({
		balanced: false,
		allocations_balanced: true,
		total_cents: -10
	});
	expect(summarizeTransferGroup('g', []).balanced).toBe(false);
	expect(summarizeTransferGroup('g', [member('a', 100, 0), member('a', -100, 0)]).balanced).toBe(
		false
	);
});

it('shows amounts moved once, even when both the group and project allocations net to zero', () => {
	const group = summarizeTransferGroup('g', [
		member('a', -10000, -6000),
		member('b', 4000, 2000),
		member('c', 6000, 4000)
	]);
	expect(group).toMatchObject({
		total_cents: 0,
		incoming_cents: 10000,
		outgoing_cents: -10000,
		moved_cents: 10000
	});
	expect(group.project_totals).toEqual([
		{
			project_id: 'p',
			name: 'p',
			amount_cents: 0,
			incoming_cents: 6000,
			outgoing_cents: -6000,
			moved_cents: 6000
		}
	]);
});

it('keeps unmatched incoming/outgoing amounts separate rather than doubling the moved amount', () => {
	const group = summarizeTransferGroup('g', [member('a', -10000, -6000), member('b', 9000, 5000)]);
	expect(group).toMatchObject({ total_cents: -1000, moved_cents: 9000, balanced: false });
	expect(group.project_totals[0]).toMatchObject({
		amount_cents: -1000,
		moved_cents: 5000,
		incoming_cents: 5000,
		outgoing_cents: -6000
	});
	expect(Object.is(summarizeTransferGroup('empty', []).moved_cents, -0)).toBe(false);
});
