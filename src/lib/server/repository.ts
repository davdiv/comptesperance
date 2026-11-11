import { randomUUID } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type {
	Account,
	AccountFile,
	AccountSource,
	AccountType,
	ManualTransaction,
	Project,
	ProjectAllocation,
	ThirdParty,
	TransactionAnnotation
} from '$lib/types';
import { getEnv } from './env';
import { commitAll, ensureGitRepo } from './git';
import {
	listDirectoryNames,
	listFilesRecursive,
	pathExists,
	readBinaryFile,
	readJsonFile,
	removeFile,
	safeJoin,
	writeBinaryFile,
	writeJsonFile
} from './store';

export interface StoredAccountFile extends AccountFile {
	dir: string;
}

export interface DocumentInfo {
	path: string;
	name: string;
	size: number;
	modified_at: string;
}

export interface TransactionRef {
	account_id: string;
	transaction_id: string;
}

const ACCOUNT_TYPES: AccountType[] = ['bank', 'sumup', 'stripe', 'cash', 'other'];
const ACCOUNT_SOURCES: AccountSource[] = ['csv', 'manual'];

function now(): string {
	return new Date().toISOString();
}

async function repoRoot(root?: string): Promise<string> {
	if (root) return root;
	const { dataRepoPath } = getEnv();
	await ensureDataRepo(dataRepoPath);
	return dataRepoPath;
}

export async function ensureDataRepo(root?: string): Promise<string> {
	const { dataRepoPath } = getEnv();
	const target = root ?? dataRepoPath;
	await mkdir(target, { recursive: true });
	await ensureGitRepo(target);
	await Promise.all(
		['accounts', 'projects', 'third-parties', 'documents'].map((dir) =>
			mkdir(path.join(target, dir), { recursive: true })
		)
	);
	return target;
}

export function slugify(value: string): string {
	const slug = value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
	return slug || 'item';
}

async function commitData(root: string, message: string): Promise<void> {
	await commitAll(root, message);
}

async function readStoredAccount(root: string, id: string): Promise<StoredAccountFile | null> {
	const dir = safeJoin(root, 'accounts', id);
	const accountPath = path.join(dir, 'account.json');
	if (!(await pathExists(accountPath))) return null;
	const parsed = await readJsonFile<AccountFile | null>(accountPath, null);
	if (!parsed?.account) return null;
	const account = parsed.account;
	account.id = account.id || id;
	const file: StoredAccountFile = { account, dir };
	if (account.source === 'csv') {
		file.annotations = await readJsonFile<Record<string, TransactionAnnotation>>(
			path.join(dir, 'annotations.json'),
			{}
		);
	} else {
		file.transactions = parsed.transactions ?? [];
	}
	return file;
}

async function writeStoredAccount(root: string, file: StoredAccountFile): Promise<void> {
	const { dir, ...stored } = file;
	const payload: AccountFile = { account: stored.account };
	if (stored.account.source === 'manual') {
		payload.transactions = stored.transactions ?? [];
		await writeJsonFile(path.join(dir, 'account.json'), payload);
	} else {
		payload.annotations = stored.annotations ?? {};
		await writeJsonFile(path.join(dir, 'account.json'), { account: stored.account });
		await writeJsonFile(path.join(dir, 'annotations.json'), payload.annotations);
	}
}

export async function listStoredAccounts(root?: string): Promise<StoredAccountFile[]> {
	const repo = await repoRoot(root);
	const ids = await listDirectoryNames(path.join(repo, 'accounts'));
	const accounts = await Promise.all(ids.map((id) => readStoredAccount(repo, id)));
	return accounts
		.filter((account): account is StoredAccountFile => account !== null)
		.sort((a, b) => a.account.name.localeCompare(b.account.name));
}

export async function readStoredAccountById(
	id: string,
	root?: string
): Promise<StoredAccountFile | null> {
	const repo = await repoRoot(root);
	return readStoredAccount(repo, id);
}

