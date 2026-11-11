import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { m } from '#lib/paraglide/messages.js';
import { actions, load } from '../../routes/settings/rules/+page.server';
import { commitAll } from './git';
import { readConfig } from './config';
import {
	createAccount,
	createManualTransaction,
	createProject,
	saveImportRule,
	upsertAnnotation
} from './repository';
import {
	loadRuleContext,
	previewImportRule,
	ruleDraftFromForm,
	ruleMatchCount
} from './rules-editor';
import { parseCsvStatement } from './csv';

vi.mock('./git', () => ({ commitAll: vi.fn().mockResolvedValue(true), ensureGitRepo: vi.fn() }));
let root: string;
let accountId: string;
let transactionId: string;
const writer = { canEdit: true, editMode: true, canWrite: true };
const values = {
	name: 'Cash receipts',
	enabled: 'on',
	condition_text: 'VERSEMENT ESPECES',
	set_category_id: 'ventes'
};
beforeEach(async () => {
	root = await mkdtemp(path.join(tmpdir(), 'comptesperance-rules-editor-'));
	vi.stubEnv('DATA_REPO_PATH', root);
	const account = await createAccount({ name: 'CCP', source: 'csv' }, root);
	accountId = account.id;
	const content = await readFile(new URL('./csv/testdata/ccp-sample.csv', import.meta.url), 'utf8');
	transactionId = parseCsvStatement(content, 'ccp').transactions.find(
		(item) => item.label === values.condition_text
	)!.id;
	for (const name of ['sample.csv', 'duplicate.csv'])
		await writeFile(path.join(root, 'accounts', accountId, 'statements', name), content);
	const manual = await createAccount({ name: 'Manual', source: 'manual' }, root);
	await createManualTransaction(
		manual.id,
		{ date: '2026-01-01', label: values.condition_text, amount_cents: 100 },
		root
	);
	await readConfig(root);
	vi.clearAllMocks();
});
afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(root, { recursive: true, force: true });
});
function event(input: Record<string, string> = values) {
	const form = new FormData();
	for (const [key, value] of Object.entries(input)) form.set(key, value);
	return {
		locals: { user: writer },
		request: new Request('http://localhost/settings/rules', { method: 'POST', body: form })
	};
}
const submit = (name: string, input?: Record<string, string>) =>
	actions[name]!(event(input) as never);

it('previews deduplicated CSV rows without commits or changing stored rules', async () => {
	const result = await submit('preview');
	expect(result).toMatchObject({
		preview: {
			count: 1,
			rows: [
				{
					account_id: accountId,
					label: values.condition_text,
					amount_cents: 12000,
					changes: [{ field: 'category_id', before: '', after: 'ventes', explicit: false }]
				}
			]
		}
	});
	expect((await readConfig(root)).rules).toEqual([]);
	expect(commitAll).not.toHaveBeenCalled();
	expect(await submit('preview', { ...values, condition_text: 'Nothing matches' })).toMatchObject({
		preview: { count: 0, rows: [] }
	});
});

it('keeps explicit values untouched and previews in actual rule order', async () => {
	const first = await saveImportRule(
		{ name: 'First', conditions: { text: values.condition_text }, set: { category_id: 'dons' } },
		root
	);
	const context = await loadRuleContext(root);
	const draft = {
		name: 'Later',
		conditions: { text: values.condition_text },
		set: { category_id: 'ventes' }
	};
	expect(previewImportRule(draft, context).rows[0].changes[0]).toMatchObject({
		before: 'dons',
		after: 'dons',
		explicit: false
	});
	expect(previewImportRule({ ...draft, id: first.id }, context).rows[0].changes[0]).toMatchObject({
		before: 'dons',
		after: 'ventes'
	});
	await upsertAnnotation(
		accountId,
		transactionId,
		{ category_id: '', excluded: false, third_party_id: null, allocations: [] },
		root
	);
	const project = await createProject({ name: 'Project' }, root);
	const preview = previewImportRule(
		{ ...draft, set: { category_id: 'ventes', excluded: true, project_id: project.id } },
		await loadRuleContext(root)
	);
	expect(preview.rows[0].changes).toEqual([
		{ field: 'category_id', before: '', after: '', explicit: true },
		{ field: 'excluded', before: false, after: false, explicit: true },
		{ field: 'project_id', before: null, after: null, explicit: true }
	]);
});

it('counts disabled conditions but previews no effect and caps previews at eight', async () => {
	const context = await loadRuleContext(root);
	const draft = {
		id: 'new',
		name: 'Disabled',
		enabled: false,
		conditions: { text: values.condition_text },
		set: { category_id: 'ventes' }
	};
	expect(ruleMatchCount(draft, context)).toBe(1);
	expect(previewImportRule({ ...draft, id: undefined }, context).rows[0].changes[0]).toMatchObject({
		before: '',
		after: ''
	});
	context.items = Array.from({ length: 12 }, (_, index) => ({
		...context.items.find((item) => item.transaction.id === transactionId)!,
		transaction: {
			...context.items[0].transaction,
			id: String(index),
			label: values.condition_text
		}
	}));
	const preview = previewImportRule({ ...draft, id: undefined }, context);
	expect(preview.count).toBe(12);
	expect(preview.rows).toHaveLength(8);
});

