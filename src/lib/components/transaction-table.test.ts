import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import { formatMoney } from '#lib/format.ts';
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

it('shows project names without allocation amounts or hints when fully allocated', () => {
	for (const allocations of [
		[{ project_id: 'p', project_name: 'Project', amount_cents: 1000 }],
		[
			{ project_id: 'p', project_name: 'Project', amount_cents: 400 },
			{ project_id: 'q', project_name: 'Other project', amount_cents: 600 }
		]
	]) {
		const html = render(TransactionTable, {
			props: { transactions: [{ ...row, allocation_details: allocations }] }
		}).body;
		expect(html).toContain('href="/projects/p"');
		expect(html).toContain('Project');
		expect(html).not.toContain('Unallocated:');
		expect(html).not.toContain('· ');
	}
});
it('omits hints on fully unallocated and zero-amount rows, including excluded and orphan-only rows', () => {
	for (const [amount, excluded] of [
		[1000, false],
		[-1000, false],
		[1000, true],
		[0, false]
	] as const) {
		const html = render(TransactionTable, {
			props: { transactions: [{ ...row, amount_cents: amount, excluded }] }
		}).body;
		expect(html).not.toContain('Unallocated:');
		expect(html).not.toContain('data-filter="allocation_status"');
	}
	const orphan = render(TransactionTable, {
		props: {
			transactions: [
				{
					...row,
					allocation_details: [{ project_id: 'missing', project_name: null, amount_cents: 1000 }]
				}
			]
		}
	}).body;
	expect(orphan).not.toContain('Unallocated:');
	expect(orphan).not.toContain('· ');
});
it('shows amounts and a clickable remainder only for partially allocated rows in either perspective', () => {
	for (const [amount, allocated, remainder, excluded] of [
		[1000, 400, 600, false],
		[-1000, -400, -600, false],
		[1000, 400, 600, true]
	] as const) {
		const html = render(TransactionTable, {
			props: {
				transactions: [
					{
						...row,
						amount_cents: amount,
						excluded,
						allocation_details: [
							{ project_id: 'p', project_name: 'Project', amount_cents: allocated }
						]
					}
				],
				filterUrl: '/transactions?search=sale&offset=5'
			}
		}).body;
		expect(html).toContain('· ' + formatMoney(allocated));
		expect(html).toContain('Unallocated: ' + formatMoney(remainder));
		expect(html).toContain('href="/transactions?search=sale&amp;allocation_status=partial"');
	}
});