async function uniqueAccountId(root: string, name: string): Promise<string> {
	const base = slugify(name);
	let candidate = base;
	let index = 2;
	while (await pathExists(path.join(root, 'accounts', candidate, 'account.json'))) {
		candidate = `${base}-${index}`;
		index += 1;
	}
	return candidate;
}

export async function createAccount(
	input: {
		name: string;
		type: AccountType;
		source: AccountSource;
		currency?: string;
		opening_balance_cents?: number;
	},
	root?: string
): Promise<Account> {
	const repo = await repoRoot(root);
	if (!ACCOUNT_TYPES.includes(input.type)) throw new Error('Invalid account type');
	if (!ACCOUNT_SOURCES.includes(input.source)) throw new Error('Invalid account source');
	const id = await uniqueAccountId(repo, input.name);
	const timestamp = now();
	const account: Account = {
		id,
		name: input.name.trim(),
		type: input.type,
		currency: (input.currency ?? 'EUR').toUpperCase(),
		opening_balance_cents: Math.round(input.opening_balance_cents ?? 0),
		source: input.source,
		created_at: timestamp,
		updated_at: timestamp
	};
	const file: StoredAccountFile = { account, dir: path.join(repo, 'accounts', id) };
	if (account.source === 'manual') file.transactions = [];
	else file.annotations = {};
	if (account.source === 'csv') await mkdir(path.join(file.dir, 'statements'), { recursive: true });
	await writeStoredAccount(repo, file);
	await commitData(repo, `data: create account ${id}`);
	return account;
}

export async function updateAccount(
	id: string,
	patch: Partial<Pick<Account, 'name' | 'type' | 'currency' | 'opening_balance_cents'>>,
	root?: string
): Promise<Account> {
	const repo = await repoRoot(root);
	const file = await readStoredAccount(repo, id);
	if (!file) throw new Error('Account not found');
	if (patch.type && !ACCOUNT_TYPES.includes(patch.type)) throw new Error('Invalid account type');
	file.account = {
		...file.account,
		...patch,
		currency: patch.currency ? patch.currency.toUpperCase() : file.account.currency,
		opening_balance_cents:
			patch.opening_balance_cents === undefined
				? file.account.opening_balance_cents
				: Math.round(patch.opening_balance_cents),
		updated_at: now()
	};
	await writeStoredAccount(repo, file);
	await commitData(repo, `data: update account ${id}`);
	return file.account;
}

function cleanManualTransaction(
	transaction: ManualTransaction,
	account: Account
): ManualTransaction {
	return {
		...transaction,
		amount_cents: Math.round(transaction.amount_cents),
		currency: transaction.currency || account.currency,
		record_type: transaction.record_type || 'manual',
		counts_in_total: transaction.counts_in_total ?? !transaction.excluded,
		evidence: transaction.evidence?.filter(Boolean) ?? []
	};
}

export async function createManualTransaction(
	accountId: string,
	input: Omit<ManualTransaction, 'id' | 'created_at' | 'updated_at'>,
	root?: string
): Promise<ManualTransaction> {
	const repo = await repoRoot(root);
	const file = await readStoredAccount(repo, accountId);
	if (!file) throw new Error('Account not found');
	if (file.account.source !== 'manual') throw new Error('Account is not manual');
	const timestamp = now();
	const transaction: ManualTransaction = cleanManualTransaction(
		{ ...input, id: randomUUID(), created_at: timestamp, updated_at: timestamp },
		file.account
	);
	file.transactions = [...(file.transactions ?? []), transaction];
	await writeStoredAccount(repo, file);
	await commitData(repo, `data: add transaction to ${accountId}`);
	return transaction;
}

