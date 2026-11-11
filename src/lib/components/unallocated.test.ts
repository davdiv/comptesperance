import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import Unallocated from '../../routes/projects/unallocated/+page.svelte';
import { m } from '#lib/paraglide/messages.js';
import { formatMoney } from '#lib/format.ts';
it('links to allocation editing only in edit mode', () => {
	for (const canWrite of [false, true]) {
		const html = render(Unallocated, {
			props: {
				data: {
					includeTransfers: false,
					incoming_cents: 1000,
					outgoing_cents: 0,
					total_cents: 1000,
					transaction_count: 1,
					by_account: [
						{
							account_id: 'cash',
							account_name: 'Cash',
							amount_cents: 1000,
							incoming_cents: 1300,
							outgoing_cents: -300,
							count: 987654
						}
					],
					transactions: [
						{
							account_id: 'cash',
							account_name: 'Cash',
							id: 'sale',
							label: 'Sale',
							date: '2026-10-01',
							amount_cents: 2000,
							unallocated_cents: 1000
						}
					],
					user: { canWrite }
				}
			} as never
		}).body;
		expect(html.includes('href="/transactions/cash/sale#allocations"')).toBe(canWrite);
		expect(html).toContain('Sale');
		expect(html).toContain('href="/accounts/cash"');
		expect(html).toContain(m.account_incoming());
		expect(html).toContain(m.account_outgoing());
		expect(html).toContain(formatMoney(1300));
		expect(html).toContain(formatMoney(-300));
		expect(html).not.toContain('987654');
	}
});
