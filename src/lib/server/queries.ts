import { summarizeTransferGroup } from './transfer-groups';
import type {
	AccountSource,
	AccountTotals,
	CachedTransaction,
	Project,
	BalanceCheckpoint
} from '$lib/types';
import { calculateBalance, type BalanceResult } from './balances';
import { getDatabase } from './cache';
import { listDocuments } from './repository';

export interface AccountWithTotals extends AccountTotals, BalanceResult {
	name: string;
	notes?: string;
	source: AccountSource;
}

export interface TransactionView extends CachedTransaction {
	allocation_details: (CachedTransaction['allocations'][number] & {
		project_name: string | null;
	})[];
	third_party_name: string | null;
	category_name: string | null;
	payment_mode_name: string | null;
}

export interface TransactionFilters {
	account_id?: string;
	third_party_id?: string;
	search?: string;
	project_id?: string;
	allocation_status?: string;
	date_from?: string;
	date_to?: string;
	record_type?: string;
	category_id?: string;
	payment_mode_id?: string;
	include_transfers?: boolean;
	limit?: number;
	offset?: number;
}

export interface ProjectAllocationView {
	project_id: string;
	account_id: string;
	account_name: string | null;
	transaction_id: string;
	amount_cents: number;
	note: string | null;
	transaction: TransactionView | null;
}

export interface ProjectDetails {
	project: Project;
	total_cents: number;
	by_account: {
		account_id: string;
		account_name: string | null;
		amount_cents: number;
		count: number;
	}[];
	allocations: ProjectAllocationView[];
}

export interface ThirdPartyWithCounts {
	id: string;
	name: string;
	aliases: string[];
	created_at: string;
	updated_at: string;
	transaction_count: number;
	total_cents: number;
}

export interface IssueRow {
	id: number;
	account_id: string | null;
	source_file: string | null;
	message: string;
}

function parseJsonArray<T>(value: unknown): T[] {
	try {
		const parsed = JSON.parse(String(value ?? '[]')) as unknown;
		return Array.isArray(parsed) ? (parsed as T[]) : [];
	} catch {
		return [];
	}
}

function parseJsonObject<T>(value: unknown): T {
	try {
		const parsed = JSON.parse(String(value ?? '{}')) as unknown;
		return parsed && typeof parsed === 'object' ? (parsed as T) : ({} as T);
	} catch {
		return {} as T;
	}
}

function stringOrNull(value: unknown): string | null {
	return value === null || value === undefined || value === '' ? null : String(value);
}

function transactionFromRow(row: Record<string, unknown>): TransactionView {
	return {
		account_id: String(row.account_id),
		id: String(row.id),
		date: String(row.date),
		value_date: stringOrNull(row.value_date) ?? undefined,
		amount_cents: Number(row.amount_cents),
		label: String(row.label ?? ''),
		description: stringOrNull(row.description) ?? undefined,
		record_type: String(row.record_type),
		status: stringOrNull(row.status) ?? undefined,
		raw: parseJsonArray<string>(row.raw_json),
		attributes: parseJsonObject<Record<string, string>>(row.attributes_json),
		source: row.source as AccountSource,
		source_files: parseJsonArray<string>(row.source_files_json),
		third_party_id: stringOrNull(row.third_party_id),
		notes: String(row.notes ?? ''),
		category_id: String(row.category_id ?? ''),
		payment_mode_id: String(row.payment_mode_id ?? ''),
		allocations: parseJsonArray(row.allocations_json),
		allocation_details: parseJsonArray(row.named_allocations_json),
		category_name: stringOrNull(row.category_name),
		payment_mode_name: stringOrNull(row.payment_mode_name),
		transfer_id: stringOrNull(row.transfer_id),
		evidence: parseJsonArray<string>(row.evidence_json),
		excluded: Number(row.excluded) === 1,
		third_party_name: stringOrNull(row.third_party_name)
	};
}

