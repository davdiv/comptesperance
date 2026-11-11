import { beforeEach, expect, it, vi } from 'vitest';
import { actions } from '../../routes/transactions/[account_id]/[id]/+page.server';
import { getTransaction, getAccountWithTotals } from './queries';
import { upsertAnnotation, resetAutomaticField, setTransactionAllocations } from './repository';
vi.mock('./queries', () => ({ getTransaction: vi.fn(), getAccountWithTotals: vi.fn() }));
vi.mock('./repository', () => ({
	upsertAnnotation: vi.fn(),
	resetAutomaticField: vi.fn(),
	setTransactionAllocations: vi.fn()
}));
const transaction = {
	account_id: 'sumup',
	id: 'sale',
	category_id: 'frais-bancaires',
	payment_mode_id: 'carte',
	sources: {
		category_id: { source: 'guess' },
		payment_mode_id: { source: 'guess' },
		third_party_id: { source: 'none' },
		excluded: { source: 'guess' }
	},
	third_party_id: null,
	allocations: [],
	evidence: ['doc.pdf'],
	excluded: false
};
beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(getTransaction).mockResolvedValue(transaction as never);
	vi.mocked(getAccountWithTotals).mockResolvedValue({
		account_id: 'sumup',
		source: 'csv'
	} as never);
});
async function submit(action: string, values: Record<string, string>) {
	const form = new FormData();
	for (const [key, value] of Object.entries(values)) form.set(key, value);
	return actions[action]!({
		request: new Request('http://localhost/transactions/sumup/sale', {
			method: 'POST',
			body: form
		}),
		params: { account_id: 'sumup', id: 'sale' },
		locals: { user: { canWrite: true, canEdit: true, editMode: true } }
	} as never);
}
it('resets only allowed keys for writers and rejects unauthorized resets and suggestions', async () => {
	expect(await submit('reset_automatic', { field: 'category_id' })).toEqual({ ok: true });
	expect(resetAutomaticField).toHaveBeenCalledWith('sumup', 'sale', 'category_id');
	vi.mocked(resetAutomaticField).mockRejectedValue(new Error('Invalid field'));
	expect(await submit('reset_automatic', { field: 'notes' })).toMatchObject({ status: 400 });
	for (const action of ['reset_automatic', 'apply_suggested_project']) {
		for (const [canEdit, editMode] of [
			[false, false],
			[false, true],
			[true, false]
		]) {
			await expect(
				actions[action]!({ locals: { user: { canWrite: false, canEdit, editMode } } } as never)
			).rejects.toMatchObject({ status: 403 });
		}
	}
	expect(await submit('apply_suggested_project', {})).toMatchObject({ status: 400 });
	vi.mocked(getTransaction).mockResolvedValue({
		...transaction,
		suggested_project_id: 'p',
		amount_cents: -1200
	} as never);
	expect(await submit('apply_suggested_project', {})).toEqual({ ok: true });
	expect(setTransactionAllocations).toHaveBeenCalledWith(
		{ account_id: 'sumup', transaction_id: 'sale' },
		[{ project_id: 'p', amount_cents: -1200 }]
	);
});
it('does not persist guesses when editing only notes or unlinking evidence', async () => {
	expect(
		await submit('save', {
			notes: 'Changed',
			category_id: 'frais-bancaires',
			payment_mode_id: 'carte'
		})
	).toEqual({ ok: true });
	expect(upsertAnnotation).toHaveBeenLastCalledWith(
		'sumup',
		'sale',
		expect.objectContaining({
			notes: 'Changed',
			category_id: undefined,
			payment_mode_id: undefined
		})
	);
	expect(await submit('delete_evidence', { path: 'doc.pdf' })).toEqual({ ok: true });
	expect(upsertAnnotation).toHaveBeenLastCalledWith('sumup', 'sale', { evidence: [] });
});
it('persists changed or deliberately cleared classifications from the main form', async () => {
	for (const value of ['cheque', '']) {
		expect(await submit('save', { category_id: '', payment_mode_id: value })).toEqual({ ok: true });
		expect(upsertAnnotation).toHaveBeenLastCalledWith(
			'sumup',
			'sale',
			expect.objectContaining({ category_id: '', payment_mode_id: value })
		);
		expect(upsertAnnotation).toHaveBeenLastCalledWith(
			'sumup',
			'sale',
			expect.objectContaining({ notes: '' })
		);
	}
});
