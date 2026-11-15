import { beforeEach, expect, it, vi } from 'vitest';
import {
	listAccountsWithTotals,
	listIssues,
	listTransferGroups,
	type TransactionView
} from './queries';
import { calculateBalance } from './balances';
import { summarizeTransferGroup } from './transfer-groups';
import { listWarnings } from './warnings';
import { load } from '../../routes/warnings/+page.server';
import { render } from 'svelte/server';
import Warnings from '../../routes/warnings/+page.svelte';

vi.mock('./queries', () => ({
	listAccountsWithTotals: vi.fn(),
	listIssues: vi.fn(),
	listTransferGroups: vi.fn()
}));
beforeEach(() => {
	vi.resetAllMocks();
	vi.mocked(listAccountsWithTotals).mockResolvedValue([]);
	vi.mocked(listTransferGroups).mockResolvedValue([]);
	vi.mocked(listIssues).mockResolvedValue([]);
});

function group(id: string, incoming = 100, differentProjects = false) {
	return summarizeTransferGroup(
		id,
		['a', 'b'].map((account_id, i) => ({
			id: `${id}-${i}`,
			account_id,
			amount_cents: i ? incoming : -100,
			allocations: [
				{
					project_id: differentProjects && i ? 'other' : 'project',
					amount_cents: i ? incoming : -100
				}
			],
			allocation_details: []
		})) as unknown as TransactionView[]
	);
}

it('aggregates every existing warning type, excluding ignored/valid checkpoints and balanced transfers', async () => {
	vi.mocked(listAccountsWithTotals).mockResolvedValue([
		{
			account_id: 'a',
			name: 'Cash',
			...calculateBalance(
				[
					{ id: 'latest', date: '2026-11-03', balance_cents: 10000, source: 'manual' },
					{ id: 'earlier', date: '2026-11-02', balance_cents: 8000, source: 'manual' },
					{
						id: 'ignored',
						date: '2026-11-01',
						balance_cents: 0,
						source: 'statement',
						ignored: true
					}
				],
				[]
			)
		},
		{ account_id: 'b', name: 'Bank', checkpoints: [] }
	] as never);
	vi.mocked(listTransferGroups).mockResolvedValue([
		group('healthy'),
		group('broken', 80),
		group('different-projects', 100, true)
	]);
	vi.mocked(listIssues).mockResolvedValue([
		{ id: 1, account_id: 'a', source_file: 'statement.csv', message: 'Unsupported CSV format.' },
		{ id: 2, account_id: null, source_file: null, message: 'Import error' }
	]);
	const warnings = await listWarnings();
	expect(warnings).toHaveLength(7);
	expect(warnings.filter((item) => item.kind === 'transfer_balance')).toMatchObject([
		{ subject: 'Cash ↔ Bank', difference_cents: -20 }
	]);
	expect(warnings.filter((item) => item.kind === 'transfer_allocations')).toHaveLength(3);
	expect(warnings.filter((item) => item.kind === 'checkpoint')).toEqual([
		{
			id: 'checkpoint:a:earlier',
			kind: 'checkpoint',
			subject: 'Cash',
			href: '/accounts/a?checkpoint=earlier#checkpoints',
			date: '2026-11-02',
			difference_cents: -2000,
			detail: undefined
		}
	]);
	expect(warnings.find((item) => item.id === 'import:1')).toMatchObject({
		href: '/accounts/a#account-issues',
		detail: 'statement.csv · Unsupported CSV format.'
	});
	expect(warnings.find((item) => item.id === 'import:2')?.href).toBe('/import');
	expect(warnings.some((item) => item.id.includes('healthy'))).toBe(false);
	expect(new Set(warnings.map((item) => item.id)).size).toBe(warnings.length);
});

it('reports no warnings for reconciled data', async () => {
	vi.mocked(listTransferGroups).mockResolvedValue([group('healthy')]);
	expect(await listWarnings()).toEqual([]);
	const data = await load({ url: new URL('http://localhost/warnings') } as never);
	const html = render(Warnings, { props: { data } as never }).body;
	expect(html).toContain('No warnings found.');
	expect(html).not.toContain('<article');
});

it('paginates the complete warning list with stale-page recovery and escapes imported text', async () => {
	vi.mocked(listIssues).mockResolvedValue(
		Array.from({ length: 115 }, (_, id) => ({
			id,
			account_id: null,
			source_file: null,
			message: '<script>unsafe</script>'
		}))
	);
	const page = async (query = '') =>
		(await load({ url: new URL('http://localhost/warnings?' + query) } as never)) as Awaited<
			ReturnType<typeof load>
		> & { rows: unknown[]; total: number; offset: number };
	expect((await page()).rows).toHaveLength(50);
	expect((await page('limit=25&offset=25')).rows).toHaveLength(25);
	const last = await page('offset=999');
	expect(last).toMatchObject({ total: 115, offset: 100 });
	expect(last.rows).toHaveLength(15);
	const html = render(Warnings, { props: { data: last } as never }).body;
	expect(html).not.toContain('<script>unsafe');
	expect(html).toContain('&lt;script>unsafe&lt;/script>');
	expect(html).toContain('aria-label="Warnings"');
	expect(html.match(/<article/g)).toHaveLength(15);
});
