import { render } from 'svelte/server';
import { expect, it, vi } from 'vitest';
import Dashboard from '../../routes/+page.svelte';
import { load } from '../../routes/+page.server';
import {
	listAccountsWithTotals,
	listProjectsWithTotals,
	listTransactions
} from '#lib/server/queries.ts';

vi.mock('#lib/server/queries.ts', () => ({
	listAccountsWithTotals: vi.fn().mockResolvedValue([]),
	listProjectsWithTotals: vi.fn().mockResolvedValue([]),
	listTransactions: vi.fn()
}));

it('loads only dashboard summaries, ignoring transaction filters and pagination', async () => {
	expect(
		await load({ url: new URL('http://localhost/?search=hidden&offset=999') } as never)
	).toEqual({ accounts: [], projects: [] });
	expect(listAccountsWithTotals).toHaveBeenCalledWith();
	expect(listProjectsWithTotals).toHaveBeenCalledWith();
	expect(listTransactions).not.toHaveBeenCalled();
});

it('renders overview cards with a transactions shortcut, without transaction rows or filters', () => {
	const html = render(Dashboard, { props: { data: { accounts: [], projects: [] } } as never }).body;
	expect(html).toContain('href="/transactions"');
	for (const markup of ['<table', '<form', '<input', '/transactions/cash/'])
		expect(html).not.toContain(markup);
});