const TRANSACTION_SELECT = `
	SELECT t.*, tp.name AS third_party_name, c.name AS category_name, pm.name AS payment_mode_name,
  (SELECT json_group_array(json_object('project_id', pa.project_id, 'amount_cents', pa.amount_cents, 'note', pa.note, 'project_name', p.name))
   FROM project_allocations pa LEFT JOIN projects p ON p.id = pa.project_id
   WHERE pa.account_id = t.account_id AND pa.transaction_id = t.id) AS named_allocations_json
	FROM transactions t
	LEFT JOIN third_parties tp ON tp.id = t.third_party_id
	LEFT JOIN categories c ON c.id = t.category_id
	LEFT JOIN payment_modes pm ON pm.id = t.payment_mode_id
`;

const NON_TRANSFER_CONDITION = 't.transfer_id IS NULL';

export async function listAccountsWithTotals(): Promise<AccountWithTotals[]> {
	const db = await getDatabase();
	const rows = db
		.prepare(
			`SELECT
				a.id, a.name, a.notes, a.source,
				COALESCE(SUM(CASE WHEN t.excluded = 0 AND t.amount_cents > 0 THEN t.amount_cents ELSE 0 END), 0) AS incoming_cents,
				COALESCE(SUM(CASE WHEN t.excluded = 0 AND t.amount_cents < 0 THEN t.amount_cents ELSE 0 END), 0) AS outgoing_cents,
				COUNT(t.id) AS transaction_count
			FROM accounts a
			LEFT JOIN transactions t ON t.account_id = a.id
			GROUP BY a.id, a.name, a.notes, a.source
			ORDER BY a.name`
		)
		.all() as Record<string, unknown>[];
	const checkpointQuery = db.prepare('SELECT * FROM balance_checkpoints WHERE account_id = ?');
	const transactionQuery = db.prepare(
		'SELECT date, amount_cents FROM transactions WHERE account_id = ? AND excluded = 0'
	);
	return rows.map((row) => {
		const checkpoints = checkpointQuery
			.all(String(row.id))
			.map((checkpoint): BalanceCheckpoint => ({
				id: String(checkpoint.id),
				date: String(checkpoint.date),
				balance_cents: Number(checkpoint.balance_cents),
				source: checkpoint.source as BalanceCheckpoint['source'],
				note: stringOrNull(checkpoint.note) ?? undefined,
				statement_file: stringOrNull(checkpoint.statement_file) ?? undefined
			}));
		const transactions = transactionQuery.all(String(row.id)).map((transaction) => ({
			date: String(transaction.date),
			amount_cents: Number(transaction.amount_cents)
		}));
		const incoming = Number(row.incoming_cents);
		const outgoing = Number(row.outgoing_cents);
		return {
			account_id: String(row.id),
			name: String(row.name),
			notes: stringOrNull(row.notes) ?? undefined,
			source: row.source as AccountSource,
			incoming_cents: incoming,
			outgoing_cents: outgoing,
			transaction_count: Number(row.transaction_count),
			...calculateBalance(checkpoints, transactions)
		};
	});
}

export async function getAccountWithTotals(accountId: string): Promise<AccountWithTotals | null> {
	const accounts = await listAccountsWithTotals();
	return accounts.find((account) => account.account_id === accountId) ?? null;
}

