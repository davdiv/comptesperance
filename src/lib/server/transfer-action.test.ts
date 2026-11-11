import { beforeEach, expect, it, vi } from 'vitest';
import { actions } from '../../routes/transactions/+page.server';
import { getTransaction } from './queries';
import { linkTransfer } from './repository';
vi.mock('./queries', () => ({
	getTransaction: vi.fn(),
	listTransferPool: vi.fn(),
	listAccountsWithTotals: vi.fn(),
	listTransactions: vi.fn(),
	listThirdPartiesWithCounts: vi.fn()
}));
vi.mock('./repository', () => ({ linkTransfer: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it('allows a strong unequal-amount reference pair and writes one link', async () => {
	vi.mocked(getTransaction)
		.mockResolvedValueOnce({
			account_id: 'sumup',
			id: 'payout',
			date: '2026-09-27',
			amount_cents: -2256,
			label: 'Payout',
			attributes: { payout_id: 'SUMUP PID9000007' }
		} as never)
		.mockResolvedValueOnce({
			account_id: 'ccp',
			id: 'receipt',
			date: '2026-09-28',
			amount_cents: 5790,
			label: 'VIREMENT PID9000007'
		} as never);
	const form = new FormData();
	form.set('first_account', 'sumup');
	form.set('first_transaction', 'payout');
	form.set('counterpart', 'ccp:receipt');
	const result = await actions.link_suggestion!({
		request: new Request('http://localhost/transactions', { method: 'POST', body: form }),
		locals: { user: { canWrite: true } }
	} as never);
	expect(result).toEqual({ ok: true });
	expect(linkTransfer).toHaveBeenCalledExactlyOnceWith(
		{ account_id: 'sumup', transaction_id: 'payout' },
		{ account_id: 'ccp', transaction_id: 'receipt' }
	);
});
it('rejects a stale or absent suggestion without linking', async () => {
	vi.mocked(getTransaction).mockResolvedValue(null);
	const result = await actions.link_suggestion!({
		request: new Request('http://localhost/transactions', { method: 'POST', body: new FormData() }),
		locals: { user: { canWrite: true } }
	} as never);
	expect(result).toMatchObject({ status: 400 });
	expect(linkTransfer).not.toHaveBeenCalled();
});
