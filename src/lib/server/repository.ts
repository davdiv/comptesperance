import { randomUUID } from 'node:crypto';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type {
	Account,
	AccountFile,
	AccountSource,
	ManualTransaction,
	ManualCheckpoint,
	Project,
	ProjectAllocation,
	ThirdParty,
	TransactionAnnotation
} from '#lib/types.ts';
import { ensureConfig } from './config';
import { detectCsvFormat, parseCsvStatement } from './csv';
import { getEnv } from './env';
import { commitAll, ensureGitRepo } from './git';
import {
	listDirectoryNames,
	listFilesRecursive,
	pathExists,
	readBinaryFile,
	readJsonFile,
	readTextFile,
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
		['accounts', 'projects', 'third-parties', 'documents', 'config'].map((dir) =>
			mkdir(path.join(target, dir), { recursive: true })
		)
	);
	await ensureConfig(target);
	return target;
}

export function slugify(value: string): string {
	const slug = value
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.slice(0, 60)
		.replace(/^-+|-+$/g, '');
	return slug || 'item';
}

const ENTITY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidEntityId(id: string): boolean {
	return ENTITY_ID_PATTERN.test(id);
}

function entityFilePath(root: string, dir: 'projects' | 'third-parties', id: string): string {
	if (!isValidEntityId(id)) throw new Error('Invalid id');
	return safeJoin(root, dir, `${id}.json`);
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
	const file: StoredAccountFile = { account, dir, checkpoints: parsed.checkpoints ?? [] };
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
	const payload: AccountFile = { account: stored.account, checkpoints: stored.checkpoints ?? [] };
	if (stored.account.source === 'manual') {
		payload.transactions = stored.transactions ?? [];
		await writeJsonFile(path.join(dir, 'account.json'), payload);
	} else {
		payload.annotations = stored.annotations ?? {};
		await writeJsonFile(path.join(dir, 'account.json'), {
			account: stored.account,
			checkpoints: payload.checkpoints
		});
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
		source: AccountSource;
		notes?: string;
		initial_checkpoint?: Omit<ManualCheckpoint, 'id'>;
	},
	root?: string
): Promise<Account> {
	const repo = await repoRoot(root);
	if (!ACCOUNT_SOURCES.includes(input.source)) throw new Error('Invalid account source');
	if (input.initial_checkpoint) validateCheckpoint(input.initial_checkpoint);
	const id = await uniqueAccountId(repo, input.name);
	const timestamp = now();
	const account: Account = {
		id,
		name: input.name.trim(),
		notes: input.notes?.trim() || undefined,
		source: input.source,
		created_at: timestamp,
		updated_at: timestamp
	};
	const file: StoredAccountFile = {
		account,
		dir: path.join(repo, 'accounts', id),
		checkpoints: input.initial_checkpoint ? [{ ...input.initial_checkpoint, id: randomUUID() }] : []
	};
	if (account.source === 'manual') file.transactions = [];
	else file.annotations = {};
	if (account.source === 'csv') await mkdir(path.join(file.dir, 'statements'), { recursive: true });
	await writeStoredAccount(repo, file);
	await commitData(repo, `data: create account ${id}`);
	return account;
}

export async function updateAccount(
	id: string,
	patch: Partial<Pick<Account, 'name' | 'notes'>>,
	root?: string
): Promise<Account> {
	const repo = await repoRoot(root);
	const file = await readStoredAccount(repo, id);
	if (!file) throw new Error('Account not found');
	file.account = {
		...file.account,
		...patch,
		updated_at: now()
	};
	await writeStoredAccount(repo, file);
	await commitData(repo, `data: update account ${id}`);
	return file.account;
}

