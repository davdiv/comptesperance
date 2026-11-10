import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDatabase } from './cache';
import { getProjectDetails } from './queries';

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
		const filtered = await getProjectDetails('project');
		expect(filtered?.allocations.map((a) => a.transaction?.id)).toEqual(['sale']);
		expect(filtered?.total_cents).toBe(1250);
		const included = await getProjectDetails('project', true);
		expect(included?.allocations).toHaveLength(2);
		expect(included?.total_cents).toBe(2500);
	});

	it('retains allocations with missing transactions as null', async () => {
		db.exec("INSERT INTO project_allocations VALUES ('project', 'cash', 'missing', 100, NULL)");
		const details = await getProjectDetails('project');
		expect(details?.allocations[0].transaction).toBeNull();
		expect(details?.total_cents).toBe(100);
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
