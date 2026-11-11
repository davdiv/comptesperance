import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
	AppConfig,
	Category,
	DataConfig,
	PaymentMode,
	AccountFile,
	TransactionAnnotation
} from '$lib/types';
import { getEnv } from './env';
import { commitAll } from './git';
import { detectCsvFormat, parseCsvStatement } from './csv';
import { guessPaymentMode } from './payment-modes';
import {
	listDirectoryNames,
	listFilesRecursive,
	pathExists,
	readJsonFile,
	readTextFile,
	writeJsonFile
} from './store';

const defaults: DataConfig = {
	app: { name: 'Comptesperance' },
	categories: [
		{ id: 'dons', name: 'Dons', kind: 'income' },
		{ id: 'ventes', name: 'Ventes', kind: 'income' },
		{ id: 'subventions', name: 'Subventions', kind: 'income' },
		{ id: 'cotisations', name: 'Cotisations', kind: 'income' },
		{ id: 'achats', name: 'Achats', kind: 'expense' },
		{ id: 'fournitures', name: 'Fournitures', kind: 'expense' },
		{ id: 'frais-bancaires', name: 'Frais bancaires', kind: 'expense' },
		{ id: 'remboursements', name: 'Remboursements', kind: 'expense' }
	],
	paymentModes: [
		{ id: 'carte', name: 'Carte bancaire' },
		{ id: 'virement', name: 'Virement' },
		{ id: 'especes', name: 'Espèces' },
		{ id: 'cheque', name: 'Chèque' },
		{ id: 'prelevement', name: 'Prélèvement' }
	]
};
const files = {
	app: 'app.json',
	categories: 'categories.json',
	paymentModes: 'payment-modes.json'
};

const initializations = new Map<string, Promise<void>>();

export async function ensureConfig(root: string): Promise<void> {
	const existing = initializations.get(root);
	if (existing) return existing;
	const pending = initializeConfig(root).finally(() => initializations.delete(root));
	initializations.set(root, pending);
	return pending;
}

async function initializeConfig(root: string): Promise<void> {
	let changed = false;
	for (const key of ['app', 'categories', 'paymentModes'] as const) {
		const file = path.join(root, 'config', files[key]);
		if (!(await pathExists(file))) {
			await writeJsonFile(file, defaults[key]);
			changed = true;
		}
	}
	if (changed) await commitAll(root, 'data: initialize configuration');
}

export async function readConfig(root = getEnv().dataRepoPath): Promise<DataConfig> {
	await ensureConfig(root);
	return {
		app: await readJsonFile<AppConfig>(path.join(root, 'config/app.json'), defaults.app),
		categories: await readJsonFile<Category[]>(path.join(root, 'config/categories.json'), []),
		paymentModes: await readJsonFile<PaymentMode[]>(
			path.join(root, 'config/payment-modes.json'),
			[]
		)
	};
}

export async function saveAppName(name: string, root = getEnv().dataRepoPath): Promise<void> {
	if (!name.trim()) throw new Error('config_invalid');
	await writeJsonFile(path.join(root, 'config/app.json'), { name: name.trim() });
	await commitAll(root, 'data: update app name');
}

async function isUsed(
	root: string,
	field: 'category_id' | 'payment_mode_id',
	id: string,
	modes: PaymentMode[]
): Promise<boolean> {
	for (const accountId of await listDirectoryNames(path.join(root, 'accounts'))) {
		const dir = path.join(root, 'accounts', accountId);
		const file = await readJsonFile<AccountFile | null>(path.join(dir, 'account.json'), null);
		if (!file) continue;
		const annotations =
			file.account.source === 'csv'
				? await readJsonFile<Record<string, TransactionAnnotation>>(
						path.join(dir, 'annotations.json'),
						{}
					)
				: {};
		const items =
			file.account.source === 'manual' ? (file.transactions ?? []) : Object.values(annotations);
		if (items.some((item) => item[field] === id)) return true;
		if (field === 'payment_mode_id' && file.account.source === 'csv') {
			for (const statement of await listFilesRecursive(path.join(dir, 'statements'))) {
				if (!statement.toLowerCase().endsWith('.csv')) continue;
				const content = await readTextFile(path.join(dir, 'statements', statement));
				const format = detectCsvFormat(content);
				if (!format) continue;
				for (const transaction of parseCsvStatement(content, format).transactions) {
					const effectiveMode =
						annotations[transaction.id]?.payment_mode_id ?? guessPaymentMode(transaction, modes);
					if (effectiveMode === id) return true;
				}
			}
		}
	}
	return false;
}

export async function mutateConfig(
	collection: 'categories' | 'paymentModes',
	input: { id?: string; name?: string; kind?: string; archived?: boolean; remove?: boolean },
	root = getEnv().dataRepoPath
): Promise<void> {
	const config = await readConfig(root);
	const entries = config[collection];
	const current = input.id ? entries.find((entry) => entry.id === input.id) : undefined;
	if (input.id && !current) throw new Error('config_invalid');
	if (input.remove) {
		if (!current) throw new Error('config_invalid');
		if (
			await isUsed(
				root,
				collection === 'categories' ? 'category_id' : 'payment_mode_id',
				current.id,
				config.paymentModes
			)
		)
			throw new Error('config_in_use');
	} else {
		if (
			!input.name?.trim() ||
			(collection === 'categories' && !['income', 'expense'].includes(input.kind ?? ''))
		)
			throw new Error('config_invalid');
	}
	const next = input.remove
		? entries.filter((entry) => entry.id !== input.id)
		: [
				...entries.filter((entry) => entry.id !== input.id),
				{
					id: current?.id ?? randomUUID(),
					name: input.name!.trim(),
					archived: input.archived ?? false,
					...(collection === 'categories' ? { kind: input.kind as Category['kind'] } : {})
				}
			];
	await writeJsonFile(path.join(root, 'config', files[collection]), next);
	await commitAll(root, `data: update ${collection}`);
}
