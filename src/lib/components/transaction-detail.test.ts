import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import { m } from '$lib/paraglide/messages.js';
import TransactionDetail from '../../routes/transactions/[account_id]/[id]/+page.svelte';
it('titles grouped transactions Transfer rather than Link transfer', () => {
	const transaction = {
		id: 'one',
		account_id: 'a',
		date: '2026-10-01',
		label: 'Sale',
		source: 'csv',
		amount_cents: 100,
		allocations: [],
		evidence: [],
		raw: []
	};
	const base = {
		transaction,
		account: { account_id: 'a', name: 'Cash', source: 'csv' },
		config: { categories: [], paymentModes: [] },
		projects: [],
		accounts: [],
		documents: [],
		user: { canWrite: false },
		groupSuggestions: [],
		suggestion: null,
		sumupLinks: null
	};
	for (const group of [
		null,
		{
			id: 'g',
			members: [],
			total_cents: 0,
			balanced: true,
			allocations_balanced: true,
			project_totals: []
		}
	]) {
		const html = render(TransactionDetail, {
			props: { data: { ...base, group }, form: null } as never
		}).body;
		const expected = group ? m.transfer_group_title() : m.transaction_link_transfer();
		const rejected = group ? m.transaction_link_transfer() : m.transfer_group_title();
		expect(html).toContain('class="card-title">' + expected);
		expect(html).not.toContain('class="card-title">' + rejected + '</h2>');
	}
});
