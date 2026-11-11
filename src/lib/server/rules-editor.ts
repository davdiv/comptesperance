import type { ImportRule } from '#lib/types.ts';
import { m } from '#lib/paraglide/messages.js';
import { parseDecimalToCents } from './money';
import { classificationFields, matchesImportRule, resolveImport } from './import-rules';
import {
	RuleValidationError,
	validateImportRule,
	type ImportRuleDraft
} from './import-rule-validation';
import { readConfig } from './config';
import { accountCsvTransactions } from './csv/account-transactions';
import { ensureDataRepo, listStoredAccounts, listProjects, listThirdParties } from './repository';

export function ruleDraftFromForm(form: FormData): ImportRuleDraft {
	const conditions: Record<string, string | number> = {};
	const set: Record<string, string | boolean> = {};
	for (const key of ['text', 'pattern', 'account_id', 'direction', 'format', 'record_type']) {
		const value = String(form.get('condition_' + key) ?? '').trim();
		if (value) conditions[key] = value;
	}
	for (const key of ['min', 'max']) {
		const value = String(form.get(key + '_amount') ?? '').trim();
		if (value) conditions[key + '_cents'] = parseDecimalToCents(value) ?? NaN;
	}
	for (const key of ['third_party_id', 'category_id', 'payment_mode_id', 'project_id']) {
		const value = String(form.get('set_' + key) ?? '').trim();
		if (value) set[key] = value;
	}
	const excluded = String(form.get('set_excluded') ?? '');
	if (excluded) {
		if (!['true', 'false'].includes(excluded)) throw new RuleValidationError('invalid');
		set.excluded = excluded === 'true';
	}
	return {
		id: String(form.get('id') ?? '') || undefined,
		name: String(form.get('name') ?? ''),
		enabled: form.get('enabled') === 'on',
		conditions: conditions as ImportRule['conditions'],
		set
	};
}

export function ruleErrorMessage(error: unknown): string {
	if (error instanceof RuleValidationError) {
		if (error.reason === 'conditions') return m.rules_error_conditions();
		if (error.reason === 'outputs') return m.rules_error_outputs();
		if (error.reason === 'pattern') return m.rules_error_pattern();
		if (error.reason === 'reference') return m.rules_error_reference();
	}
	return m.rules_error_invalid();
}

export async function loadRuleContext(root?: string) {
	const repo = root ?? (await ensureDataRepo());
	const [config, files, thirdParties, projects] = await Promise.all([
		readConfig(repo),
		listStoredAccounts(repo),
		listThirdParties(repo),
		listProjects(repo)
	]);
	const items = (
		await Promise.all(
			files
				.filter((file) => file.account.source === 'csv')
				.map(async (file) =>
					(await accountCsvTransactions(file.dir)).map((item) => ({
						...item,
						account: file.account,
						annotation: file.annotations?.[item.transaction.id] ?? {}
					}))
				)
		)
	)
		.flat()
		.sort(
			(a, b) =>
				b.transaction.date.localeCompare(a.transaction.date) ||
				a.account.id.localeCompare(b.account.id) ||
				a.transaction.id.localeCompare(b.transaction.id)
		);
	return { config, accounts: files.map((file) => file.account), thirdParties, projects, items };
}

export function ruleMatchCount(
	rule: ImportRule,
	context: Awaited<ReturnType<typeof loadRuleContext>>
) {
	return context.items.filter(({ transaction, account, format }) =>
		matchesImportRule({ ...rule, enabled: true }, transaction, account.id, format)
	).length;
}

export function previewImportRule(
	draft: ImportRuleDraft,
	context: Awaited<ReturnType<typeof loadRuleContext>>
) {
	validateImportRule(draft, context);
	if (draft.id && !context.config.rules.some((rule) => rule.id === draft.id))
		throw new RuleValidationError('reference');
	const rule: ImportRule = { ...draft, id: draft.id ?? '__preview__' };
	const rules = draft.id
		? context.config.rules.map((item) => (item.id === draft.id ? rule : item))
		: [...context.config.rules, rule];
	const matches = context.items.filter(({ transaction, account, format }) =>
		matchesImportRule({ ...rule, enabled: true }, transaction, account.id, format)
	);
	return {
		count: matches.length,
		rows: matches.slice(0, 8).map(({ transaction, account, annotation, format }) => {
			const current = resolveImport(
				transaction,
				annotation,
				account.id,
				format,
				context.config,
				context.thirdParties,
				context.projects
			);
			const next = resolveImport(
				transaction,
				annotation,
				account.id,
				format,
				{ ...context.config, rules },
				context.thirdParties,
				context.projects
			);
			const changes = classificationFields
				.filter((field) => Object.hasOwn(rule.set, field))
				.map((field) => ({
					field: field as string,
					before: current.values[field],
					after: next.values[field],
					explicit: current.sources[field].source === 'explicit'
				}));
			if (rule.set.project_id)
				changes.push({
					field: 'project_id',
					before: current.suggested_project_id,
					after: next.suggested_project_id,
					explicit: Object.hasOwn(annotation, 'allocations')
				});
			return {
				id: transaction.id,
				account_id: account.id,
				account_name: account.name,
				date: transaction.date,
				label: transaction.label,
				amount_cents: transaction.amount_cents,
				changes
			};
		})
	};
}