export async function updateManualTransaction(
	accountId: string,
	transactionId: string,
	patch: Partial<Omit<ManualTransaction, 'id' | 'created_at'>>,
	root?: string
): Promise<ManualTransaction> {
	const repo = await repoRoot(root);
	const file = await readStoredAccount(repo, accountId);
	if (!file) throw new Error('Account not found');
	if (file.account.source !== 'manual') throw new Error('Account is not manual');
	const transactions = file.transactions ?? [];
	const index = transactions.findIndex((transaction) => transaction.id === transactionId);
	if (index === -1) throw new Error('Transaction not found');
	const current = transactions[index];
	const next = cleanManualTransaction(
		{ ...current, ...patch, id: current.id, created_at: current.created_at, updated_at: now() },
		file.account
	);
	transactions[index] = next;
	file.transactions = transactions;
	await writeStoredAccount(repo, file);
	await commitData(repo, `data: update transaction ${transactionId} in ${accountId}`);
	return next;
}

export async function deleteManualTransaction(
	accountId: string,
	transactionId: string,
	root?: string
): Promise<void> {
	const repo = await repoRoot(root);
	const file = await readStoredAccount(repo, accountId);
	if (!file) throw new Error('Account not found');
	if (file.account.source !== 'manual') throw new Error('Account is not manual');
	const before = (file.transactions ?? []).length;
	file.transactions = (file.transactions ?? []).filter(
		(transaction) => transaction.id !== transactionId
	);
	if (file.transactions.length === before) throw new Error('Transaction not found');
	await writeStoredAccount(repo, file);
	await commitData(repo, `data: delete transaction ${transactionId} from ${accountId}`);
}

function cleanAnnotation(annotation: TransactionAnnotation): TransactionAnnotation {
	const cleaned: TransactionAnnotation = {};
	if (annotation.notes?.trim()) cleaned.notes = annotation.notes.trim();
	if (annotation.category?.trim()) cleaned.category = annotation.category.trim();
	if (annotation.third_party_id) cleaned.third_party_id = annotation.third_party_id;
	if (annotation.transfer_id) cleaned.transfer_id = annotation.transfer_id;
	if (annotation.counterpart_account_id) {
		cleaned.counterpart_account_id = annotation.counterpart_account_id;
	}
	if (annotation.counterpart_transaction_id) {
		cleaned.counterpart_transaction_id = annotation.counterpart_transaction_id;
	}
	if (annotation.evidence?.length) cleaned.evidence = annotation.evidence.filter(Boolean);
	if (annotation.excluded !== undefined) cleaned.excluded = annotation.excluded;
	return cleaned;
}

function isEmptyAnnotation(annotation: TransactionAnnotation): boolean {
	return Object.values(annotation).every((value) => {
		if (Array.isArray(value)) return value.length === 0;
		return value === undefined || value === null || value === '';
	});
}

export async function upsertAnnotation(
	accountId: string,
	transactionId: string,
	annotation: TransactionAnnotation,
	root?: string
): Promise<void> {
	const repo = await repoRoot(root);
	const file = await readStoredAccount(repo, accountId);
	if (!file) throw new Error('Account not found');
	if (file.account.source !== 'csv') throw new Error('Account does not use CSV annotations');
	const cleaned = cleanAnnotation(annotation);
	const annotations = { ...(file.annotations ?? {}) };
	if (isEmptyAnnotation(cleaned)) delete annotations[transactionId];
	else annotations[transactionId] = cleaned;
	file.annotations = annotations;
	await writeStoredAccount(repo, file);
	await commitData(repo, `data: annotate transaction ${transactionId} in ${accountId}`);
}

type TransferFields = Pick<
	TransactionAnnotation,
	'transfer_id' | 'counterpart_account_id' | 'counterpart_transaction_id'
>;

async function applyTransferFields(
	root: string,
	ref: TransactionRef,
	fields: TransferFields,
	options: { ignoreMissing?: boolean } = {}
): Promise<void> {
	const file = await readStoredAccount(root, ref.account_id);
	if (!file) {
		if (options.ignoreMissing) return;
		throw new Error('Account not found');
	}
	if (file.account.source === 'manual') {
		const transactions = file.transactions ?? [];
		const index = transactions.findIndex((transaction) => transaction.id === ref.transaction_id);
		if (index === -1) {
			if (options.ignoreMissing) return;
			throw new Error('Transaction not found');
		}
		transactions[index] = { ...transactions[index], ...fields, updated_at: now() };
		file.transactions = transactions;
	} else {
		const annotations = { ...(file.annotations ?? {}) };
		annotations[ref.transaction_id] = { ...(annotations[ref.transaction_id] ?? {}), ...fields };
		file.annotations = annotations;
	}
	await writeStoredAccount(root, file);
}

