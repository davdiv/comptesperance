import { error, fail, redirect } from '@sveltejs/kit';
import { requireWrite } from '#lib/server/auth.ts';
import { readConfig } from '#lib/server/config.ts';
import { resolveImport } from '#lib/server/import-rules.ts';
import { saveImportRule, deleteImportRule, reorderImportRules } from '#lib/server/repository.ts';
import {
	loadRuleContext,
	previewImportRule,
	ruleDraftFromForm,
	ruleErrorMessage,
	ruleMatchCount
} from '#lib/server/rules-editor.ts';
import type { ImportRuleDraft } from '#lib/server/import-rule-validation.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	const context = await loadRuleContext();
	let editor: ImportRuleDraft | null = null;
	if (locals.user.canWrite && url.searchParams.has('edit')) {
		editor = context.config.rules.find((rule) => rule.id === url.searchParams.get('edit')) ?? null;
		if (!editor) error(404, 'Not found');
	} else if (locals.user.canWrite && url.searchParams.has('new')) {
		editor = { name: '', enabled: true, conditions: {}, set: {} };
		if (url.searchParams.has('from_transaction')) {
			const item = context.items.find(
				({ account, transaction }) =>
					account.id === url.searchParams.get('from_account') &&
					transaction.id === url.searchParams.get('from_transaction')
			);
			if (!item) error(404, 'Not found');
			const current = resolveImport(
				item.transaction,
				item.annotation,
				item.account.id,
				item.format,
				context.config,
				context.thirdParties,
				context.projects
			);
			editor.name = item.transaction.label;
			editor.conditions = {
				text: item.transaction.label,
				account_id: item.account.id,
				...(item.transaction.amount_cents
					? { direction: item.transaction.amount_cents > 0 ? 'in' : 'out' }
					: {})
			};
			for (const field of ['third_party_id', 'category_id', 'payment_mode_id'] as const) {
				if (current.values[field]) editor.set[field] = current.values[field]!;
			}
		}
	}
	return {
		rules: context.config.rules.map((rule) => ({
			...rule,
			matchCount: ruleMatchCount(rule, context)
		})),
		options: {
			accounts: context.accounts,
			thirdParties: context.thirdParties,
			projects: context.projects,
			categories: context.config.categories,
			paymentModes: context.config.paymentModes
		},
		editor
	};
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		requireWrite(locals.user);
		let draft: ImportRuleDraft | undefined;
		let id: string;
		try {
			draft = ruleDraftFromForm(await request.formData());
			id = (await saveImportRule(draft)).id;
		} catch (e) {
			return fail(400, { error: ruleErrorMessage(e), draft });
		}
		redirect(303, '/settings/rules#' + encodeURIComponent(id));
	},
	preview: async ({ request, locals }) => {
		requireWrite(locals.user);
		let draft: ImportRuleDraft | undefined;
		try {
			draft = ruleDraftFromForm(await request.formData());
			return { draft, preview: previewImportRule(draft, await loadRuleContext()) };
		} catch (e) {
			return fail(400, { error: ruleErrorMessage(e), draft });
		}
	},
	toggle: async ({ request, locals }) => {
		requireWrite(locals.user);
		const id = String((await request.formData()).get('id'));
		const rule = (await readConfig()).rules.find((item) => item.id === id);
		if (!rule) return fail(400, { error: ruleErrorMessage(null) });
		try {
			await saveImportRule({ ...rule, enabled: rule.enabled === false });
		} catch (e) {
			return fail(400, { error: ruleErrorMessage(e) });
		}
		redirect(303, '/settings/rules#' + encodeURIComponent(id));
	},
	delete: async ({ request, locals }) => {
		requireWrite(locals.user);
		try {
			await deleteImportRule(String((await request.formData()).get('id')));
		} catch (e) {
			return fail(400, { error: ruleErrorMessage(e) });
		}
		redirect(303, '/settings/rules');
	},
	move: async ({ request, locals }) => {
		requireWrite(locals.user);
		const form = await request.formData();
		const id = String(form.get('id'));
		const direction = String(form.get('direction'));
		const ids = (await readConfig()).rules.map((rule) => rule.id);
		const index = ids.indexOf(id);
		const target = index + (direction === 'up' ? -1 : 1);
		if (!['up', 'down'].includes(direction) || index < 0 || target < 0 || target >= ids.length)
			return fail(400, { error: ruleErrorMessage(null) });
		[ids[index], ids[target]] = [ids[target], ids[index]];
		try {
			await reorderImportRules(ids);
		} catch (e) {
			return fail(400, { error: ruleErrorMessage(e) });
		}
		redirect(303, '/settings/rules#' + encodeURIComponent(id));
	}
};
