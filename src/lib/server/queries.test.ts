import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDatabase } from './cache';
import { listDocuments } from './repository';
import {
	getProjectDetails,
	listProjectsWithTotals,
	listTransactions,
	listDocumentsWithLinks
} from './queries';

vi.mock('./repository', () => ({ listDocuments: vi.fn() }));
vi.mock('./cache', () => ({ getDatabase: vi.fn() }));

let db: DatabaseSync;

beforeEach(() => {
	db = new DatabaseSync(':memory:');
	vi.mocked(getDatabase).mockResolvedValue(db);
	db.exec(`
		CREATE TABLE projects (id TEXT, name TEXT, description TEXT, allocations_json TEXT, created_at TEXT, updated_at TEXT);
		CREATE TABLE accounts (id TEXT, name TEXT);
		CREATE TABLE third_parties (id TEXT, name TEXT);
		CREATE TABLE project_allocations (project_id TEXT, account_id TEXT, transaction_id TEXT, amount_cents INTEGER, note TEXT);
		CREATE TABLE transactions (
			account_id TEXT, id TEXT, date TEXT, value_date TEXT, amount_cents INTEGER, currency TEXT,
			label TEXT, description TEXT, record_type TEXT, status TEXT, third_party_id TEXT,
			transfer_id TEXT, counterpart_account_id TEXT, counterpart_transaction_id TEXT,
			notes TEXT, category TEXT, evidence_json TEXT, excluded INTEGER, counts_in_total INTEGER,
			source TEXT, source_files_json TEXT, raw_json TEXT, attributes_json TEXT
		);
		INSERT INTO projects VALUES ('project', 'Project', NULL, '[]', '', '');
		INSERT INTO accounts VALUES ('cash', 'Cash');
		INSERT INTO third_parties VALUES ('party', 'Party');
	`);
});

afterEach(() => db.close());

function addAllocation(id: string, transferId: string | null = null) {
	db.prepare('INSERT INTO project_allocations VALUES (?, ?, ?, ?, NULL)').run(
		'project',
		'cash',
		id,
		1250
	);
	db.prepare(
		`INSERT INTO transactions (account_id, id, date, amount_cents, currency, label, third_party_id, transfer_id)
		VALUES ('cash', ?, '2026-10-03', 2500, 'EUR', 'Vente gâteaux', 'party', ?)`
	).run(id, transferId);
}

describe('getProjectDetails', () => {
	it('joins transactions and third parties without replacing the allocated amount', async () => {
		addAllocation('sale');
		const details = await getProjectDetails('project');
		expect(details?.allocations[0]).toMatchObject({
			amount_cents: 1250,
			transaction: {
				id: 'sale',
				account_id: 'cash',
				date: '2026-10-03',
				label: 'Vente gâteaux',
				amount_cents: 2500,
				third_party_name: 'Party'
			}
		});
	});

	it('filters transfers from allocations and totals unless explicitly included', async () => {
		addAllocation('sale');
		addAllocation('transfer', 'transfer-id');
		db.exec("INSERT INTO project_allocations VALUES ('project', 'cash', 'orphan', 999, NULL)");
		const filtered = await getProjectDetails('project');
		expect(filtered?.allocations.map((a) => a.transaction?.id)).toEqual(['sale']);
		expect(filtered?.total_cents).toBe(1250);
		const [listed] = await listProjectsWithTotals();
		expect(listed.total_cents).toBe(filtered?.total_cents);
		expect(listed.allocation_count).toBe(filtered?.allocations.length);
		const included = await getProjectDetails('project', true);
		expect(included?.allocations).toHaveLength(2);
		expect(included?.total_cents).toBe(2500);
	});

	it('ignores allocations with missing transactions', async () => {
		db.exec("INSERT INTO project_allocations VALUES ('project', 'cash', 'missing', 100, NULL)");
		const details = await getProjectDetails('project');
		expect(details?.allocations).toEqual([]);
		expect(details?.total_cents).toBe(0);
		expect((await listProjectsWithTotals())[0]).toMatchObject({
			total_cents: 0,
			allocation_count: 0
		});
	});

	it('returns empty allocations and zero totals for an empty project', async () => {
		expect(await getProjectDetails('project')).toMatchObject({
			allocations: [],
			by_account: [],
			total_cents: 0
		});
	});

	it('returns null for a missing project', async () => {
		expect(await getProjectDetails('missing')).toBeNull();
	});
});
describe('transaction date filters', () => {
	it('includes the entire end date for plain dates and ISO datetimes', async () => {
		for (const [id, date] of [
			['plain', '2026-10-03'],
			['late', '2026-10-03T23:59:59.999Z'],
			['next', '2026-10-04T00:00:00Z']
		]) {
			db.prepare('INSERT INTO transactions (account_id, id, date) VALUES (?, ?, ?)').run(
				'cash',
				id,
				date
			);
		}
		const result = await listTransactions({ date_from: '2026-10-03', date_to: '2026-10-03' });
		expect(result.transactions.map((t) => t.id).sort()).toEqual(['late', 'plain']);
		expect(result.total).toBe(2);
	});
	it('returns no results for an empty date range', async () => {
		expect((await listTransactions({ date_to: '2026-10-03' })).total).toBe(0);
	});
});
it('lists linked transactions for each document including shared files', async () => {
	vi.mocked(listDocuments).mockResolvedValue([
		{ path: 'documents/shared.pdf', name: 'shared.pdf', size: 1, modified_at: '' },
		{ path: 'documents/unused.pdf', name: 'unused.pdf', size: 1, modified_at: '' }
	]);
	for (const id of ['first', 'second']) {
		db.prepare(
			'INSERT INTO transactions (account_id, id, label, evidence_json) VALUES (?, ?, ?, ?)'
		).run('cash', id, id, '["documents/shared.pdf"]');
	}
	const documents = await listDocumentsWithLinks();
	expect(documents[0].transactions.map((t) => t.id)).toEqual(['first', 'second']);
	expect(documents[1].transactions).toEqual([]);
	vi.mocked(listDocuments).mockResolvedValue([]);
	expect(await listDocumentsWithLinks()).toEqual([]);
});