async function readTransferCounterpart(
	root: string,
	ref: TransactionRef
): Promise<TransactionRef | null> {
	const file = await readStoredAccount(root, ref.account_id);
	if (!file) return null;
	let counterpartAccount: string | null;
	let counterpartTransaction: string | null;
	if (file.account.source === 'manual') {
		const transaction = (file.transactions ?? []).find((item) => item.id === ref.transaction_id);
		counterpartAccount = transaction?.counterpart_account_id ?? null;
		counterpartTransaction = transaction?.counterpart_transaction_id ?? null;
	} else {
		const annotation = file.annotations?.[ref.transaction_id];
		counterpartAccount = annotation?.counterpart_account_id ?? null;
		counterpartTransaction = annotation?.counterpart_transaction_id ?? null;
	}
	if (!counterpartAccount || !counterpartTransaction) return null;
	return { account_id: counterpartAccount, transaction_id: counterpartTransaction };
}

const EMPTY_TRANSFER: TransferFields = {
	transfer_id: null,
	counterpart_account_id: null,
	counterpart_transaction_id: null
};

export async function linkTransfer(
	first: TransactionRef,
	second: TransactionRef,
	transferId = `tr_${randomUUID()}`,
	root?: string
): Promise<string> {
	const repo = await repoRoot(root);
	const [firstCounterpart, secondCounterpart] = await Promise.all([
		readTransferCounterpart(repo, first),
		readTransferCounterpart(repo, second)
	]);
	const clearCounterpart = async (
		counterpart: { account_id: string; transaction_id: string } | null,
		keep: TransactionRef
	) => {
		if (
			counterpart &&
			!(
				counterpart.account_id === keep.account_id &&
				counterpart.transaction_id === keep.transaction_id
			)
		) {
			await applyTransferFields(repo, counterpart, EMPTY_TRANSFER, { ignoreMissing: true });
		}
	};
	await clearCounterpart(firstCounterpart, second);
	await clearCounterpart(secondCounterpart, first);
	await applyTransferFields(repo, first, {
		transfer_id: transferId,
		counterpart_account_id: second.account_id,
		counterpart_transaction_id: second.transaction_id
	});
	await applyTransferFields(repo, second, {
		transfer_id: transferId,
		counterpart_account_id: first.account_id,
		counterpart_transaction_id: first.transaction_id
	});
	await commitData(repo, `data: link transfer ${transferId}`);
	return transferId;
}

export async function unlinkTransfer(ref: TransactionRef, root?: string): Promise<void> {
	const repo = await repoRoot(root);
	const counterpart = await readTransferCounterpart(repo, ref);
	await applyTransferFields(repo, ref, EMPTY_TRANSFER);
	if (counterpart) {
		await applyTransferFields(repo, counterpart, EMPTY_TRANSFER, { ignoreMissing: true });
	}
	await commitData(repo, `data: unlink transfer for ${ref.account_id}/${ref.transaction_id}`);
}

async function readProjectFile(root: string, id: string): Promise<Project | null> {
	return readJsonFile<Project | null>(path.join(root, 'projects', `${id}.json`), null);
}