function cleanManualTransaction(transaction: ManualTransaction): ManualTransaction {
	validateAllocations(transaction.amount_cents, transaction.allocations ?? []);
	return {
		...transaction,
		amount_cents: Math.round(transaction.amount_cents),
		record_type: transaction.record_type || 'manual',
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
	const transaction: ManualTransaction = cleanManualTransaction({
		...input,
		id: randomUUID(),
		created_at: timestamp,
		updated_at: timestamp
	});
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
	const next = cleanManualTransaction({
		...current,
		...patch,
		id: current.id,
		created_at: current.created_at,
		updated_at: now()
	});
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
	const transaction = (file.transactions ?? []).find((item) => item.id === transactionId);
	if (!transaction) throw new Error('Transaction not found');
	await removeTransferMemberInternal(repo, {
		account_id: accountId,
		transaction_id: transactionId
	});
	const currentFile = await readStoredAccount(repo, accountId);
	if (!currentFile) throw new Error('Account not found');
	file.transactions = currentFile.transactions;
	file.transactions = (file.transactions ?? []).filter(
		(transaction) => transaction.id !== transactionId
	);
	await writeStoredAccount(repo, file);
	await commitData(repo, `data: delete transaction ${transactionId} from ${accountId}`);
}

function cleanAnnotation(annotation: TransactionAnnotation): TransactionAnnotation {
	const cleaned: TransactionAnnotation = {};
	if (annotation.notes?.trim()) cleaned.notes = annotation.notes.trim();
	if (annotation.category_id !== undefined) cleaned.category_id = annotation.category_id.trim();
	if (annotation.payment_mode_id !== undefined)
		cleaned.payment_mode_id = annotation.payment_mode_id.trim();
	if (annotation.allocations) cleaned.allocations = annotation.allocations;
	if (annotation.third_party_id) cleaned.third_party_id = annotation.third_party_id;
	if (annotation.transfer_id) cleaned.transfer_id = annotation.transfer_id;
	if (annotation.evidence?.length) cleaned.evidence = annotation.evidence.filter(Boolean);
	if (annotation.excluded !== undefined) cleaned.excluded = annotation.excluded;
	return cleaned;
}

function isEmptyAnnotation(annotation: TransactionAnnotation): boolean {
	if (annotation.payment_mode_id !== undefined || annotation.category_id !== undefined)
		return false;
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
	if (annotation.allocations)
		validateAllocations(
			(await findCsvTransaction(file, transactionId)).amount_cents,
			annotation.allocations
		);
	const cleaned = cleanAnnotation({
		...annotation,
		payment_mode_id:
			annotation.payment_mode_id ?? file.annotations?.[transactionId]?.payment_mode_id
	});
	const annotations = { ...(file.annotations ?? {}) };
	if (isEmptyAnnotation(cleaned)) delete annotations[transactionId];
	else annotations[transactionId] = cleaned;
	file.annotations = annotations;
	await writeStoredAccount(repo, file);
	await commitData(repo, `data: annotate transaction ${transactionId} in ${accountId}`);
}

async function storedTransferMembers(root: string, id: string): Promise<TransactionRef[]> {
	const members: TransactionRef[] = [];
	for (const file of await listStoredAccounts(root)) {
		const items =
			file.account.source === 'manual'
				? (file.transactions ?? []).map((item) => [item.id, item] as const)
				: Object.entries(file.annotations ?? {});
		for (const [transaction_id, item] of items)
			if (item.transfer_id === id) members.push({ account_id: file.account.id, transaction_id });
	}
	return members;
}
async function transferRecord(root: string, ref: TransactionRef) {
	const file = await readStoredAccount(root, ref.account_id);
	if (!file) throw new Error('transfer_invalid');
	if (file.account.source === 'manual') {
		const transaction = file.transactions?.find((item) => item.id === ref.transaction_id);
		if (!transaction) throw new Error('transfer_invalid');
		return { file, transaction };
	}
	await findCsvTransaction(file, ref.transaction_id);
	return { file, transaction: file.annotations?.[ref.transaction_id] ?? {} };
}
async function setTransferId(root: string, ref: TransactionRef, transfer_id: string | null) {
	const file = await readStoredAccount(root, ref.account_id);
	if (!file) return;
	if (file.account.source === 'manual') {
		file.transactions = (file.transactions ?? []).map((item) =>
			item.id === ref.transaction_id ? { ...item, transfer_id } : item
		);
	} else {
		file.annotations = {
			...file.annotations,
			[ref.transaction_id]: { ...file.annotations?.[ref.transaction_id], transfer_id }
		};
	}
	await writeStoredAccount(root, file);
}
async function removeTransferMemberInternal(root: string, ref: TransactionRef) {
	const { transaction } = await transferRecord(root, ref);
	if (!transaction.transfer_id) return;
	const remaining = (await storedTransferMembers(root, transaction.transfer_id)).filter(
		(item) => item.account_id !== ref.account_id || item.transaction_id !== ref.transaction_id
	);
	await setTransferId(root, ref, null);
	if (remaining.length < 2 || new Set(remaining.map((item) => item.account_id)).size < 2) {
		for (const member of remaining) await setTransferId(root, member, null);
	}
}
export async function createTransferGroups(
	groups: TransactionRef[][],
	root?: string
): Promise<string[]> {
	const repo = await repoRoot(root);
	const seen = new Set<string>();
	for (const refs of groups) {
		if (refs.length < 2 || new Set(refs.map((ref) => ref.account_id)).size < 2)
			throw new Error('transfer_invalid');
		for (const ref of refs) {
			const key = JSON.stringify([ref.account_id, ref.transaction_id]);
			if (seen.has(key)) throw new Error('transfer_invalid');
			seen.add(key);
			if ((await transferRecord(repo, ref)).transaction.transfer_id)
				throw new Error('transfer_invalid');
		}
	}
	const ids: string[] = [];
	for (const refs of groups) {
		const id = 'tr_' + randomUUID();
		ids.push(id);
		for (const ref of refs) await setTransferId(repo, ref, id);
	}
	if (ids.length) await commitData(repo, 'data: create transfer groups');
	return ids;
}
export async function createTransferGroup(refs: TransactionRef[], root?: string): Promise<string> {
	return (await createTransferGroups([refs], root))[0];
}
export async function addTransferMember(
	id: string,
	ref: TransactionRef,
	root?: string
): Promise<void> {
	const repo = await repoRoot(root);
	const members = await storedTransferMembers(repo, id);
	if (members.length < 2 || (await transferRecord(repo, ref)).transaction.transfer_id)
		throw new Error('transfer_invalid');
	await setTransferId(repo, ref, id);
	await commitData(repo, 'data: add transfer member');
}
export async function unlinkTransfer(ref: TransactionRef, root?: string): Promise<void> {
	const repo = await repoRoot(root);
	await removeTransferMemberInternal(repo, ref);
	await commitData(repo, 'data: remove transfer member');
}
export async function linkTransfer(
	first: TransactionRef,
	second: TransactionRef,
	root?: string
): Promise<string> {
	return createTransferGroup([first, second], root);
}

async function readProjectFile(root: string, id: string): Promise<Project | null> {
	if (!isValidEntityId(id)) return null;
	return readJsonFile<Project | null>(entityFilePath(root, 'projects', id), null);
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
	while (await pathExists(entityFilePath(root, 'projects', candidate))) {
		candidate = `${base}-${index}`;
		index += 1;
	}
	return candidate;
}

export async function createProject(
	input: { name: string; description?: string },
	root?: string
): Promise<Project> {
	const repo = await repoRoot(root);
	const id = await uniqueProjectId(repo, input.name);
	const timestamp = now();
	const project: Project = {
		id,
		name: input.name.trim(),
		description: input.description?.trim() || undefined,
		created_at: timestamp,
		updated_at: timestamp
	};
	await writeJsonFile(entityFilePath(repo, 'projects', id), project);
	await commitData(repo, `data: create project ${id}`);
	return project;
}

export async function updateProject(
	id: string,
	patch: Partial<Pick<Project, 'name' | 'description'>>,
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
		updated_at: now()
	};
	await writeJsonFile(entityFilePath(repo, 'projects', id), next);
	await commitData(repo, `data: update project ${id}`);
	return next;
}

