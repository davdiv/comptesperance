import { beforeEach, expect, it, vi } from 'vitest';
import { getTransaction } from './queries';
import { setTransactionAllocations } from './repository';
import { editAllocation } from './allocation-editor';
vi.mock('./queries', () => ({ getTransaction: vi.fn() }));
vi.mock('./repository', () => ({ setTransactionAllocations: vi.fn() }));
beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(getTransaction).mockResolvedValue({
		allocations: [
			{ project_id: 'p', amount_cents: 500, note: 'Old' },
			{ project_id: 'other', amount_cents: 200 }
		]
	} as never);
});
const form = (entries: Record<string, string>) => {
	const data = new FormData();
	for (const [k, v] of Object.entries(entries)) data.set(k, v);
	return data;
};
it('edits the amount and note without changing other allocations', async () => {
	expect(
		await editAllocation('cash', 'sale', 'p', form({ amount: '6.00', note: ' Updated ' }))
	).toEqual({ ok: true });
	expect(setTransactionAllocations).toHaveBeenCalledWith(
		{ account_id: 'cash', transaction_id: 'sale' },
		[
			{ project_id: 'p', amount_cents: 600, note: 'Updated' },
			{ project_id: 'other', amount_cents: 200 }
		]
	);
});
it('removes an allocation without requiring a valid amount', async () => {
	expect(
		await editAllocation('cash', 'sale', 'p', form({ operation: 'remove', amount: 'invalid' }))
	).toEqual({ ok: true });
	expect(setTransactionAllocations).toHaveBeenCalledWith(expect.anything(), [
		{ project_id: 'other', amount_cents: 200 }
	]);
});
it('returns clear validation failures for invalid amounts, missing allocations and repository validation errors', async () => {
	expect(await editAllocation('cash', 'sale', 'p', form({ amount: 'invalid' }))).toMatchObject({
		status: 400
	});
	expect(await editAllocation('cash', 'sale', 'missing', form({ amount: '1' }))).toMatchObject({
		status: 400
	});
	expect(setTransactionAllocations).not.toHaveBeenCalled();
	vi.mocked(setTransactionAllocations).mockRejectedValue(new Error('allocation_exceeded'));
	expect(await editAllocation('cash', 'sale', 'p', form({ amount: '100' }))).toMatchObject({
		status: 400,
		data: { error: expect.any(String) }
	});
});
