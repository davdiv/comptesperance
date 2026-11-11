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
		CREATE TABLE projects (id TEXT, name TEXT, description TEXT, created_at TEXT, updated_at TEXT);
 CREATE TABLE categories (id TEXT, name TEXT);
 CREATE TABLE payment_modes (id TEXT, name TEXT);
		CREATE TABLE accounts (id TEXT, name TEXT);
		CREATE TABLE third_parties (id TEXT, name TEXT);
		CREATE TABLE project_allocations (project_id TEXT, account_id TEXT, transaction_id TEXT, amount_cents INTEGER, note TEXT);
		CREATE TABLE transactions (
			account_id TEXT, id TEXT, date TEXT, value_date TEXT, amount_cents INTEGER,
			label TEXT, description TEXT, record_type TEXT, status TEXT, third_party_id TEXT,
			transfer_id TEXT, counterpart_account_id TEXT, counterpart_transaction_id TEXT,
			notes TEXT, category_id TEXT, evidence_json TEXT, excluded INTEGER, payment_mode_id TEXT, allocations_json TEXT,
			source TEXT, source_files_json TEXT, raw_json TEXT, attributes_json TEXT
		);
		INSERT INTO projects VALUES ('project', 'Project', NULL, '', '');
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
		`INSERT INTO transactions (account_id, id, date, amount_cents, label, third_party_id, transfer_id)
		VALUES ('cash', ?, '2026-10-03', 2500, 'Vente gâteaux', 'party', ?)`
	).run(id, transferId);
}

it('searches category and payment mode display names rather than opaque ids', async () => {
	addAllocation('sale');
	db.exec(`
		INSERT INTO categories VALUES ('category-uuid', 'Fundraising');
		INSERT INTO payment_modes VALUES ('mode-uuid', 'Bank card');
		UPDATE transactions SET category_id = 'category-uuid', payment_mode_id = 'mode-uuid';
	`);
	for (const search of ['Fundraising', 'raising', 'Bank card', 'card']) {
		const result = await listTransactions({ search });
		expect(result.total).toBe(1);
		expect(result.transactions.map((transaction) => transaction.id)).toEqual(['sale']);
	}
	for (const search of ['category-uuid', 'mode-uuid', 'missing']) {
		expect(await listTransactions({ search })).toEqual({ transactions: [], total: 0 });
	}
	db.exec('DELETE FROM categories; DELETE FROM payment_modes;');
	expect((await listTransactions({ search: 'Fundraising' })).total).toBe(0);
	expect((await listTransactions({ search: 'Vente' })).total).toBe(1);
});

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

describe('transaction allocation names and filters', () => {
	function insert(
		id: string,
		amount: number,
		allocations: [string, number][],
		account = 'cash',
		transfer: string | null = null
	) {
		db.prepare(
			'INSERT INTO transactions (account_id, id, date, amount_cents, label, description, transfer_id, allocations_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
		).run(
			account,
			id,
			'2026-10-03',
			amount,
			id,
			'Description ' + id,
			transfer,
			JSON.stringify(
				allocations.map(([project_id, amount_cents]) => ({ project_id, amount_cents }))
			)
		);
		for (const [project, allocated] of allocations)
			db.prepare('INSERT INTO project_allocations VALUES (?, ?, ?, ?, NULL)').run(
				project,
				account,
				id,
				allocated
			);
	}
	beforeEach(() => {
		db.exec("INSERT INTO projects VALUES ('second', 'Second project', NULL, '', '')");
		insert('full', 1000, [['project', 1000]]);
		insert('partial', -1000, [
			['project', -200],
			['second', -200]
		]);
		insert('multi-full', 1000, [
			['project', 300],
			['second', 700]
		]);
		insert('none', -500, []);
		insert('zero', 0, []);
		insert('transfer', 1000, [['project', 1000]], 'cash', 'linked');
	});
	it('joins current project names without duplicating rows or polluting stored allocations', async () => {
		const result = await listTransactions({ allocation_status: 'partial' });
		expect(result.total).toBe(1);
		expect(result.transactions[0]).toMatchObject({
			id: 'partial',
			description: 'Description partial'
		});
		expect(result.transactions[0].allocation_details).toEqual(
			expect.arrayContaining([
				{ project_id: 'project', project_name: 'Project', amount_cents: -200, note: null },
				{ project_id: 'second', project_name: 'Second project', amount_cents: -200, note: null }
			])
		);
		expect(result.transactions[0].allocations[0]).not.toHaveProperty('project_name');
		db.exec("UPDATE projects SET name = 'Renamed' WHERE id = 'project'");
		expect(
			(
				await listTransactions({ allocation_status: 'partial' })
			).transactions[0].allocation_details.find((a) => a.project_id === 'project')?.project_name
		).toBe('Renamed');
		const paged = await listTransactions({ allocation_status: 'allocated', limit: 1 });
		expect(paged.transactions).toHaveLength(1);
		expect(paged.total).toBe(2);
	});
	it('distinguishes fully allocated, partially allocated and unallocated transactions', async () => {
		const ids = async (status: string) =>
			(await listTransactions({ allocation_status: status })).transactions.map((t) => t.id).sort();
		expect(await ids('allocated')).toEqual(['full', 'multi-full']);
		expect(await ids('unallocated')).toEqual(['none', 'zero']);
		expect(await ids('partial')).toEqual(['partial']);
		expect(await ids('')).toHaveLength(5);
		expect(await ids('invalid')).toHaveLength(5);
		expect(
			(await listTransactions({ allocation_status: 'allocated', include_transfers: true })).total
		).toBe(3);
	});
	it('combines project, allocation status and account filters using the whole transaction allocation total', async () => {
		expect((await listTransactions({ project_id: 'second' })).total).toBe(2);
		expect(
			(
				await listTransactions({ project_id: 'second', allocation_status: 'partial' })
			).transactions.map((t) => t.id)
		).toEqual(['partial']);
		expect(
			(await listTransactions({ project_id: 'project', allocation_status: 'unallocated' })).total
		).toBe(0);
		expect((await listTransactions({ project_id: 'missing' })).total).toBe(0);
		expect((await listTransactions({ project_id: "' OR 1=1 --" })).total).toBe(0);
		insert('full', 2000, [['second', 2000]], 'bank');
		const cash = await listTransactions({
			account_id: 'cash',
			search: 'full',
			project_id: 'second'
		});
		expect(cash.transactions.map((t) => t.id)).toEqual(['multi-full']);
		const bank = await listTransactions({ account_id: 'bank', project_id: 'second' });
		expect(bank.transactions[0].allocation_details).toHaveLength(1);
		expect(bank.transactions[0].allocation_details[0].amount_cents).toBe(2000);
	});
	it('retains unknown-project references and handles empty results', async () => {
		insert('missing-project', 100, [['removed', 100]]);
		expect(
			(await listTransactions({ project_id: 'removed' })).transactions[0].allocation_details[0]
		).toMatchObject({ project_id: 'removed', project_name: null });
		expect(await listTransactions({ project_id: 'removed', account_id: 'missing' })).toEqual({
			transactions: [],
			total: 0
		});
	});
});
