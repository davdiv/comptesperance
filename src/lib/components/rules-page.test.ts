import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import RulesPage from '../../routes/settings/rules/+page.svelte';
import RuleEditor from './RuleEditor.svelte';
import type { RuleOptions } from '#lib/rule-display.ts';
import { ruleConditionsSummary, ruleSetSummary } from '#lib/rule-display.ts';
import type { ImportRule } from '#lib/types.ts';

const options: RuleOptions = {
	accounts: [{ id: 'a', name: 'CCP', source: 'csv' }],
	categories: [{ id: 'income', name: 'Income', kind: 'income' }],
	paymentModes: [],
	thirdParties: [],
	projects: []
};
const rule: ImportRule = {
	id: 'receipts',
	name: 'Receipts',
	conditions: {
		text: 'VERSEMENT',
		pattern: 'VRST',
		account_id: 'a',
		direction: 'in',
		min_cents: 0,
		max_cents: 12000,
		format: 'ccp',
		record_type: 'credit'
	},
	set: { category_id: 'income', excluded: false }
};

it('renders anchored ordered rules, conditions, outputs, match counts and edit controls only in edit mode', () => {
	for (const canWrite of [false, true]) {
		const html = render(RulesPage, {
			props: {
				data: { rules: [{ ...rule, matchCount: 3 }], options, editor: null, user: { canWrite } },
				form: null
			} as never
		}).body;
		expect(html).toContain('id="receipts"');
		expect(html).toContain('Receipts');
		expect(html).toContain(m.rules_matches({ count: 3 }));
		expect(html).toContain('Income');
		expect(html.includes('action="?/move"')).toBe(canWrite);
		expect(html.includes('action="?/toggle"')).toBe(canWrite);
		expect(html.includes('action="?/delete"')).toBe(canWrite);
		expect(html.includes('?edit=receipts#editor')).toBe(canWrite);
		if (!canWrite) expect(html).not.toMatch(/<(form|input|select|button)\b/);
	}
});

it('handles empty lists and renders preview changes and explicit-value protection', () => {
	expect(
		render(RulesPage, {
			props: {
				data: { rules: [], options, editor: null, user: { canWrite: false } },
				form: null
			} as never
		}).body
	).toContain(m.rules_empty());
	const html = render(RuleEditor, {
		props: {
			draft: rule,
			options,
			preview: {
				count: 1,
				rows: [
					{
						id: 't',
						account_id: 'a',
						account_name: 'CCP',
						date: '2026-01-01',
						label: 'VERSEMENT',
						amount_cents: 12000,
						changes: [
							{ field: 'category_id', before: '', after: 'income', explicit: false },
							{ field: 'excluded', before: false, after: false, explicit: true }
						]
					}
				]
			}
		}
	}).body;
	expect(html).toContain(m.rules_matches({ count: 1 }));
	expect(html).toContain(m.rules_explicit_unchanged());
	expect(html).toContain('→ <strong>Income</strong>');
	expect(html).toContain('href="/transactions/a/t"');
	expect(html).toContain('formaction="?/preview#preview"');
});

it('summarizes every supported condition and output in readable labels', () => {
	const conditions = ruleConditionsSummary(rule, options);
	for (const text of ['VERSEMENT', 'VRST', 'CCP', 'credit', '120', '0', m.account_incoming()])
		expect(conditions).toContain(text);
	expect(ruleSetSummary(rule, options)).toContain('Income');
	expect(ruleSetSummary(rule, options)).toContain(m.rules_no());
});
