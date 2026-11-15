import { beforeEach, expect, it, vi } from 'vitest';
import { listTransferPool } from './queries';
import { createTransferGroups } from './repository';
import { linkBalancedSuggestions } from './transfer-suggestions';
import { suggestTransferGroups } from './transfer-matcher';
vi.mock('./queries', () => ({ listTransferPool: vi.fn() }));
vi.mock('./repository', () => ({ createTransferGroups: vi.fn() }));
const pool = [
	{ account_id: 'a', id: 'out', amount_cents: -100, date: '2026-10-01', label: 'Out' },
	{ account_id: 'b', id: 'in', amount_cents: 100, date: '2026-10-01', label: 'In' },
	{ account_id: 'a', id: 'other-out', amount_cents: -200, date: '2026-10-01', label: 'Out' },
	{ account_id: 'b', id: 'other-in', amount_cents: 200, date: '2026-10-01', label: 'In' }
];
beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(listTransferPool).mockResolvedValue(pool as never);
});
async function submit(values: Record<string, string | string[]>) {
	const form = new FormData();
	for (const [key, value] of Object.entries(values))
		for (const item of [value].flat()) form.append(key, item);
	return linkBalancedSuggestions({
		request: new Request('http://localhost/transfers', { method: 'POST', body: form }),
		locals: { user: { canWrite: true, canEdit: true, editMode: true } }
	} as never);
}
it('bulk-links disjoint balanced suggestions in one repository call', async () => {
	expect(
		await submit({ suggestion_key: suggestTransferGroups(pool).map((item) => item.key) })
	).toEqual({ ok: true });
	expect(createTransferGroups).toHaveBeenCalledExactlyOnceWith([
		[
			{ account_id: 'a', transaction_id: 'out' },
			{ account_id: 'b', transaction_id: 'in' }
		],
		[
			{ account_id: 'a', transaction_id: 'other-out' },
			{ account_id: 'b', transaction_id: 'other-in' }
		]
	]);
});
it('links a selected fresh suggestion and rejects stale or empty suggestions', async () => {
	const key = suggestTransferGroups(pool)[0].key;
	expect(await submit({ suggestion_key: key })).toEqual({ ok: true });
	vi.mocked(createTransferGroups).mockClear();
	expect(await submit({ suggestion_key: 'invalid' })).toMatchObject({ status: 400 });
	vi.mocked(listTransferPool).mockResolvedValue([]);
	expect(await submit({ all: '1' })).toMatchObject({ status: 400 });
	expect(createTransferGroups).not.toHaveBeenCalled();
});

it('only links explicitly submitted visible keys and rejects a partially stale selection atomically', async () => {
	const [suggestion] = suggestTransferGroups(pool);
	expect(await submit({ suggestion_key: [suggestion.key] })).toEqual({ ok: true });
	expect(vi.mocked(createTransferGroups).mock.calls[0][0]).toHaveLength(1);
	vi.mocked(createTransferGroups).mockClear();
	expect(await submit({ suggestion_key: [suggestion.key, 'stale'] })).toMatchObject({
		status: 400
	});
	expect(await submit({ all: '1' })).toMatchObject({ status: 400 });
	expect(createTransferGroups).not.toHaveBeenCalled();
});