export async function listTransactions(
	filters: TransactionFilters = {}
): Promise<{ transactions: TransactionView[]; total: number }> {
	const db = await getDatabase();
	const where: string[] = [];
	const params: (string | number)[] = [];

	if (filters.account_id) {
		where.push('t.account_id = ?');
		params.push(filters.account_id);
	}
	if (filters.third_party_id) {
		where.push('t.third_party_id = ?');
		params.push(filters.third_party_id);
	}
	if (filters.date_from) {
		where.push('t.date >= ?');
		params.push(filters.date_from);
	}
	if (filters.date_to) {
		where.push("t.date < date(?, '+1 day')");
		params.push(filters.date_to);
	}
	for (const field of ['category_id', 'payment_mode_id'] as const) {
		if (filters[field]) {
			where.push(`t.${field} = ?`);
			params.push(filters[field]!);
		}
	}
	if (filters.project_id) {
		where.push(
			'EXISTS (SELECT 1 FROM project_allocations pa WHERE pa.account_id = t.account_id AND pa.transaction_id = t.id AND pa.project_id = ?)'
		);
		params.push(filters.project_id);
	}
	const allocationExists =
		'EXISTS (SELECT 1 FROM project_allocations pa WHERE pa.account_id = t.account_id AND pa.transaction_id = t.id)';
	const allocatedAmount =
		'(SELECT COALESCE(SUM(ABS(pa.amount_cents)), 0) FROM project_allocations pa WHERE pa.account_id = t.account_id AND pa.transaction_id = t.id)';
	if (filters.allocation_status === 'allocated') {
		where.push(allocationExists);
		where.push(allocatedAmount + ' = ABS(t.amount_cents)');
	}
	if (filters.allocation_status === 'unallocated') where.push('NOT ' + allocationExists);
	if (filters.allocation_status === 'partial') {
		where.push(allocationExists);
		where.push(allocatedAmount + ' > 0');
		where.push(allocatedAmount + ' < ABS(t.amount_cents)');
	}
	if (filters.record_type) {
		where.push('t.record_type = ?');
		params.push(filters.record_type);
	}
	if (!filters.include_transfers) {
		where.push(NON_TRANSFER_CONDITION);
	}
	if (filters.search?.trim()) {
		const search = `%${filters.search.trim()}%`;
		where.push(
			`(t.label LIKE ? OR COALESCE(t.description, '') LIKE ? OR t.notes LIKE ? OR COALESCE(c.name, '') LIKE ? OR COALESCE(pm.name, '') LIKE ? OR COALESCE(tp.name, '') LIKE ?)`
		);
		params.push(search, search, search, search, search, search);
	}

	const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
	const total = Number(
		(
			db
				.prepare(
					`SELECT COUNT(*) AS count FROM transactions t
					 LEFT JOIN third_parties tp ON tp.id = t.third_party_id
					 LEFT JOIN categories c ON c.id = t.category_id
					 LEFT JOIN payment_modes pm ON pm.id = t.payment_mode_id ${whereSql}`
				)
				.get(...params) as { count: number }
		).count
	);
	const limit = Math.min(Math.max(filters.limit ?? 200, 1), 1000);
	const offset = Math.max(filters.offset ?? 0, 0);
	const rows = db
		.prepare(
			`${TRANSACTION_SELECT} ${whereSql} ORDER BY t.date DESC, t.account_id, t.id LIMIT ? OFFSET ?`
		)
		.all(...params, limit, offset) as Record<string, unknown>[];
	return { transactions: rows.map(transactionFromRow), total };
}

export async function getTransaction(
	accountId: string,
	transactionId: string
): Promise<TransactionView | null> {
	const db = await getDatabase();
	const row = db
		.prepare(`${TRANSACTION_SELECT} WHERE t.account_id = ? AND t.id = ?`)
		.get(accountId, transactionId) as Record<string, unknown> | undefined;
	return row ? transactionFromRow(row) : null;
}

export async function listTransactionCandidates(
	accountId?: string,
	limit = 500
): Promise<TransactionView[]> {
	const result = await listTransactions({
		account_id: accountId,
		include_transfers: true,
		limit: Math.min(Math.max(limit, 1), 1000),
		offset: 0
	});
	return result.transactions;
}

export async function listProjectsWithTotals(): Promise<
	(Project & { total_cents: number; allocation_count: number })[]
