import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import TransfersPage from '../../routes/transfers/+page.svelte';
const group = {
	id: 'g',
	balanced: true,
	allocations_balanced: true,
	total_cents: 0,
	project_totals: [],
	members: [
		{ account_id: 'a', id: 'one', label: 'First', date: '2026-10-01', amount_cents: 100 },
		{ account_id: 'b', id: 'two', label: 'Second', date: '2026-10-01', amount_cents: -100 }
	]
};
it('shows member removal on the transfers page only for writers', () => {
	for (const canWrite of [false, true]) {
		const html = render(TransfersPage, {
			props: {
				data: { groups: [group], suggestions: [], pool: [], accounts: [], user: { canWrite } },
				form: null
			} as never
		}).body;
		expect(html.includes('action="?/unlink_transfer"')).toBe(canWrite);
	}
});
