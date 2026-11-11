import { beforeEach, expect, it, vi } from 'vitest';
import { actions } from '../../routes/transfers/+page.server';
import { listTransferGroups } from './queries';
import { unlinkTransfer } from './repository';
vi.mock('./queries', () => ({ listTransferGroups: vi.fn() }));
vi.mock('./repository', () => ({ unlinkTransfer: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
it('removes an existing member from the transfers page and rejects invalid members', async () => {
	vi.mocked(listTransferGroups).mockResolvedValue([
		{ members: [{ account_id: 'a', id: 'one' }] }
	] as never);
	for (const value of ['a:one', 'a:missing']) {
		const form = new FormData();
		form.set('member', value);
		const result = await actions.unlink_transfer!({
			request: new Request('http://localhost/transfers', { method: 'POST', body: form }),
			locals: { user: { canWrite: true } }
		} as never);
		expect(result).toMatchObject(value === 'a:one' ? { ok: true } : { status: 400 });
	}
	expect(unlinkTransfer).toHaveBeenCalledExactlyOnceWith({
		account_id: 'a',
		transaction_id: 'one'
	});
});