it('returns friendly validation errors from save and preview, retaining the draft', async () => {
	for (const action of ['save', 'preview']) {
		for (const [overrides, error] of [
			[{ condition_pattern: '[' }, m.rules_error_pattern()],
			[{ condition_text: '' }, m.rules_error_conditions()],
			[{ set_category_id: '' }, m.rules_error_outputs()],
			[{ set_category_id: 'missing' }, m.rules_error_reference()],
			[{ condition_account_id: 'missing' }, m.rules_error_reference()],
			[{ min_amount: '20', max_amount: '10' }, m.rules_error_invalid()],
			[{ min_amount: 'invalid' }, m.rules_error_invalid()]
		] as [Record<string, string>, string][])
			expect(await submit(action, { ...values, ...overrides })).toMatchObject({
				status: 400,
				data: { error, draft: { name: values.name } }
			});
	}
	expect(commitAll).not.toHaveBeenCalled();
});

it('parses explicit false, optional amounts and unused fields correctly', () => {
	const form = new FormData();
	for (const [key, value] of Object.entries({
		...values,
		min_amount: '0',
		max_amount: '12,34',
		set_excluded: 'false'
	}))
		form.set(key, value);
	expect(ruleDraftFromForm(form)).toMatchObject({
		conditions: { text: values.condition_text, min_cents: 0, max_cents: 1234 },
		set: { category_id: 'ventes', excluded: false }
	});
	form.set('set_excluded', 'invalid');
	expect(() => ruleDraftFromForm(form)).toThrow('config_invalid');
});

it('creates, edits, toggles, reorders and deletes with one commit per action', async () => {
	await expect(submit('save')).rejects.toMatchObject({ status: 303 });
	const first = (await readConfig(root)).rules[0];
	expect(commitAll).toHaveBeenCalledTimes(1);
	vi.clearAllMocks();
	await expect(submit('save', { ...values, id: first.id, name: 'Edited' })).rejects.toMatchObject({
		status: 303
	});
	expect((await readConfig(root)).rules[0].name).toBe('Edited');
	expect(commitAll).toHaveBeenCalledTimes(1);
	vi.clearAllMocks();
	await expect(submit('toggle', { id: first.id })).rejects.toMatchObject({ status: 303 });
	expect((await readConfig(root)).rules[0].enabled).toBe(false);
	expect(commitAll).toHaveBeenCalledTimes(1);
	await expect(submit('save', { ...values, name: 'Second' })).rejects.toMatchObject({
		status: 303
	});
	const second = (await readConfig(root)).rules[1];
	vi.clearAllMocks();
	await expect(submit('move', { id: second.id, direction: 'up' })).rejects.toMatchObject({
		status: 303
	});
	expect((await readConfig(root)).rules.map((rule) => rule.id)).toEqual([second.id, first.id]);
	expect(commitAll).toHaveBeenCalledTimes(1);
	vi.clearAllMocks();
	expect(await submit('move', { id: second.id, direction: 'up' })).toMatchObject({ status: 400 });
	expect(await submit('move', { id: 'missing', direction: 'down' })).toMatchObject({ status: 400 });
	expect(await submit('toggle', { id: 'missing' })).toMatchObject({ status: 400 });
	expect(commitAll).not.toHaveBeenCalled();
	await expect(submit('delete', { id: first.id })).rejects.toMatchObject({ status: 303 });
	expect((await readConfig(root)).rules.map((rule) => rule.id)).toEqual([second.id]);
	expect(commitAll).toHaveBeenCalledTimes(1);
});

it('prefills the editor from current CSV values and hides it outside edit mode', async () => {
	await saveImportRule(
		{
			name: 'Current',
			conditions: { text: values.condition_text },
			set: { category_id: 'ventes' }
		},
		root
	);
	const url = new URL(
		`http://localhost/settings/rules?new=1&from_account=${accountId}&from_transaction=${transactionId}`
	);
	const result = await load({ url, locals: { user: writer } } as never);
	expect(result).toMatchObject({
		editor: {
			name: values.condition_text,
			conditions: { text: values.condition_text, account_id: accountId, direction: 'in' },
			set: { category_id: 'ventes', payment_mode_id: 'especes' }
		},
		rules: [{ matchCount: 1 }]
	});
	expect(await load({ url, locals: { user: { canWrite: false } } } as never)).toMatchObject({
		editor: null
	});
	url.searchParams.set('from_transaction', 'missing');
	await expect(load({ url, locals: { user: writer } } as never)).rejects.toMatchObject({
		status: 404
	});
});

it('refuses all rule actions to readers and writers outside edit mode', async () => {
	for (const action of Object.values(actions))
		for (const user of [{ canEdit: false }, { canEdit: true, editMode: false, canWrite: false }])
			await expect(action!({ locals: { user } } as never)).rejects.toMatchObject({ status: 403 });
	expect(commitAll).not.toHaveBeenCalled();
});
