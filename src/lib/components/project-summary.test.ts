import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import ProjectPage from '../../routes/projects/[id]/+page.svelte';
import { m } from '#lib/paraglide/messages.js';
import { formatMoney } from '#lib/format.ts';

function project(empty = false, error?: string) {
	return render(ProjectPage, {
		props: {
			data: {
				project: { id: 'p', name: 'Mixed project' },
				total_cents: empty ? 0 : 7000,
				incoming_cents: empty ? 0 : 10000,
				outgoing_cents: empty ? 0 : -3000,
				by_account: empty
					? []
					: [
							{
								account_id: 'cash',
								account_name: 'Cash',
								amount_cents: 7000,
								incoming_cents: 10000,
								outgoing_cents: -3000,
								count: 987654
							}
						],
				allocations: [],
				transactions: [],
				filters: {},
				filterOptions: { accounts: [], thirdParties: [], projects: [] },
				config: { categories: [], paymentModes: [] },
				filterUrl: '/projects/p',
				fixedFilters: { project_id: 'p' },
				user: { canWrite: false },
				transaction_count: 2,
				hidden_transfer_count: 2
			},
			form: error ? { error } : null
		} as never
	}).body;
}

it('shows project and account income, expenses and net even with all transfer rows hidden', () => {
	const html = project();
	for (const text of [
		m.project_total(),
		m.account_incoming(),
		m.account_outgoing(),
		formatMoney(10000),
		formatMoney(-3000),
		formatMoney(7000),
		'Cash',
		'href="/accounts/cash"'
	])
		expect(html).toContain(text);
	for (const amount of [10000, -3000, 7000])
		expect(html.split(formatMoney(amount))).toHaveLength(3);
	expect(html).not.toContain('987654');
});

it('renders zero totals and the account empty state for an empty project', () => {
	const html = project(true);
	expect(html).toContain(formatMoney(0));
	expect(html).toContain(m.project_no_allocations());
	expect(html).not.toContain('href="/accounts/cash"');
});

it('preserves error feedback alongside the totals', () => {
	expect(project(false, 'Update failed')).toContain('Update failed');
});
