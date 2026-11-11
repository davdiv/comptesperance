import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDatabase } from './cache';
import { listDocuments } from './repository';
import {
	getProjectDetails,
	getUnallocatedDetails,
	getTransaction,
	listAccountsWithTotals,
	listThirdPartiesWithCounts,
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
			label TEXT, description TEXT, record_type TEXT, status TEXT, third_party_id TEXT, transfer_id TEXT,
			notes TEXT, category_id TEXT, evidence_json TEXT, excluded INTEGER, payment_mode_id TEXT, allocations_json TEXT,
			source TEXT, source_files_json TEXT, raw_json TEXT, attributes_json TEXT,
			category_is_guessed INTEGER NOT NULL DEFAULT 0, payment_mode_is_guessed INTEGER NOT NULL DEFAULT 0
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
		expect(await listTransactions({ search })).toEqual({
			transactions: [],
			total: 0,
			total_cents: 0,
			incoming_cents: 0,
			outgoing_cents: 0,
			hidden_transfer_count: 0
		});
	}
	db.exec('DELETE FROM categories; DELETE FROM payment_modes;');
	expect((await listTransactions({ search: 'Fundraising' })).total).toBe(0);
	expect((await listTransactions({ search: 'Vente' })).total).toBe(1);
});

describe('getProjectDetails', () => {
	it('omits net-zero accounts while retaining their allocations in overall totals and counts', async () => {
		addAllocation('in', 'group');
		addAllocation('out', 'group');
		db.exec("UPDATE project_allocations SET amount_cents = -1250 WHERE transaction_id = 'out'");
		for (const includeTransfers of [false, true]) {
			const details = await getProjectDetails('project', includeTransfers);
			expect(details?.total_cents).toBe(0);
			expect(details?.by_account).toEqual([]);
			expect(details?.allocations).toHaveLength(includeTransfers ? 2 : 0);
		}
		expect((await listProjectsWithTotals())[0]).toMatchObject({
			total_cents: 0,
			allocation_count: 2
		});
	});
	it.each([
		[1, 1],
		[1, 0],
		[0, 1],
		[0, 0]
	])(
		'preserves category/payment provenance (%i, %i) consistently with direct transaction queries',
		async (categoryGuessed, modeGuessed) => {
			addAllocation('sale');
			db.prepare(
				"UPDATE transactions SET source = 'csv', category_id = 'frais-bancaires', payment_mode_id = 'carte', category_is_guessed = ?, payment_mode_is_guessed = ?"
			).run(categoryGuessed, modeGuessed);
			const transaction = (await getProjectDetails('project'))!.allocations[0].transaction;
			expect(transaction).toMatchObject({
				category_id: 'frais-bancaires',
				payment_mode_id: 'carte',
				category_is_guessed: Boolean(categoryGuessed),
				payment_mode_is_guessed: Boolean(modeGuessed)
			});
			const direct = await getTransaction('cash', 'sale');
			for (const field of [
				'category_id',
				'payment_mode_id',
				'category_is_guessed',
				'payment_mode_is_guessed'
			] as const) {
				expect(transaction?.[field]).toEqual(direct?.[field]);
			}
		}
	);
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

	it('filters transfer rows without changing project totals, counts or account summaries', async () => {
		addAllocation('sale');
		addAllocation('transfer', 'transfer-id');
		db.exec("INSERT INTO project_allocations VALUES ('project', 'cash', 'orphan', 999, NULL)");
		const filtered = await getProjectDetails('project');
		expect(filtered?.allocations.map((a) => a.transaction?.id)).toEqual(['sale']);
		expect(filtered?.total_cents).toBe(2500);
		const [listed] = await listProjectsWithTotals();
		expect(listed.total_cents).toBe(filtered?.total_cents);
		expect(listed.allocation_count).toBe(2);
		const included = await getProjectDetails('project', true);
		expect(included?.allocations).toHaveLength(2);
		expect(included?.total_cents).toBe(filtered?.total_cents);
		expect(included?.by_account).toEqual(filtered?.by_account);
		expect(filtered?.by_account[0]).toMatchObject({ amount_cents: 2500, count: 2 });
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

describe('unallocated pseudo-project', () => {
	it('applies shared filters before project and unallocated summaries, independently of visible pages', async () => {
		db.exec(
			"ALTER TABLE accounts ADD COLUMN notes TEXT; ALTER TABLE accounts ADD COLUMN source TEXT DEFAULT 'manual'; CREATE TABLE balance_checkpoints (account_id TEXT);"
		);
		for (const [id, amount, allocated, category, transfer, excluded] of [
			['in', 1000, 300, 'c', 'group', 0],
			['out', -500, -200, 'c', null, 0],
			['other', 5000, 1000, 'other', null, 0],
			['excluded', 999, 100, 'other', null, 1]
		] as const) {
			db.prepare(
				'INSERT INTO transactions (account_id,id,date,amount_cents,label,category_id,transfer_id,excluded,payment_mode_id,third_party_id) VALUES (?,?,?,?,?,?,?,?,?,?)'
			).run('cash', id, '2026-10-03', amount, id, category, transfer, excluded, 'card', 'party');
			db.prepare('INSERT INTO project_allocations VALUES (?,?,?,?,NULL)').run(
				'project',
				'cash',
				id,
				allocated
			);
		}
		for (const included of [false, true]) {
			const filters = {
				category_id: 'c',
				include_transfers: included,
				limit: 1,
				payment_mode_id: 'card',
				third_party_id: 'party',
				date_to: '2026-10-03'
			};
			const project = await getProjectDetails('project', filters);
			expect((await listProjectsWithTotals(filters))[0]).toMatchObject({
				total_cents: 100,
				allocation_count: 2
			});
			expect((await listAccountsWithTotals(filters))[0]).toMatchObject({
				incoming_cents: 1000,
				outgoing_cents: -500,
				transaction_count: 2,
				current_balance_cents: 5500
			});
			expect(project).toMatchObject({
				total_cents: 100,
				transaction_count: 2,
				by_account: [{ amount_cents: 100, count: 2 }]
			});
			expect(project?.allocations).toHaveLength(1);
			const unallocated = await getUnallocatedDetails(filters);
			expect(unallocated).toMatchObject({
				total_cents: 400,
				incoming_cents: 700,
				outgoing_cents: -300,
				transaction_count: 2,
				by_account: [{ amount_cents: 400 }]
			});
			expect(unallocated.transactions).toHaveLength(1);
			const list = await listTransactions(filters);
			expect(list).toMatchObject({
				total: 2,
				total_cents: 500,
				incoming_cents: 1000,
				outgoing_cents: -500
			});
		}
		expect((await getProjectDetails('project'))?.total_cents).toBe(1200);
		expect((await getUnallocatedDetails()).total_cents).toBe(4400);
		expect((await listTransactions()).total_cents).toBe(5500);
		expect((await getProjectDetails('project', { search: 'no match' }))?.total_cents).toBe(0);
		expect((await getUnallocatedDetails({ search: 'no match' })).transactions).toEqual([]);
		expect(await listTransactions({ excluded: '1' })).toMatchObject({ total: 1, total_cents: 0 });
		expect(await listTransactions({ excluded: '0' })).toMatchObject({
			total: 3,
			total_cents: 5500
		});
	});
	it('ignores missing projects in row selection, remainders and totals', async () => {
		for (const [id, amount, allocated, orphan, transfer] of [
			['orphan-only', 2500, 0, 2500, null],
			['mixed', 10000, 3000, 7000, 'group'],
			['expense', -5000, -2000, -3000, null],
			['full', 1500, 1500, 0, null]
		] as const) {
			db.prepare(
				'INSERT INTO transactions (account_id,id,date,amount_cents,label,excluded,transfer_id) VALUES (?,?,?,?,?,0,?)'
			).run('cash', id, '2026-10-03', amount, id, transfer);
			for (const [project, value] of [
				['project', allocated],
				['missing', orphan]
			] as const)
				if (value)
					db.prepare('INSERT INTO project_allocations VALUES (?,?,?,?,NULL)').run(
						project,
						'cash',
						id,
						value
					);
		}
		const overall = (await listTransactions({ include_transfers: true })).total_cents;
		const projects = await listProjectsWithTotals();
		expect(projects[0].total_cents).toBe(2500);
		for (const included of [false, true]) {
			const result = await getUnallocatedDetails(included);
			expect(result).toMatchObject({
				incoming_cents: 9500,
				outgoing_cents: -3000,
				total_cents: 6500,
				transaction_count: 3,
				by_account: [{ account_id: 'cash', amount_cents: 6500, count: 3 }]
			});
			expect(
				Object.fromEntries(result.transactions.map((item) => [item.id, item.unallocated_cents]))
			).toEqual(
				included
					? { 'orphan-only': 2500, mixed: 7000, expense: -3000 }
					: { 'orphan-only': 2500, expense: -3000 }
			);
			expect(
				result.total_cents + projects.reduce((sum, project) => sum + project.total_cents, 0)
			).toBe(overall);
		}
		db.exec('DELETE FROM projects');
		const afterDeletion = await getUnallocatedDetails(true);
		expect(afterDeletion.transaction_count).toBe(4);
		expect(afterDeletion.total_cents).toBe(overall);
	});
	it('uses full or partial remainders, excludes excluded and fully allocated rows, and keeps totals stable when transfers are hidden', async () => {
		db.exec("INSERT INTO accounts VALUES ('bank','Bank')");
		for (const [account, id, amount, allocated, transfer, excluded] of [
			['cash', 'partial', 10000, 3000, null, 0],
			['cash', 'expense', -5000, -2000, null, 0],
			['bank', 'in', 9000, 0, 'group', 0],
			['bank', 'out', -9000, 0, 'group', 0],
			['cash', 'full', 2000, 2000, null, 0],
			['cash', 'excluded', 9999, 0, null, 1],
			['cash', 'zero', 0, 0, null, 0]
		] as const) {
			db.prepare(
				'INSERT INTO transactions (account_id,id,date,amount_cents,label,excluded,transfer_id) VALUES (?,?,?,?,?,?,?)'
			).run(account, id, '2026-10-03', amount, id, excluded, transfer);
			if (allocated)
				db.prepare('INSERT INTO project_allocations VALUES (?,?,?,?,NULL)').run(
					'project',
					account,
					id,
					allocated
				);
		}
		for (const included of [false, true]) {
			const result = await getUnallocatedDetails(included);
			expect(result).toMatchObject({
				incoming_cents: 16000,
				outgoing_cents: -12000,
				total_cents: 4000,
				transaction_count: 4,
				by_account: [{ account_id: 'cash', account_name: 'Cash', amount_cents: 4000, count: 2 }]
			});
			expect(result.transactions).toHaveLength(included ? 4 : 2);
			expect(result.transactions.find((item) => item.id === 'partial')?.unallocated_cents).toBe(
				7000
			);
			expect(result.transactions.find((item) => item.id === 'expense')?.unallocated_cents).toBe(
				-3000
			);
			if (included)
				expect(result.transactions.find((item) => item.id === 'in')).toMatchObject({
					account_name: 'Bank',
					unallocated_cents: 9000
				});
		}
	});
	it('returns empty rows and zero summaries without matching transactions', async () => {
		for (const included of [false, true])
			expect(await getUnallocatedDetails(included)).toEqual({
				incoming_cents: 0,
				outgoing_cents: 0,
				total_cents: 0,
				transaction_count: 0,
				hidden_transfer_count: 0,
				by_account: [],
				transactions: []
			});
	});
});

it('keeps transaction counts and amounts independent of transfer visibility and pagination, respecting other filters and exclusions', async () => {
	for (const [id, amount, transfer, excluded] of [
		['sale', 2500, null, 0],
		['transfer', -1250, 'group', 0],
		['excluded', 900, 'group', 1]
	] as const) {
		addAllocation(id, transfer);
		db.prepare(
			"UPDATE transactions SET amount_cents = ?, excluded = ?, date = '2026-10-03' WHERE id = ?"
		).run(amount, excluded, id);
	}
	for (const include_transfers of [false, true]) {
		const result = await listTransactions({
			account_id: 'cash',
			search: 'Vente',
			date_from: '2026-10-03',
			date_to: '2026-10-03',
			project_id: 'project',
			include_transfers
		});
		expect(result).toMatchObject({
			total: 3,
			total_cents: 1250,
			incoming_cents: 2500,
			outgoing_cents: -1250,
			hidden_transfer_count: include_transfers ? 0 : 2
		});
		expect(result.transactions).toHaveLength(include_transfers ? 3 : 1);
		expect(
			await listTransactions({ account_id: 'cash', include_transfers, limit: 1, offset: 3 })
		).toEqual({
			transactions: [],
			total: 3,
			total_cents: 1250,
			incoming_cents: 2500,
			outgoing_cents: -1250,
			hidden_transfer_count: include_transfers ? 0 : 2
		});
		expect(await listTransactions({ account_id: 'missing', include_transfers })).toEqual({
			transactions: [],
			total: 0,
			total_cents: 0,
			incoming_cents: 0,
			outgoing_cents: 0,
			hidden_transfer_count: 0
		});
	}
});

it('includes transfer members in account and third-party summaries', async () => {
	db.exec(`
  ALTER TABLE accounts ADD COLUMN notes TEXT;
  ALTER TABLE accounts ADD COLUMN source TEXT DEFAULT 'manual';
  CREATE TABLE balance_checkpoints (account_id TEXT);
  ALTER TABLE third_parties ADD COLUMN aliases_json TEXT DEFAULT '[]';
  ALTER TABLE third_parties ADD COLUMN created_at TEXT DEFAULT '';
  ALTER TABLE third_parties ADD COLUMN updated_at TEXT DEFAULT '';
 `);
	for (const [id, amount, transfer] of [
		['sale', 2500, null],
		['transfer', -1250, 'group']
	] as const) {
		addAllocation(id, transfer);
		db.prepare('UPDATE transactions SET amount_cents = ?, excluded = 0 WHERE id = ?').run(
			amount,
			id
		);
	}
	expect((await listAccountsWithTotals())[0]).toMatchObject({
		incoming_cents: 2500,
		outgoing_cents: -1250,
		current_balance_cents: 1250,
		transaction_count: 2
	});
	expect((await listThirdPartiesWithCounts())[0]).toMatchObject({
		total_cents: -1250,
		transaction_count: 2
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
		expect(paged.total).toBe(3);
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
			total: 0,
			total_cents: 0,
			incoming_cents: 0,
			outgoing_cents: 0,
			hidden_transfer_count: 0
		});
	});
});
