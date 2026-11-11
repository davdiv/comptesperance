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
