import { beforeEach, expect, it, vi } from 'vitest';
import { actions } from '../../routes/transactions/[account_id]/[id]/+page.server';
import { getTransaction, getAccountWithTotals } from './queries';
import { upsertAnnotation } from './repository';
vi.mock('./queries', () => ({ getTransaction: vi.fn(), getAccountWithTotals: vi.fn() }));
vi.mock('./repository', () => ({ upsertAnnotation: vi.fn() }));
const transaction = {
	account_id: 'sumup',
	id: 'sale',
	category_id: 'frais-bancaires',
	payment_mode_id: 'carte',
	category_is_guessed: true,
	payment_mode_is_guessed: true,
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
	expect(upsertAnnotation).toHaveBeenLastCalledWith(
		'sumup',
		'sale',
		expect.objectContaining({ evidence: [], category_id: undefined, payment_mode_id: undefined })
	);
});
it('persists changed or deliberately cleared classifications from the main form', async () => {
	for (const value of ['cheque', '']) {
		expect(await submit('save', { category_id: '', payment_mode_id: value })).toEqual({ ok: true });
		expect(upsertAnnotation).toHaveBeenLastCalledWith(
			'sumup',
			'sale',
			expect.objectContaining({ category_id: '', payment_mode_id: value })
		);
	}
});