> {
	const db = await getDatabase();
	const projects = db
		.prepare(
			`SELECT p.*, COALESCE(SUM(pa.amount_cents), 0) AS total_cents, COUNT(pa.transaction_id) AS allocation_count
			FROM projects p
			LEFT JOIN project_allocations pa ON pa.project_id = p.id
				AND EXISTS (SELECT 1 FROM transactions t
					WHERE t.account_id = pa.account_id AND t.id = pa.transaction_id AND ${NON_TRANSFER_CONDITION})
			GROUP BY p.id
			ORDER BY p.name`
		)
		.all() as Record<string, unknown>[];
	return projects.map((row) => ({
		id: String(row.id),
		name: String(row.name),
		description: stringOrNull(row.description) ?? undefined,
		created_at: String(row.created_at),
		updated_at: String(row.updated_at),
		total_cents: Number(row.total_cents),
		allocation_count: Number(row.allocation_count)
	}));
}

export async function getProjectDetails(
	projectId: string,
	includeTransfers = false
): Promise<ProjectDetails | null> {
	const db = await getDatabase();
	const projectRow = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as
		Record<string, unknown> | undefined;
	if (!projectRow) return null;
	const transferFilter = includeTransfers ? '' : `AND ${NON_TRANSFER_CONDITION}`;
	const rows = db
		.prepare(
			`SELECT
				pa.project_id, pa.account_id, pa.transaction_id, pa.amount_cents, pa.note,
				a.name AS account_name,
				t.id, t.date, t.value_date, t.amount_cents AS transaction_amount_cents,
				t.label, t.description, t.record_type, t.status, t.third_party_id,
 tp.name AS third_party_name, t.transfer_id, t.notes, t.category_id, t.payment_mode_id, t.allocations_json, t.evidence_json,
				t.excluded, t.source, t.source_files_json, t.raw_json, t.attributes_json
			FROM project_allocations pa
			LEFT JOIN accounts a ON a.id = pa.account_id
			JOIN transactions t ON t.account_id = pa.account_id AND t.id = pa.transaction_id
			LEFT JOIN third_parties tp ON tp.id = t.third_party_id
			WHERE pa.project_id = ? ${transferFilter}
			ORDER BY a.name, t.date DESC`
		)
		.all(projectId) as Record<string, unknown>[];

	const allocations: ProjectAllocationView[] = rows.map((row) => {
		const transaction = row.id
			? transactionFromRow({
					account_id: row.account_id,
					id: row.id,
					date: row.date,
					value_date: row.value_date,
					amount_cents: row.transaction_amount_cents,
					label: row.label,
					description: row.description,
					record_type: row.record_type,
					status: row.status,
					third_party_id: row.third_party_id,
					third_party_name: row.third_party_name,
					transfer_id: row.transfer_id,
					notes: row.notes,
					category_id: row.category_id,
					payment_mode_id: row.payment_mode_id,
					allocations_json: row.allocations_json,
					evidence_json: row.evidence_json,
					excluded: row.excluded,
					source: row.source,
					source_files_json: row.source_files_json,
					raw_json: row.raw_json,
					attributes_json: row.attributes_json
				})
			: null;
		return {
			project_id: String(row.project_id),
			account_id: String(row.account_id),
			account_name: stringOrNull(row.account_name),
			transaction_id: String(row.transaction_id),
			amount_cents: Number(row.amount_cents),
			note: stringOrNull(row.note),
			transaction
		};
	});

	const byAccountMap = new Map<
		string,
		{ account_id: string; account_name: string | null; amount_cents: number; count: number }
	>();
	for (const allocation of allocations) {
		const current = byAccountMap.get(allocation.account_id) ?? {
			account_id: allocation.account_id,
			account_name: allocation.account_name,
			amount_cents: 0,
			count: 0
		};
		current.amount_cents += allocation.amount_cents;
		current.count += 1;
		byAccountMap.set(allocation.account_id, current);
	}

	const project: Project = {
		id: String(projectRow.id),
		name: String(projectRow.name),
		description: stringOrNull(projectRow.description) ?? undefined,
		created_at: String(projectRow.created_at),
		updated_at: String(projectRow.updated_at)
	};

	return {
		project,
		total_cents: allocations.reduce((sum, allocation) => sum + allocation.amount_cents, 0),
		by_account: [...byAccountMap.values()].sort((a, b) =>
			(a.account_name ?? a.account_id).localeCompare(b.account_name ?? b.account_id)
		),
		allocations
	};
}

