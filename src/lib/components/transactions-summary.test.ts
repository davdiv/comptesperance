import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import TransactionsPage from '../../routes/transactions/+page.svelte';
function summary(total: number, amount: number, hidden: number) {
	return render(TransactionsPage, {
		props: {
			data: {
				accounts: [],
				thirdParties: [],
				projects: [],
				transactions: [],
				suggestions: [],
				filters: {},
				config: { categories: [], paymentModes: [] },
				user: { canWrite: false },
				total,
				total_cents: amount,
				hidden_transfer_count: hidden,
				includeTransfers: hidden === 0
			},
			form: null
		} as never
	}).body;
}
it('uses the shared signed amount styling and explains hidden transfers', () => {
	const html = summary(14, -174890, 3);
	expect(html).toContain('money negative');
	expect(html).toContain(m.transactions_hidden_transfers({ count: 3 }));
	expect(summary(2, 100, 0)).toContain('money positive');
});
it('omits the hidden-transfer hint when transfers are included or none match', () => {
	for (const [count, amount] of [
		[0, 0],
		[14, -174890]
	]) {
		expect(summary(count, amount, 0)).not.toContain(m.transactions_hidden_transfers({ count: 0 }));
		expect(summary(count, amount, 0)).not.toContain(m.transactions_hidden_transfers({ count: 3 }));
	}
});
