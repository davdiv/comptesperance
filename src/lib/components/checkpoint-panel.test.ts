import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import CheckpointPanel from './CheckpointPanel.svelte';
import { calculateBalance } from '#lib/server/balances.ts';
const checkpoints = calculateBalance(
	[
		{
			id: 'statement:file.csv',
			date: '2026-10-02',
			balance_cents: 1000,
			source: 'statement',
			statement_file: 'file.csv'
		},
		{ id: 'manual', date: '2026-10-01', balance_cents: 900, source: 'manual' }
	],
	[]
).checkpoints;
it('shows checkpoints and differences but no forms for readers', () => {
	const html = render(CheckpointPanel, { props: { checkpoints, canWrite: false } }).body;
	expect(html).toContain('file.csv');
	expect(html).toContain('badge-amber');
	expect(html).not.toContain('<form');
});
it('shows add and manual-only delete forms for writers', () => {
	const html = render(CheckpointPanel, { props: { checkpoints, canWrite: true } }).body;
	expect(html).toContain('?/add_checkpoint');
	expect(html.match(/action="\?\/delete_checkpoint"/g)).toHaveLength(1);
	expect(html).toContain('value="manual"');
	expect(html).not.toContain('value="statement:file.csv"');
});
it('shows an empty state without checkpoints', () => {
	const html = render(CheckpointPanel, { props: { checkpoints: [], canWrite: false } }).body;
	expect(html).not.toContain('<table');
	expect(html).not.toContain('<form');
});
