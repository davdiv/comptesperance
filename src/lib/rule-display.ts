import type {
	Account,
	Category,
	PaymentMode,
	ThirdParty,
	Project,
	ImportRule
} from '#lib/types.ts';
import { m } from '#lib/paraglide/messages.js';
import { formatMoney } from '#lib/format.ts';

export interface RuleOptions {
	accounts: Pick<Account, 'id' | 'name' | 'source'>[];
	categories: Category[];
	paymentModes: PaymentMode[];
	thirdParties: ThirdParty[];
	projects: Project[];
}

export interface RulePreview {
	count: number;
	rows: {
		id: string;
		account_id: string;
		account_name: string;
		date: string;
		label: string;
		amount_cents: number;
		changes: {
			field: string;
			before: string | boolean | null;
			after: string | boolean | null;
			explicit: boolean;
		}[];
	}[];
}

export function ruleFieldLabel(field: string): string {
	switch (field) {
		case 'third_party_id':
			return m.common_third_party();
		case 'category_id':
			return m.common_category();
		case 'payment_mode_id':
			return m.payment_mode();
		case 'excluded':
			return m.transaction_excluded();
		case 'project_id':
			return m.rules_project_suggestion();
		default:
			return field;
	}
}

export function ruleValue(
	field: string,
	value: string | boolean | null,
	options: RuleOptions
): string {
	if (typeof value === 'boolean') return value ? m.rules_yes() : m.rules_no();
	if (!value) return '—';
	const entries =
		field === 'category_id'
			? options.categories
			: field === 'payment_mode_id'
				? options.paymentModes
				: field === 'project_id'
					? options.projects
					: options.thirdParties;
	return (
		entries.find((entry) => entry.id === value)?.name ?? m.config_unknown() + ' (' + value + ')'
	);
}

export function ruleConditionsSummary(
	rule: Pick<ImportRule, 'conditions'>,
	options: RuleOptions
): string {
	const c = rule.conditions;
	return [
		c.text && m.rules_text_summary({ text: c.text }),
		c.pattern && m.rules_pattern_summary({ pattern: c.pattern }),
		c.account_id &&
			m.rules_account_summary({
				name: options.accounts.find((a) => a.id === c.account_id)?.name ?? c.account_id
			}),
		c.direction && (c.direction === 'in' ? m.account_incoming() : m.account_outgoing()),
		c.min_cents !== undefined && m.rules_min_summary({ amount: formatMoney(c.min_cents) }),
		c.max_cents !== undefined && m.rules_max_summary({ amount: formatMoney(c.max_cents) }),
		c.format && c.format.toUpperCase(),
		c.record_type && m.rules_record_summary({ type: c.record_type })
	]
		.filter(Boolean)
		.join(' · ');
}

export function ruleSetSummary(rule: Pick<ImportRule, 'set'>, options: RuleOptions): string {
	return Object.entries(rule.set)
		.map(([field, value]) => ruleFieldLabel(field) + ': ' + ruleValue(field, value, options))
		.join(' · ');
}
