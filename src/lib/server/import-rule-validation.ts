import type { ImportRuleDraft, DataConfig, Account, ThirdParty, Project } from '#lib/types.ts';
import { importPattern } from './import-rules';

export type { ImportRuleDraft } from '#lib/types.ts';
export interface RuleReferences {
	config: DataConfig;
	accounts: Account[];
	thirdParties: ThirdParty[];
	projects: Project[];
}
export class RuleValidationError extends Error {
	constructor(public reason: 'invalid' | 'conditions' | 'outputs' | 'pattern' | 'reference') {
		super('config_invalid');
	}
}

export function validateImportRule(input: ImportRuleDraft, refs: RuleReferences): void {
	const c = input.conditions;
	if (!input.name.trim()) throw new RuleValidationError('invalid');
	if (!c || !Object.keys(c).length) throw new RuleValidationError('conditions');
	if (!input.set || !Object.keys(input.set).length) throw new RuleValidationError('outputs');
	const keys = [
		'text',
		'pattern',
		'account_id',
		'direction',
		'min_cents',
		'max_cents',
		'format',
		'record_type'
	];
	if (Object.keys(c).some((key) => !keys.includes(key))) throw new RuleValidationError('invalid');
	for (const key of ['text', 'pattern', 'account_id', 'record_type'] as const)
		if (key in c && (typeof c[key] !== 'string' || !c[key]!.trim()))
			throw new RuleValidationError('invalid');
	if (c.pattern) {
		try {
			importPattern(c.pattern);
		} catch {
			throw new RuleValidationError('pattern');
		}
	}
	if (
		('direction' in c && !['in', 'out'].includes(c.direction ?? '')) ||
		('format' in c && !['ccp', 'sumup'].includes(c.format ?? ''))
	)
		throw new RuleValidationError('invalid');
	for (const value of [c.min_cents, c.max_cents])
		if (value !== undefined && (!Number.isSafeInteger(value) || value < 0))
			throw new RuleValidationError('invalid');
	if (c.min_cents !== undefined && c.max_cents !== undefined && c.min_cents > c.max_cents)
		throw new RuleValidationError('invalid');
	if (c.account_id && !refs.accounts.some((account) => account.id === c.account_id))
		throw new RuleValidationError('reference');
	const targets = {
		category_id: refs.config.categories,
		payment_mode_id: refs.config.paymentModes,
		third_party_id: refs.thirdParties,
		project_id: refs.projects
	};
	for (const [field, value] of Object.entries(input.set)) {
		if (field === 'excluded') {
			if (typeof value !== 'boolean') throw new RuleValidationError('invalid');
		} else if (
			!(field in targets) ||
			!targets[field as keyof typeof targets].some((entry) => entry.id === value)
		)
			throw new RuleValidationError('reference');
	}
	if (input.enabled !== undefined && typeof input.enabled !== 'boolean')
		throw new RuleValidationError('invalid');
}