export async function deleteProject(id: string, root?: string): Promise<void> {
	const repo = await repoRoot(root);
	if (!(await readProjectFile(repo, id))) throw new Error('Project not found');
	for (const file of await listStoredAccounts(repo)) {
		let changed = false;
		for (const item of file.account.source === 'manual'
			? (file.transactions ?? [])
			: Object.values(file.annotations ?? {})) {
			const next = (item.allocations ?? []).filter((allocation) => allocation.project_id !== id);
			if (next.length !== (item.allocations ?? []).length) {
				item.allocations = next;
				changed = true;
			}
		}
		if (changed) await writeStoredAccount(repo, file);
	}
	await removeFile(entityFilePath(repo, 'projects', id));
	await commitData(repo, `data: delete project ${id}`);
}

async function readThirdPartyFile(root: string, id: string): Promise<ThirdParty | null> {
	if (!isValidEntityId(id)) return null;
	return readJsonFile<ThirdParty | null>(entityFilePath(root, 'third-parties', id), null);
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
	while (await pathExists(entityFilePath(root, 'third-parties', candidate))) {
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
	await writeJsonFile(entityFilePath(repo, 'third-parties', id), party);
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
	await writeJsonFile(entityFilePath(repo, 'third-parties', id), next);
	await commitData(repo, `data: update third party ${id}`);
	return next;
}

export async function deleteThirdParty(id: string, root?: string): Promise<void> {
	const repo = await repoRoot(root);
	if (!(await readThirdPartyFile(repo, id))) throw new Error('Third party not found');
	await removeFile(entityFilePath(repo, 'third-parties', id));
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
		.slice(0, 60)
		.replace(/^-+|-+$/g, '');
	const safeExtension = /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '';
	return `${Date.now()}-${randomUUID()}-${base || 'document'}${safeExtension}`;
}

export async function saveDocument(
	fileName: string,
	data: Uint8Array,
	root?: string
): Promise<string> {
	return (await saveDocuments([{ name: fileName, data }], root))[0];
}

export async function saveDocuments(
	files: { name: string; data: Uint8Array }[],
	root?: string
): Promise<string[]> {
	if (!files.length) throw new Error('Select at least one file');
	const repo = await repoRoot(root);
	const paths: string[] = [];
	try {
		for (const file of files) {
			const documentPath = `documents/${safeDocumentName(file.name)}`;
			paths.push(documentPath);
			await writeBinaryFile(safeJoin(repo, documentPath), file.data);
		}
	} catch (error) {
		await Promise.all(paths.map((documentPath) => removeFile(safeJoin(repo, documentPath))));
		throw error;
	}
	await commitData(repo, `data: add ${paths.length} documents`);
	return paths;
}

async function appendEvidence(root: string, ref: TransactionRef, paths: string[]): Promise<void> {
	const file = await readStoredAccount(root, ref.account_id);
	if (!file) throw new Error('Account not found');
	if (file.account.source === 'manual') {
		const transaction = file.transactions?.find((item) => item.id === ref.transaction_id);
		if (!transaction) throw new Error('Transaction not found');
		transaction.evidence = [...new Set([...(transaction.evidence ?? []), ...paths])];
		transaction.updated_at = now();
	} else {
		const annotations = file.annotations ?? {};
		const annotation = annotations[ref.transaction_id] ?? {};
		annotations[ref.transaction_id] = {
			...annotation,
			evidence: [...new Set([...(annotation.evidence ?? []), ...paths])]
		};
		file.annotations = annotations;
	}
	await writeStoredAccount(root, file);
}

export async function linkDocument(
	ref: TransactionRef,
	documentPath: string,
	root?: string
): Promise<void> {
	const repo = await repoRoot(root);
	if (!(await listDocuments(repo)).some((document) => document.path === documentPath)) {
		throw new Error('Document not found');
	}
	await appendEvidence(repo, ref, [documentPath]);
	await commitData(repo, `data: link document to ${ref.account_id}/${ref.transaction_id}`);
}

export async function uploadEvidence(
	ref: TransactionRef,
	files: { name: string; data: Uint8Array }[],
	root?: string
): Promise<string[]> {
	if (!files.length) throw new Error('Select at least one file');
	for (const file of files) {
		if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name)) throw new Error('Unsupported file type');
		if (file.data.byteLength > getEnv().maxEvidenceBytes) throw new Error('File is too large');
	}
	const repo = await repoRoot(root);
	const account = await readStoredAccount(repo, ref.account_id);
	if (
		!account ||
		(account.account.source === 'manual' &&
			!account.transactions?.some((t) => t.id === ref.transaction_id))
	) {
		throw new Error('Transaction not found');
	}
	const paths: string[] = [];
	try {
		for (const file of files) {
			const documentPath = `documents/${safeDocumentName(file.name)}`;
			paths.push(documentPath);
			await writeBinaryFile(safeJoin(repo, documentPath), file.data);
		}
		await appendEvidence(repo, ref, paths);
	} catch (error) {
		await Promise.all(paths.map((documentPath) => removeFile(safeJoin(repo, documentPath))));
		throw error;
	}
	await commitData(
		repo,
		`data: attach ${paths.length} documents to ${ref.account_id}/${ref.transaction_id}`
	);
	return paths;
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
	for (const file of await listStoredAccounts(repo)) {
		let changed = false;
		if (file.account.source === 'manual') {
			for (const transaction of file.transactions ?? []) {
				if (transaction.evidence?.includes(normalizedPath)) {
					transaction.evidence = transaction.evidence.filter((item) => item !== normalizedPath);
					transaction.updated_at = now();
					changed = true;
				}
			}
		} else {
			for (const annotation of Object.values(file.annotations ?? {})) {
				if (annotation.evidence?.includes(normalizedPath)) {
					annotation.evidence = annotation.evidence.filter((item) => item !== normalizedPath);
					changed = true;
				}
			}
		}
		if (changed) await writeStoredAccount(repo, file);
	}
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

