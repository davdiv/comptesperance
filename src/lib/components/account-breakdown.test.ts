import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import AccountBreakdown from './AccountBreakdown.svelte';
import { m } from '#lib/paraglide/messages.js';
import { formatMoney } from '#lib/format.ts';

it('shows account income, expenses and net with shared styling, including net-zero accounts', () => {
	const html = render(AccountBreakdown, {
		props: {
			accounts: [
				{
					account_id: 'cash',
					account_name: 'Cash',
					incoming_cents: 10000,
					outgoing_cents: -10000,
					transfer_cents: 500,
					amount_cents: 0
				}
			]
		}
	}).body;
	for (const text of [
		'href="/accounts/cash"',
		'Cash',
		m.account_incoming(),
		m.account_outgoing(),
		m.common_transfers(),
		formatMoney(500),
		formatMoney(10000),
		formatMoney(-10000),
		formatMoney(0),
		'text-emerald-700',
		'text-right font-medium tabular-nums'
	])
		expect(html).toContain(text);
	expect(html.indexOf(m.account_incoming())).toBeLessThan(html.indexOf(m.account_outgoing()));
	expect(html.indexOf(m.account_outgoing())).toBeLessThan(html.indexOf(m.common_transfers()));
});

it('preserves project and unallocated empty messages without rows', () => {
	expect(render(AccountBreakdown, { props: { accounts: [] } }).body).toContain(
		m.project_no_allocations()
	);
	const empty = render(AccountBreakdown, {
		props: { accounts: [], emptyMessage: m.empty_state() }
	}).body;
	expect(empty).toContain(m.empty_state());
	expect(empty).not.toContain('href="/accounts/');
});

it('falls back to the account id when the display name is missing', () => {
	const html = render(AccountBreakdown, {
		props: {
			accounts: [
				{
					account_id: 'missing',
					account_name: null,
					incoming_cents: 0,
					outgoing_cents: -500,
					amount_cents: -500
				}
			]
		}
	}).body;
	expect(html).toContain('href="/accounts/missing"');
	expect(html).toContain('missing</a>');
	expect(html).toContain(formatMoney(-500));
});
