import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import FinancialSummary from './FinancialSummary.svelte';
import { m } from '#lib/paraglide/messages.js';
import { formatMoney } from '#lib/format.ts';

it('shares account-style signed totals, tones and responsive layout', () => {
	const html = render(FinancialSummary, {
		props: { total: -500, incoming: 1000, outgoing: -1500, totalLabel: m.project_total() }
	}).body;
	for (const value of [
		m.project_total(),
		m.account_incoming(),
		m.account_outgoing(),
		formatMoney(-500),
		formatMoney(1000),
		formatMoney(-1500),
		'text-red-700',
		'text-emerald-700',
		'sm:grid-cols-2 lg:grid-cols-4'
	])
		expect(html).toContain(value);
});

it('supports zero totals and preserves the unallocated page card order', () => {
	const html = render(FinancialSummary, {
		props: {
			total: 0,
			incoming: 0,
			outgoing: 0,
			totalLabel: m.unallocated_net(),
			totalLast: true,
			class: 'grid gap-4 sm:grid-cols-3'
		}
	}).body;
	expect(html).toContain(formatMoney(0));
	expect(html).not.toContain(m.common_transfers());
	expect(html).toContain('text-brand-700');
	expect(html.indexOf(m.account_incoming())).toBeLessThan(html.indexOf(m.account_outgoing()));
	expect(html.indexOf(m.account_outgoing())).toBeLessThan(html.indexOf(m.unallocated_net()));
});

it('shows a non-zero optional transfer card', () => {
	const html = render(FinancialSummary, {
		props: { total: 500, incoming: 0, outgoing: 0, transfers: 500, totalLabel: m.project_total() }
	}).body;
	expect(html).toContain(m.common_transfers());
	expect(html).toContain(formatMoney(500));
});