export function validateAllocations(amount: number, allocations: ProjectAllocation[]): void {
	if (!Number.isSafeInteger(amount)) throw new Error('allocation_invalid');
	const ids = new Set<string>();
	let allocated = 0;
	for (const allocation of allocations) {
		if (
			!allocation.project_id ||
			ids.has(allocation.project_id) ||
			!Number.isSafeInteger(allocation.amount_cents) ||
			allocation.amount_cents === 0 ||
			Math.sign(allocation.amount_cents) !== Math.sign(amount)
		)
			throw new Error('allocation_invalid');
		ids.add(allocation.project_id);
		allocated += Math.abs(allocation.amount_cents);
	}
	if (allocated > Math.abs(amount)) throw new Error('allocation_exceeded');
}

async function findCsvTransaction(file: StoredAccountFile, id: string) {
	for (const relative of await listFilesRecursive(path.join(file.dir, 'statements'), (name) =>
		name.toLowerCase().endsWith('.csv')
	)) {
		const content = await readTextFile(safeJoin(file.dir, 'statements', relative));
		const format = detectCsvFormat(content);
		if (!format) continue;
		const transaction = parseCsvStatement(content, format).transactions.find(
			(item) => item.id === id
		);
		if (transaction) return transaction;
	}
	throw new Error('Transaction not found');
}