export async function listThirdPartiesWithCounts(): Promise<ThirdPartyWithCounts[]> {
	const db = await getDatabase();
	const rows = db
		.prepare(
			`SELECT tp.id, tp.name, tp.aliases_json, tp.created_at, tp.updated_at,
				COUNT(t.id) AS transaction_count,
				COALESCE(SUM(CASE WHEN t.excluded = 0 THEN t.amount_cents ELSE 0 END), 0) AS total_cents
			FROM third_parties tp
			LEFT JOIN transactions t ON t.third_party_id = tp.id
			GROUP BY tp.id
			ORDER BY tp.name`
		)
		.all() as Record<string, unknown>[];
	return rows.map((row) => ({
		id: String(row.id),
		name: String(row.name),
		aliases: parseJsonArray<string>(row.aliases_json),
		created_at: String(row.created_at),
		updated_at: String(row.updated_at),
		transaction_count: Number(row.transaction_count),
		total_cents: Number(row.total_cents)
	}));
}

export async function listThirdPartyTransactions(
	thirdPartyId: string,
	includeTransfers = false
): Promise<TransactionView[]> {
	const result = await listTransactions({
		third_party_id: thirdPartyId,
		include_transfers: includeTransfers,
		limit: 1000
	});
	return result.transactions;
}

export async function listIssues(accountId?: string): Promise<IssueRow[]> {
	const db = await getDatabase();
	const rows = accountId
		? (db
				.prepare('SELECT * FROM issues WHERE account_id = ? ORDER BY id DESC LIMIT 100')
				.all(accountId) as Record<string, unknown>[])
		: (db.prepare('SELECT * FROM issues ORDER BY id DESC LIMIT 100').all() as Record<
				string,
				unknown
			>[]);
	return rows.map((row) => ({
		id: Number(row.id),
		account_id: stringOrNull(row.account_id),
		source_file: stringOrNull(row.source_file),
		message: String(row.message)
	}));
}
export async function listDocumentsWithLinks() {
	const [documents, db] = await Promise.all([listDocuments(), getDatabase()]);
	const rows = db
		.prepare(
			`SELECT t.account_id, t.id, t.label, a.name AS account_name, e.value AS document_path
 FROM transactions t
 JOIN accounts a ON a.id = t.account_id
 JOIN json_each(t.evidence_json) e
 ORDER BY t.date DESC, t.account_id, t.id`
		)
		.all() as Record<string, unknown>[];
	return documents.map((document) => ({
		...document,
		transactions: rows
			.filter((row) => row.document_path === document.path)
			.map((row) => ({
				account_id: String(row.account_id),
				id: String(row.id),
				label: String(row.label || row.id),
				account_name: String(row.account_name)
			}))
	}));
}

export async function listTransferPool(): Promise<TransactionView[]> {
	const db = await getDatabase();
	return (
		db
			.prepare(
				TRANSACTION_SELECT +
					' WHERE t.transfer_id IS NULL AND t.excluded = 0 ORDER BY t.date DESC, t.account_id, t.id'
			)
			.all() as Record<string, unknown>[]
	).map(transactionFromRow);
}

export async function listTransferGroups() {
	const db = await getDatabase();
	const rows = db
		.prepare(
			TRANSACTION_SELECT +
				" WHERE t.transfer_id IS NOT NULL AND t.transfer_id != '' ORDER BY t.date, t.account_id, t.id"
		)
		.all() as Record<string, unknown>[];
	const groups = new Map<string, TransactionView[]>();
	for (const row of rows) {
		const item = transactionFromRow(row);
		const members = groups.get(item.transfer_id!) ?? [];
		members.push(item);
		groups.set(item.transfer_id!, members);
	}
	return [...groups].map(([id, members]) => summarizeTransferGroup(id, members));
}
