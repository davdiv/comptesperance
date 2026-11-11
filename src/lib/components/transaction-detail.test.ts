import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import TransactionDetail from '../../routes/transactions/[account_id]/[id]/+page.svelte';
it('titles grouped transactions Transfer rather than Link transfer', () => {
	const transaction = {
		id: 'one',
		account_id: 'a',
		date: '2026-10-01',
		label: 'Sale',
		source: 'csv',
		sources: Object.fromEntries(
			['third_party_id', 'category_id', 'payment_mode_id', 'excluded'].map((field) => [
				field,
				{ source: 'guess' }
			])
		),
		amount_cents: 100,
		allocations: [],
		evidence: [],
		raw: []
	};
	const base = {
		transaction,
		account: { account_id: 'a', name: 'Cash', source: 'csv' },
		config: { categories: [], paymentModes: [] },
		projects: [],
		thirdParties: [],
		accounts: [],
		documents: [],
		user: { canWrite: false },
		groupSuggestions: [],
		suggestion: null,
		sumupLinks: null
	};
	for (const group of [
		null,
		{
			id: 'g',
			members: [],
			total_cents: 0,
			balanced: true,
			allocations_balanced: true,
			project_totals: []
		}
	]) {
		const html = render(TransactionDetail, {
			props: { data: { ...base, group }, form: null } as never
		}).body;
		const expected = group ? m.transfer_group_title() : m.transaction_link_transfer();
		const rejected = group ? m.transaction_link_transfer() : m.transfer_group_title();
		expect(html).toContain('class="card-title">' + expected);
		expect(html).not.toContain('class="card-title">' + rejected + '</h2>');
	}
});
it('ignores orphan allocations in the add-form remainder and exposes removal only to writers', () => {
	for (const canWrite of [false, true]) {
		const html = render(TransactionDetail, {
			props: {
				data: {
					transaction: {
						id: 'sale',
						account_id: 'cash',
						date: '2026-10-03',
						label: 'Sale',
						source: 'csv',
						sources: Object.fromEntries(
							['third_party_id', 'category_id', 'payment_mode_id', 'excluded'].map((field) => [
								field,
								{ source: 'guess' }
							])
						),
						amount_cents: 10000,
						allocations: [
							{ project_id: 'active', amount_cents: 2000 },
							{ project_id: 'gone', amount_cents: 8000, note: 'Old allocation' }
						],
						evidence: [],
						raw: []
					},
					account: { account_id: 'cash', name: 'Cash', source: 'csv' },
					config: { categories: [], paymentModes: [] },
					projects: [
						{ id: 'active', name: 'Active project' },
						{ id: 'available', name: 'Available project' }
					],
					accounts: [],
					documents: [],
					thirdParties: [],
					candidates: [],
					user: { canWrite },
					groupSuggestions: [],
					suggestion: null,
					group: null,
					sumupLinks: null
				},
				form: null
			} as never
		}).body;
		expect(html).toContain(m.allocation_deleted_project());
		expect(html).toContain('Old allocation');
		expect(html).not.toContain('href="/projects/gone"');
		expect(html.includes('action="?/add_project_allocation"')).toBe(canWrite);
		expect(html.includes('value="80.00"')).toBe(canWrite);
		expect(html.includes('name="project_id" value="gone"')).toBe(canWrite);
	}
});

it('places hints under edit fields with independent reset forms, or by read-only Details values', () => {
	for (const canWrite of [false, true]) {
		const html = render(TransactionDetail, {
			props: {
				data: {
					transaction: {
						id: 't',
						account_id: 'a',
						date: '2026-01-01',
						label: 'CSV receipt',
						source: 'csv',
						amount_cents: 12000,
						category_id: 'income',
						payment_mode_id: '',
						excluded: false,
						allocations: [],
						evidence: [],
						raw: [],
						suggested_project_id: 'p',
						suggested_project_rule: { source: 'rule', rule_name: 'Receipts' },
						sources: {
							category_id: { source: 'explicit' },
							payment_mode_id: { source: 'rule', rule_id: 'r', rule_name: 'Receipts' },
							third_party_id: { source: 'alias' },
							excluded: { source: 'guess' }
						}
					},
					account: { account_id: 'a', name: 'Account', source: 'csv' },
					config: { categories: [{ id: 'income', name: 'Income' }], paymentModes: [] },
					projects: [{ id: 'p', name: 'Project' }],
					accounts: [],
					documents: [],
					thirdParties: [],
					candidates: [],
					user: { canWrite },
					groupSuggestions: [],
					suggestion: null,
					group: null,
					sumupLinks: null
				},
				form: null
			} as never
		}).body;
		expect(html).toContain(m.import_source_alias());
		expect(html).toContain(m.import_source_guess());
		expect(html).toContain(m.import_source_explicit());
		expect(html).toContain('href="/settings/rules#r"');
		expect(html.includes(m.rules_from_transaction())).toBe(canWrite);
		expect(html.includes(m.import_reset())).toBe(canWrite);
		if (canWrite) {
			const edit = html.match(/<form method="POST" action="\?\/save"[\s\S]*?<\/form>/)![0];
			expect(edit).toContain('form="reset-category_id"');
			expect(edit.match(/<form\b/g)).toHaveLength(1);
			expect(edit).not.toContain(
				m.import_project_suggestion({ rule: 'Receipts', project: 'Project' })
			);
			expect(html.slice(html.indexOf('id="allocations"'))).toContain(
				m.import_project_suggestion({ rule: 'Receipts', project: 'Project' })
			);
		} else {
			expect(html).not.toContain('action="?/reset_automatic"');
			expect(html.match(/<dl[\s\S]*?<\/dl>/)![0]).toContain(m.import_source_explicit());
		}
	}
});
