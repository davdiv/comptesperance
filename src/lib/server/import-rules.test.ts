import { expect, it } from 'vitest';
import type { DataConfig, ImportRule, ParsedTransaction, ThirdParty, Project } from '#lib/types.ts';
import { matchesImportRule, resolveImport } from './import-rules';

const transaction: ParsedTransaction = {
	id: 't',
	raw: [],
	date: '2026-01-01',
	label: 'Virement École 42',
	description: 'Café contribution',
	record_type: 'virement',
	amount_cents: 1200,
	excluded: false
};
const rule = (
	conditions: ImportRule['conditions'] = { text: 'ecole' },
	set: ImportRule['set'] = { category_id: 'income' }
): ImportRule => ({ id: 'r', name: 'School', conditions, set });
const parties = [
	{ id: 'z', name: 'Zed', aliases: ['ecole'] },
	{ id: 'a', name: 'Alpha', aliases: ['CAFE'] }
] as ThirdParty[];
const projects = [{ id: 'p', name: 'Project' }] as Project[];
const config: DataConfig = {
	app: { name: 'Test' },
	rules: [],
	categories: [
		{ id: 'income', name: 'Income', kind: 'income' },
		{ id: 'archived', name: 'Archived', kind: 'income', archived: true }
	],
	paymentModes: [
		{ id: 'virement', name: 'Transfer' },
		{ id: 'cash', name: 'Cash' }
	]
};
it.each([
	[{ text: 'ÉCOLE' }, true],
	[{ text: 'CAFE' }, true],
	[{ text: 'absent' }, false],
	[{ pattern: 'école \\d+' }, true],
	[{ pattern: '^café' }, true],
	[{ pattern: 'nonexistent' }, false],
	[{ account_id: 'a' }, true],
	[{ account_id: 'b' }, false],
	[{ direction: 'in' }, true],
	[{ direction: 'out' }, false],
	[{ min_cents: 1200, max_cents: 1200 }, true],
	[{ min_cents: 1201 }, false],
	[{ max_cents: 1199 }, false],
	[{ format: 'ccp' }, true],
	[{ format: 'sumup' }, false],
	[{ record_type: 'virement' }, true],
	[{ record_type: 'fee' }, false],
	[{}, false],
	[{ text: 'ecole', account_id: 'b' }, false]
] as [ImportRule['conditions'], boolean][])(
	'matches every present condition: %j',
	(conditions, result) => {
		expect(matchesImportRule(rule(conditions), transaction, 'a', 'ccp')).toBe(result);
	}
);
it('matches absolute amounts, excludes zero from directions and skips disabled rules', () => {
	expect(
		matchesImportRule(
			rule({ min_cents: 1200, direction: 'out' }),
			{ ...transaction, amount_cents: -1200 },
			'a',
			'ccp'
		)
	).toBe(true);
	expect(
		matchesImportRule(rule({ direction: 'in' }), { ...transaction, amount_cents: 0 }, 'a', 'ccp')
	).toBe(false);
	expect(matchesImportRule({ ...rule(), enabled: false }, transaction, 'a', 'ccp')).toBe(false);
});
it('resolves first wins per field, skipping disabled, archived and missing targets', () => {
	const rules = [
		{ ...rule(), enabled: false },
		rule(
			{ text: 'ecole' },
			{
				category_id: 'archived',
				third_party_id: 'missing',
				payment_mode_id: 'missing',
				project_id: 'missing'
			}
		),
		rule(),
		{
			...rule(
				{ text: 'cafe' },
				{
					category_id: 'archived',
					third_party_id: 'z',
					payment_mode_id: 'cash',
					excluded: true,
					project_id: 'p'
				}
			),
			id: 'later',
			name: 'Later'
		}
	];
	const result = resolveImport(
		transaction,
		{},
		'a',
		'ccp',
		{ ...config, rules },
		parties,
		projects
	);
	expect(result.values).toEqual({
		category_id: 'income',
		third_party_id: 'z',
		payment_mode_id: 'cash',
		excluded: true
	});
	expect(result.sources.category_id).toEqual({ source: 'rule', rule_id: 'r', rule_name: 'School' });
	expect(result.sources.third_party_id.rule_id).toBe('later');
	expect(result.suggested_project_id).toBe('p');
});
it('explicit empty values beat rules, including null and false; explicit allocations suppress suggestions', () => {
	const result = resolveImport(
		transaction,
		{
			category_id: '',
			payment_mode_id: '',
			third_party_id: null,
			excluded: false,
			allocations: []
		},
		'a',
		'ccp',
		{
			...config,
			rules: [
				rule(
					{ text: 'ecole' },
					{
						category_id: 'income',
						payment_mode_id: 'cash',
						third_party_id: 'z',
						excluded: true,
						project_id: 'p'
					}
				)
			]
		},
		parties,
		projects
	);
	expect(result.values).toEqual({
		category_id: '',
		payment_mode_id: '',
		third_party_id: null,
		excluded: false
	});
	expect(Object.values(result.sources).every((source) => source.source === 'explicit')).toBe(true);
	expect(result.suggested_project_id).toBeNull();
});

it('does not suggest a project for zero-amount CSV transactions', () => {
	const result = resolveImport(
		{ ...transaction, amount_cents: 0 },
		{},
		'a',
		'ccp',
		{ ...config, rules: [rule({ text: 'ecole' }, { project_id: 'p', category_id: 'income' })] },
		parties,
		projects
	);
	expect(result.suggested_project_id).toBeNull();
	expect(result.suggested_project_rule).toBeNull();
	expect(result.values.category_id).toBe('income');
});
it('uses name-ordered aliases then built-in guesses and none', () => {
	const result = resolveImport(transaction, {}, 'a', 'ccp', config, parties, projects);
	expect(result.values).toEqual({
		category_id: '',
		payment_mode_id: 'virement',
		third_party_id: 'a',
		excluded: false
	});
	expect(result.sources).toEqual({
		category_id: { source: 'none' },
		payment_mode_id: { source: 'guess' },
		third_party_id: { source: 'alias' },
		excluded: { source: 'guess' }
	});
});
