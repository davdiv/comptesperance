import type {
	ClassificationField,
	DataConfig,
	FieldSource,
	ImportRule,
	ParsedTransaction,
	Project,
	ThirdParty,
	TransactionAnnotation
} from '#lib/types.ts';
import { guessPaymentMode } from './payment-modes';
import { defaultCategory } from './transaction-defaults';

export const classificationFields: ClassificationField[] = [
	'third_party_id',
	'category_id',
	'payment_mode_id',
	'excluded'
];
export function importPattern(pattern: string): RegExp {
	return new RegExp(pattern.normalize('NFD').replace(/\p{Diacritic}/gu, ''), 'iu');
}
export function normalizeImportText(value: string): string {
	return value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.trim()
		.toUpperCase();
}

export function matchesImportRule(
	rule: ImportRule,
	transaction: ParsedTransaction,
	accountId: string,
	format: string
): boolean {
	if (rule.enabled === false || !Object.keys(rule.conditions).length) return false;
	const c = rule.conditions;
	const texts = [transaction.label, transaction.description ?? ''].map(normalizeImportText);
	return (
		(!c.text || texts.some((text) => text.includes(normalizeImportText(c.text!)))) &&
		(!c.pattern || texts.some((text) => importPattern(c.pattern!).test(text))) &&
		(!c.account_id || c.account_id === accountId) &&
		(!c.format || c.format === format) &&
		(!c.record_type || c.record_type === transaction.record_type) &&
		(!c.direction ||
			(c.direction === 'in' ? transaction.amount_cents > 0 : transaction.amount_cents < 0)) &&
		(c.min_cents === undefined || Math.abs(transaction.amount_cents) >= c.min_cents) &&
		(c.max_cents === undefined || Math.abs(transaction.amount_cents) <= c.max_cents)
	);
}

export function resolveImport(
	transaction: ParsedTransaction,
	annotation: TransactionAnnotation,
	accountId: string,
	format: string,
	config: DataConfig,
	parties: ThirdParty[],
	projects: Project[]
) {
	const matching = config.rules.filter((rule) =>
		matchesImportRule(rule, transaction, accountId, format)
	);
	const sources = {} as Record<ClassificationField, FieldSource>;
	const values: {
		third_party_id: string | null;
		category_id: string;
		payment_mode_id: string;
		excluded: boolean;
	} = {
		third_party_id: null,
		category_id: defaultCategory(transaction, config.categories),
		payment_mode_id: guessPaymentMode(transaction, config.paymentModes),
		excluded: transaction.excluded
	};
	function valid(field: string, value: unknown) {
		if (field === 'excluded') return typeof value === 'boolean';
		const entries =
			field === 'category_id'
				? config.categories
				: field === 'payment_mode_id'
					? config.paymentModes
					: field === 'project_id'
						? projects
						: parties;
		return entries.some((entry) => entry.id === value && !('archived' in entry && entry.archived));
	}
	for (const field of classificationFields) {
		const rule = matching.find((rule) => valid(field, rule.set[field]));
		let value: string | boolean | null = values[field];
		let source: FieldSource = { source: field === 'excluded' || value ? 'guess' : 'none' };
		if (rule) {
			value = rule.set[field]!;
			source = { source: 'rule', rule_id: rule.id, rule_name: rule.name };
		} else if (field === 'third_party_id') {
			const party = [...parties]
				.sort((a, b) => a.name.localeCompare(b.name))
				.find((party) =>
					party.aliases.some(
						(alias) =>
							normalizeImportText(alias) &&
							[transaction.label, transaction.description ?? ''].some((text) =>
								normalizeImportText(text).includes(normalizeImportText(alias))
							)
					)
				);
			if (party) {
				value = party.id;
				source = { source: 'alias' };
			}
		}
		if (Object.hasOwn(annotation, field)) {
			value = annotation[field]!;
			source = { source: 'explicit' };
		}
		Object.assign(values, { [field]: value });
		sources[field] = source;
	}
	const suggestion =
		!Object.hasOwn(annotation, 'allocations') && !annotation.allocations?.length
			? matching.find((rule) => valid('project_id', rule.set.project_id))
			: undefined;
	return {
		values,
		sources,
		suggested_project_id: suggestion?.set.project_id ?? null,
		suggested_project_rule: suggestion
			? ({
					source: 'rule',
					rule_id: suggestion.id,
					rule_name: suggestion.name
				} satisfies FieldSource)
			: null
	};
}
