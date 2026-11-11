import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import type { TransactionView } from '#lib/server/queries.ts';
import { summarizeTransferGroup } from '#lib/server/transfer-groups.ts';
import TransferGroupCard from './TransferGroupCard.svelte';
import TransferGroupSuggestion from './TransferGroupSuggestion.svelte';
const members = [
	{
		id: 'sale',
		account_id: 'a',
		date: '2026-10-01',
		label: 'Outgoing',
		amount_cents: -100,
		allocations: [{ project_id: 'p', amount_cents: -50 }],
		allocation_details: []
	},
	{
		id: 'credit',
		account_id: 'b',
		date: '2026-10-01',
		label: 'Incoming',
		amount_cents: 100,
		allocations: [],
		allocation_details: []
	}
] as unknown as TransactionView[];
it('renders linked group members, allocation warnings and writer-only removal controls', () => {
	const group = summarizeTransferGroup('g', members);
	const props = { group, accountNames: { a: 'Cash', b: 'Bank' } };
	const reader = render(TransferGroupCard, { props }).body;
	expect(reader).toContain('/transactions/a/sale');
	expect(reader).toContain('/projects/p');
	expect(reader).not.toContain('<form');
	expect(reader).toContain('text-amber-800');
	const writer = render(TransferGroupCard, { props: { ...props, canWrite: true } }).body;
	expect(writer).toContain('?/unlink_transfer');
	expect(writer).toContain('value="a:sale"');
	expect(
		render(TransferGroupCard, { props: { ...props, group: summarizeTransferGroup('empty', []) } })
			.body
	).not.toContain('/transactions/');
});
it('renders every suggested group member with writer-only one-click linking', () => {
	const props = {
		suggestion: { key: 'key', reference: 'PID9000007', members },
		accountNames: { a: 'Cash', b: 'Bank' }
	};
	expect(render(TransferGroupSuggestion, { props }).body).not.toContain('<form');
	const writer = render(TransferGroupSuggestion, { props: { ...props, canWrite: true } }).body;
	expect(writer).toContain('/transactions/b/credit');
	expect(writer).toContain('PID9000007');
	expect(writer).toContain('name="suggestion_key"');
});
