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
it('shows linked allocation chips and non-zero remainders with or without allocations', () => {
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

it('shows non-zero unallocated amounts, including excluded rows, and never a zero remainder', () => {
	for (const [amount, excluded] of [
		[1000, false],
		[-1000, false],
		[1000, true],
		[0, false]
	] as const) {
		const html = render(TransactionTable, {
			props: {
				transactions: [{ ...row, amount_cents: amount, excluded }],
				filterUrl: '/transactions?search=sale&offset=5'
			}
		}).body;
		if (amount === 0) expect(html).not.toContain('data-filter="allocation_status"');
		else {
			expect(html).toContain('href="/transactions?search=sale&amp;allocation_status=unallocated"');
			expect(html).toContain('Unallocated: ' + formatMoney(amount));
		}
	}
	const partial = render(TransactionTable, {
		props: {
			transactions: [
				{
					...row,
					amount_cents: -1000,
					allocation_details: [{ project_id: 'p', project_name: 'Project', amount_cents: -400 }]
				}
			]
		}
	}).body;
	expect(partial).toContain('allocation_status=partial');
	expect(partial).toContain('Unallocated: ' + formatMoney(-600));
	const full = render(TransactionTable, {
		props: {
			transactions: [
				{
					...row,
					allocation_details: [{ project_id: 'p', project_name: 'Project', amount_cents: 1000 }]
				}
			]
		}
	}).body;
	expect(full).not.toContain('data-filter="allocation_status"');
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
	expect(orphan).toContain('allocation_status=unallocated');
	expect(orphan).toContain('Unallocated: ' + formatMoney(1000));
});