export async function setTransactionAllocations(
	ref: TransactionRef,
	allocations: ProjectAllocation[],
	root?: string
): Promise<void> {
	const repo = await repoRoot(root);
	const existingAllocations: ProjectAllocation[] = [];
	for (const allocation of allocations) {
		if (await readProjectFile(repo, allocation.project_id)) existingAllocations.push(allocation);
	}
	const file = await readStoredAccount(repo, ref.account_id);
	if (!file) throw new Error('Account not found');
	if (file.account.source === 'manual') {
		await updateManualTransaction(
			ref.account_id,
			ref.transaction_id,
			{ allocations: existingAllocations },
			repo
		);
	} else {
		const annotation = file.annotations?.[ref.transaction_id] ?? {};
		await upsertAnnotation(
			ref.account_id,
			ref.transaction_id,
			{ ...annotation, allocations: existingAllocations },
			repo
		);
	}
}

function validateCheckpoint(input: Omit<ManualCheckpoint, 'id'>): void {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isSafeInteger(input.balance_cents))
		throw new Error('checkpoint_invalid');
	const parsed = new Date(input.date + 'T00:00:00.000Z');
	if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input.date)
		throw new Error('checkpoint_invalid');
}

export async function addManualCheckpoint(
	accountId: string,
	input: Omit<ManualCheckpoint, 'id'>,
	root?: string
): Promise<ManualCheckpoint> {
	validateCheckpoint(input);
	const repo = await repoRoot(root);
	const file = await readStoredAccount(repo, accountId);
	if (!file) throw new Error('Account not found');
	const checkpoint = { ...input, note: input.note?.trim() || undefined, id: randomUUID() };
	file.checkpoints = [...(file.checkpoints ?? []), checkpoint];
	await writeStoredAccount(repo, file);
	await commitData(repo, `data: add checkpoint to ${accountId}`);
	return checkpoint;
}

export async function deleteManualCheckpoint(
	accountId: string,
	id: string,
	root?: string
): Promise<void> {
	const repo = await repoRoot(root);
	const file = await readStoredAccount(repo, accountId);
	if (!file) throw new Error('Account not found');
	if (!file.checkpoints?.some((checkpoint) => checkpoint.id === id))
		throw new Error('Checkpoint not found');
	file.checkpoints = file.checkpoints.filter((checkpoint) => checkpoint.id !== id);
	await writeStoredAccount(repo, file);
	await commitData(repo, `data: delete checkpoint from ${accountId}`);
}
