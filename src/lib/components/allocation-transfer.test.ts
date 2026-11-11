import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import AllocationEditor from './AllocationEditor.svelte';
import TransferSuggestion from './TransferSuggestion.svelte';
it('renders inline amount and note values with separate save and remove operations', () => {
	const html = render(AllocationEditor, {
		props: {
			accountId: 'cash',
			transactionId: 'sale',
			projectId: 'project',
			amount: -1234,
			note: 'Note'
		}
	}).body;
	expect(html).toContain('value="-12.34"');
	expect(html).toContain('value="Note"');
	expect(html).toContain('value="save"');
	expect(html).toContain('value="remove"');
	expect(html).toContain('formnovalidate');
});
it('shows a strong-match reference and amount warning, but no form to readers', () => {
	const first = {
		account_id: 'cash',
		id: 'out',
		date: '2026-10-01',
		amount_cents: -100,
		label: 'Outgoing'
	};
	const match = {
		transaction: { ...first, account_id: 'bank', id: 'in', amount_cents: 200, label: 'Incoming' },
		strong: true,
		reference: 'PID9000007',
		days: 0,
		difference_cents: 100
	};
	const props = {
		first,
		match,
		accountNames: { bank: 'Bank' },
		action: '?/link_transfer',
		canWrite: false
	};
	const html = render(TransferSuggestion, { props }).body;
	expect(html).toContain('PID9000007');
	expect(html).toContain('text-amber-800');
	expect(html).not.toContain('<form');
	const writer = render(TransferSuggestion, { props: { ...props, canWrite: true } }).body;
	expect(writer).toContain('value="bank:in"');
	expect(writer).toContain('action="?/link_transfer"');
});
