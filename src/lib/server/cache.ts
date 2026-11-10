import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { ManualTransaction, ParsedTransaction, TransactionAnnotation } from '$lib/types';
import { detectCsvFormat, parseCsvStatement } from './csv';
import { getEnv } from './env';
import { statusFingerprint } from './git';
import {
	ensureDataRepo,
	listDocuments,
	listProjects,
	listStoredAccounts,
	listThirdParties,
	type StoredAccountFile
} from './repository';
import { listFilesRecursive, readTextFile, safeJoin } from './store';

let database: DatabaseSync | null = null;
let databasePath: string | null = null;
let databaseFingerprint: string | null = null;

export async function getDatabase(): Promise<DatabaseSync> {
	const env = getEnv();
	const root = await ensureDataRepo();
	const fingerprint = await statusFingerprint(root);
	if (database && databasePath === env.cacheDbPath && databaseFingerprint === fingerprint) {
		return database;
	}
	await rebuildDatabase(root, env.cacheDbPath, fingerprint);
	return database as DatabaseSync;
}

export async function rebuildCache(): Promise<void> {
	database = null;
	databaseFingerprint = null;
	await getDatabase();
}

async function rebuildDatabase(root: string, dbPath: string, fingerprint: string): Promise<void> {
	if (database) {
		try {
			database.close();
		} catch {
			// ignore close errors on a disposable cache
		}
	}
	database = null;
	await mkdir(path.dirname(dbPath), { recursive: true });
	await rm(dbPath, { force: true });
	await rm(`${dbPath}-wal`, { force: true });
	await rm(`${dbPath}-shm`, { force: true });

	const db = new DatabaseSync(dbPath);
	db.exec(`
		PRAGMA foreign_keys = OFF;
		PRAGMA busy_timeout = 5000;
		CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
		CREATE TABLE accounts (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			type TEXT NOT NULL,
			currency TEXT NOT NULL,
			opening_balance_cents INTEGER NOT NULL,
			source TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE transactions (
			account_id TEXT NOT NULL,
			id TEXT NOT NULL,
			date TEXT NOT NULL,
			value_date TEXT,
			amount_cents INTEGER NOT NULL,
			currency TEXT NOT NULL,
			label TEXT NOT NULL,
			description TEXT,
			record_type TEXT NOT NULL,
			status TEXT,
			raw_json TEXT NOT NULL,
			attributes_json TEXT NOT NULL,
			source TEXT NOT NULL,
			source_files_json TEXT NOT NULL,
			counts_in_total INTEGER NOT NULL,
			third_party_id TEXT,
			notes TEXT NOT NULL,
			category TEXT NOT NULL,
			transfer_id TEXT,
			counterpart_account_id TEXT,
			counterpart_transaction_id TEXT,
			evidence_json TEXT NOT NULL,
			excluded INTEGER NOT NULL,
			PRIMARY KEY (account_id, id)
		);
		CREATE INDEX transactions_date_idx ON transactions(date);
		CREATE INDEX transactions_third_party_idx ON transactions(third_party_id);
		CREATE INDEX transactions_transfer_idx ON transactions(transfer_id);
		CREATE TABLE projects (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			allocations_json TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE project_allocations (
			project_id TEXT NOT NULL,
			account_id TEXT NOT NULL,
			transaction_id TEXT NOT NULL,
			amount_cents INTEGER NOT NULL,
			note TEXT,
			PRIMARY KEY (project_id, account_id, transaction_id)
		);
		CREATE TABLE third_parties (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			aliases_json TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
		CREATE TABLE documents (
			path TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			size INTEGER NOT NULL,
			modified_at TEXT NOT NULL
		);
		CREATE TABLE issues (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			account_id TEXT,
			source_file TEXT,
			message TEXT NOT NULL
		);
	`);

	const insertMeta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
	insertMeta.run('fingerprint', fingerprint);
	insertMeta.run('built_at', new Date().toISOString());

	const insertAccount = db.prepare(`
		INSERT INTO accounts (id, name, type, currency, opening_balance_cents, source, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`);
	const insertTransaction = db.prepare(`
		INSERT INTO transactions (
			account_id, id, date, value_date, amount_cents, currency, label, description,
			record_type, status, raw_json, attributes_json, source, source_files_json,
			counts_in_total, third_party_id, notes, category, transfer_id,
			counterpart_account_id, counterpart_transaction_id, evidence_json, excluded
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`);
	const insertIssue = db.prepare(
		'INSERT INTO issues (account_id, source_file, message) VALUES (?, ?, ?)'
	);

	const accounts = await listStoredAccounts(root);
	for (const accountFile of accounts) {
		const account = accountFile.account;
		insertAccount.run(
			account.id,
			account.name,
			account.type,
			account.currency,
			account.opening_balance_cents,
			account.source,
			account.created_at,
			account.updated_at
		);

		if (account.source === 'manual') {
			for (const transaction of accountFile.transactions ?? []) {
				insertTransaction.run(...manualTransactionValues(accountFile, transaction));
			}
			continue;
		}

		const statementFiles = await listCsvFiles(accountFile.dir);
		const byId = new Map<string, { transaction: ParsedTransaction; sourceFiles: Set<string> }>();
		for (const relativeFile of statementFiles) {
			const fullPath = safeJoin(accountFile.dir, 'statements', relativeFile);
			try {
				const content = await readTextFile(fullPath);
				const format = detectCsvFormat(content, account.type);
				if (!format) {
					insertIssue.run(account.id, relativeFile, 'Unsupported CSV format.');
					continue;
				}
				const parsed = parseCsvStatement(content, format);
				for (const error of parsed.errors) {
					insertIssue.run(account.id, relativeFile, error);
				}
				for (const transaction of parsed.transactions) {
					const existing = byId.get(transaction.id);
					if (existing) existing.sourceFiles.add(relativeFile);
					else {
						byId.set(transaction.id, {
							transaction,
							sourceFiles: new Set([relativeFile])
						});
					}
				}
			} catch (error) {
				insertIssue.run(
					account.id,
					relativeFile,
					error instanceof Error ? error.message : String(error)
				);
			}
		}

		for (const { transaction, sourceFiles } of byId.values()) {
			insertTransaction.run(
				...csvTransactionValues(accountFile, transaction, [...sourceFiles].sort())
			);
		}
	}

	const insertProject = db.prepare(`
		INSERT INTO projects (id, name, description, allocations_json, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`);
	const insertAllocation = db.prepare(`
		INSERT INTO project_allocations (project_id, account_id, transaction_id, amount_cents, note)
		VALUES (?, ?, ?, ?, ?)
	`);
	for (const project of await listProjects(root)) {
		insertProject.run(
			project.id,
			project.name,
			project.description ?? null,
			JSON.stringify(project.allocations),
			project.created_at,
			project.updated_at
		);
		for (const allocation of project.allocations) {
			insertAllocation.run(
				project.id,
				allocation.account_id,
				allocation.transaction_id,
				allocation.amount_cents,
				allocation.note ?? null
			);
		}
	}

	const insertThirdParty = db.prepare(
		'INSERT INTO third_parties (id, name, aliases_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
	);
	for (const party of await listThirdParties(root)) {
		insertThirdParty.run(
			party.id,
			party.name,
			JSON.stringify(party.aliases),
			party.created_at,
			party.updated_at
		);
	}

	const insertDocument = db.prepare(
		'INSERT INTO documents (path, name, size, modified_at) VALUES (?, ?, ?, ?)'
	);
	for (const document of await listDocuments(root)) {
		insertDocument.run(document.path, document.name, document.size, document.modified_at);
	}

	database = db;
	databasePath = dbPath;
	databaseFingerprint = fingerprint;
}