export async function listProjects(root?: string): Promise<Project[]> {
	const repo = await repoRoot(root);
	const files = await listFilesRecursive(path.join(repo, 'projects'), (name) =>
		name.endsWith('.json')
	);
	const projects = await Promise.all(
		files.map(async (file) => {
			const project = await readJsonFile<Project | null>(path.join(repo, 'projects', file), null);
			return project;
		})
	);
	return projects
		.filter((project): project is Project => project !== null)
		.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readProject(id: string, root?: string): Promise<Project | null> {
	const repo = await repoRoot(root);
	return readProjectFile(repo, id);
}

async function uniqueProjectId(root: string, name: string): Promise<string> {
	const base = slugify(name);
	let candidate = base;
	let index = 2;
	while (await pathExists(path.join(root, 'projects', `${candidate}.json`))) {
		candidate = `${base}-${index}`;
		index += 1;
	}
	return candidate;
}

function cleanAllocations(allocations: ProjectAllocation[]): ProjectAllocation[] {
	return allocations
		.map((allocation) => ({
			account_id: allocation.account_id,
			transaction_id: allocation.transaction_id,
			amount_cents: Math.round(allocation.amount_cents),
			note: allocation.note?.trim() || undefined
		}))
		.filter(
			(allocation) =>
				allocation.account_id && allocation.transaction_id && allocation.amount_cents !== 0
		);
}

export async function createProject(
	input: { name: string; description?: string; allocations?: ProjectAllocation[] },
	root?: string
): Promise<Project> {
	const repo = await repoRoot(root);
	const id = await uniqueProjectId(repo, input.name);
	const timestamp = now();
	const project: Project = {
		id,
		name: input.name.trim(),
		description: input.description?.trim() || undefined,
		allocations: cleanAllocations(input.allocations ?? []),
		created_at: timestamp,
		updated_at: timestamp
	};
	await writeJsonFile(path.join(repo, 'projects', `${id}.json`), project);
	await commitData(repo, `data: create project ${id}`);
	return project;
}

export async function updateProject(
	id: string,
	patch: Partial<Pick<Project, 'name' | 'description' | 'allocations'>>,
	root?: string
): Promise<Project> {
	const repo = await repoRoot(root);
	const project = await readProjectFile(repo, id);
	if (!project) throw new Error('Project not found');
	const next: Project = {
		...project,
		name: patch.name?.trim() || project.name,
		description:
			patch.description === undefined ? project.description : patch.description.trim() || undefined,
		allocations:
			patch.allocations === undefined ? project.allocations : cleanAllocations(patch.allocations),
		updated_at: now()
	};
	await writeJsonFile(path.join(repo, 'projects', `${id}.json`), next);
	await commitData(repo, `data: update project ${id}`);
	return next;
}

export async function deleteProject(id: string, root?: string): Promise<void> {
	const repo = await repoRoot(root);
	if (!(await readProjectFile(repo, id))) throw new Error('Project not found');
	await removeFile(path.join(repo, 'projects', `${id}.json`));
	await commitData(repo, `data: delete project ${id}`);
}

async function readThirdPartyFile(root: string, id: string): Promise<ThirdParty | null> {
	return readJsonFile<ThirdParty | null>(path.join(root, 'third-parties', `${id}.json`), null);
}

export async function listThirdParties(root?: string): Promise<ThirdParty[]> {
	const repo = await repoRoot(root);
	const files = await listFilesRecursive(path.join(repo, 'third-parties'), (name) =>
		name.endsWith('.json')
	);
	const parties = await Promise.all(
		files.map((file) =>
			readJsonFile<ThirdParty | null>(path.join(repo, 'third-parties', file), null)
		)
	);
	return parties
		.filter((party): party is ThirdParty => party !== null)
		.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readThirdParty(id: string, root?: string): Promise<ThirdParty | null> {
	const repo = await repoRoot(root);
	return readThirdPartyFile(repo, id);
}

async function uniqueThirdPartyId(root: string, name: string): Promise<string> {
	const base = slugify(name);
	let candidate = base;
	let index = 2;
	while (await pathExists(path.join(root, 'third-parties', `${candidate}.json`))) {
		candidate = `${base}-${index}`;
		index += 1;
	}
	return candidate;
}

export async function createThirdParty(
	input: { name: string; aliases?: string[] },
	root?: string
): Promise<ThirdParty> {
	const repo = await repoRoot(root);
	const id = await uniqueThirdPartyId(repo, input.name);
	const timestamp = now();
	const party: ThirdParty = {
		id,
		name: input.name.trim(),
		aliases: input.aliases?.map((alias) => alias.trim()).filter(Boolean) ?? [],
		created_at: timestamp,
		updated_at: timestamp
	};
	await writeJsonFile(path.join(repo, 'third-parties', `${id}.json`), party);
	await commitData(repo, `data: create third party ${id}`);
	return party;
}

export async function updateThirdParty(
	id: string,
	patch: Partial<Pick<ThirdParty, 'name' | 'aliases'>>,
	root?: string
): Promise<ThirdParty> {
	const repo = await repoRoot(root);
	const party = await readThirdPartyFile(repo, id);
	if (!party) throw new Error('Third party not found');
	const next: ThirdParty = {
		...party,
		name: patch.name?.trim() || party.name,
		aliases:
			patch.aliases === undefined
				? party.aliases
				: patch.aliases.map((alias) => alias.trim()).filter(Boolean),
		updated_at: now()
	};
	await writeJsonFile(path.join(repo, 'third-parties', `${id}.json`), next);
	await commitData(repo, `data: update third party ${id}`);
	return next;
}

export async function deleteThirdParty(id: string, root?: string): Promise<void> {
	const repo = await repoRoot(root);
	if (!(await readThirdPartyFile(repo, id))) throw new Error('Third party not found');
	await removeFile(path.join(repo, 'third-parties', `${id}.json`));
	await commitData(repo, `data: delete third party ${id}`);
}

function safeDocumentName(fileName: string): string {
	const extension = path.extname(fileName).toLowerCase();
	const base = path
		.basename(fileName, extension)
		.toLowerCase()
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
	const safeExtension = /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '';
	return `${Date.now()}-${randomUUID()}-${base || 'document'}${safeExtension}`;
}

export async function saveDocument(
	fileName: string,
	data: Uint8Array,
	root?: string
): Promise<string> {
	const repo = await repoRoot(root);
	const safeName = safeDocumentName(fileName);
	const fullPath = path.join(repo, 'documents', safeName);
	await writeBinaryFile(fullPath, data);
	await commitData(repo, `data: add document ${safeName}`);
	return `documents/${safeName}`;
}

export async function deleteDocument(documentPath: string, root?: string): Promise<void> {
	const repo = await repoRoot(root);
	const normalizedPath = documentPath.split(path.sep).join('/');
	if (
		path.posix.normalize(normalizedPath) !== normalizedPath ||
		!normalizedPath.startsWith('documents/')
	) {
		throw new Error('Invalid document path');
	}
	const fullPath = safeJoin(repo, normalizedPath);
	await removeFile(fullPath);
	await commitData(repo, `data: delete document ${documentPath}`);
}

export async function listDocuments(root?: string): Promise<DocumentInfo[]> {
	const repo = await repoRoot(root);
	const files = await listFilesRecursive(path.join(repo, 'documents'));
	const documents = await Promise.all(
		files.map(async (file) => {
			const fullPath = safeJoin(repo, 'documents', file);
			const info = await stat(fullPath);
			return {
				path: `documents/${file.split(path.sep).join('/')}`,
				name: path.basename(file),
				size: info.size,
				modified_at: info.mtime.toISOString()
			};
		})
	);
	return documents.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readDocument(documentPath: string, root?: string): Promise<Buffer> {
	const repo = await repoRoot(root);
	if (!documentPath.startsWith('documents/')) throw new Error('Invalid document path');
	return readBinaryFile(safeJoin(repo, documentPath));
}

export async function writeAccountFile(root: string, file: StoredAccountFile): Promise<void> {
	await writeStoredAccount(root, file);
}

export async function writeAccountJsonOnly(
	accountId: string,
	account: Account,
	root?: string
): Promise<void> {
	const repo = await repoRoot(root);
	const file = await readStoredAccount(repo, accountId);
	if (!file) throw new Error('Account not found');
	file.account = account;
	await writeStoredAccount(repo, file);
}
