import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import { formatMoney } from '$lib/format';
import TransactionTable from './TransactionTable.svelte';
const row = {
	id: 'sale',
	account_id: 'cash',
	date: '2026-10-03',
	label: 'Sale',
	description: 'A long CSV description',
	amount_cents: 1000
};
it('shows a distinct, clamped description with its complete text in a title', () => {
	const html = render(TransactionTable, { props: { transactions: [row] } }).body;
	expect(html).toContain('line-clamp-2');
	expect(html).toContain('title="A long CSV description"');
	for (const description of ['', 'Sale', ' Sale ']) {
		expect(
			render(TransactionTable, { props: { transactions: [{ ...row, description }] } }).body
		).not.toContain('line-clamp-2');
	}
});
it('shows linked allocation chips and a remainder only for partial allocations', () => {
	const html = render(TransactionTable, {
		props: {
			transactions: [
				{
					...row,
					allocation_details: [{ project_id: 'p', project_name: 'Project name', amount_cents: 400 }]
				}
			]
		}
	}).body;
	expect(html).toContain('href="/projects/p"');
	expect(html).toContain('Project name');
	expect(html).toContain(formatMoney(600));
	const full = render(TransactionTable, {
		props: {
			transactions: [
				{
					...row,
					allocation_details: [
						{ project_id: 'p', project_name: 'Project name', amount_cents: 1000 }
					]
				}
			]
		}
	}).body;
	expect(full).not.toContain('· ');
	const empty = render(TransactionTable, { props: { transactions: [row] } }).body;
	expect(empty).not.toContain('/projects/');
});