async function listCsvFiles(accountDir: string): Promise<string[]> {
	return listFilesRecursive(path.join(accountDir, 'statements'), (name) =>
		name.toLowerCase().endsWith('.csv')
	);
}

function csvTransactionValues(
	accountFile: StoredAccountFile,
	transaction: ParsedTransaction,
	sourceFiles: string[]
): (string | number | null)[] {
	const annotation: TransactionAnnotation | undefined = accountFile.annotations?.[transaction.id];
	const excluded = annotation?.excluded ?? false;
	return [
		accountFile.account.id,
		transaction.id,
		transaction.date,
		transaction.value_date ?? null,
		transaction.amount_cents,
		transaction.currency,
		transaction.label,
		transaction.description ?? null,
		transaction.record_type,
		transaction.status ?? null,
		JSON.stringify(transaction.raw),
		JSON.stringify(transaction.attributes ?? {}),
		'csv',
		JSON.stringify(sourceFiles),
		transaction.counts_in_total && !excluded ? 1 : 0,
		annotation?.third_party_id ?? null,
		annotation?.notes ?? '',
		annotation?.category ?? '',
		annotation?.transfer_id ?? null,
		annotation?.counterpart_account_id ?? null,
		annotation?.counterpart_transaction_id ?? null,
		JSON.stringify(annotation?.evidence ?? []),
		excluded ? 1 : 0
	];
}

function manualTransactionValues(
	accountFile: StoredAccountFile,
	transaction: ManualTransaction
): (string | number | null)[] {
	const excluded = transaction.excluded ?? false;
	const counts = (transaction.counts_in_total ?? !excluded) && !excluded;
	return [
		accountFile.account.id,
		transaction.id,
		transaction.date,
		transaction.value_date ?? null,
		Math.round(transaction.amount_cents),
		transaction.currency || accountFile.account.currency,
		transaction.label,
		transaction.description ?? null,
		transaction.record_type ?? 'manual',
		transaction.status ?? null,
		JSON.stringify([transaction.label, transaction.description ?? '']),
		'{}',
		'manual',
		'[]',
		counts ? 1 : 0,
		transaction.third_party_id ?? null,
		transaction.notes ?? '',
		transaction.category ?? '',
		transaction.transfer_id ?? null,
		transaction.counterpart_account_id ?? null,
		transaction.counterpart_transaction_id ?? null,
		JSON.stringify(transaction.evidence ?? []),
		excluded ? 1 : 0
	];
}
