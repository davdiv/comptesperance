import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { statusFingerprint } from './git';
import { getDatabase } from './cache';
import {
	createAccount,
	addManualCheckpoint,
	createManualTransaction,
	createProject,
	setTransactionAllocations,
	upsertAnnotation,
	deleteProject,
	deleteManualTransaction
} from './repository';
import {
	getAccountWithTotals,
	getProjectDetails,
	getTransaction,
	listProjectsWithTotals,
	listTransactions
} from './queries';
import { parseCsvStatement } from './csv';
import { mutateConfig } from './config';

vi.mock('./git', () => ({
	commitAll: vi.fn().mockResolvedValue(true),
	ensureGitRepo: vi.fn(),
	statusFingerprint: vi.fn()
}));
let root: string;
beforeEach(async () => {
	root = await mkdtemp(path.join(tmpdir(), 'comptesperance-cache-'));
	vi.stubEnv('DATA_REPO_PATH', root);
	vi.stubEnv('CACHE_DB_PATH', path.join(root, 'cache.sqlite'));
	vi.mocked(statusFingerprint).mockResolvedValue('initial');
});
afterEach(async () => {
	vi.unstubAllEnvs();
	await rm(root, { recursive: true, force: true });
});
it('merges parser exclusion defaults with annotation overrides, retaining EUR amounts', async () => {
	const account = await createAccount({ name: 'Sumup', source: 'csv' }, root);
	const content = await readFile(
		new URL('./csv/testdata/sumup-sample.csv', import.meta.url),
		'utf8'
	);
	await mkdir(path.join(root, 'accounts', account.id, 'statements'), { recursive: true });
	await writeFile(path.join(root, 'accounts', account.id, 'statements/sample.CSV'), content);
	const cancelled = parseCsvStatement(content, 'sumup').transactions.find(
		(t) => t.status === 'Annulé'
	)!;
	const before = await getAccountWithTotals(account.id);
	expect((await getTransaction(account.id, cancelled.id))?.excluded).toBe(true);
	expect(before?.checkpoints).toEqual([]);
	const project = await createProject({ name: 'Project' }, root);
	await upsertAnnotation(
		account.id,
		cancelled.id,
		{
			excluded: false,
			category_id: 'ventes',
			payment_mode_id: 'carte',
			allocations: [{ project_id: project.id, amount_cents: 500 }]
		},
		root
	);
	vi.mocked(statusFingerprint).mockResolvedValue('updated');
	expect(await getTransaction(account.id, cancelled.id)).toMatchObject({
		excluded: false,
		amount_cents: 1200,
		category_name: 'Ventes',
		payment_mode_name: 'Carte bancaire',
		allocations: [{ project_id: project.id, amount_cents: 500 }]
	});
	expect((await getAccountWithTotals(account.id))?.current_balance_cents).toBe(
		before!.current_balance_cents + 1200
	);
	expect((await getProjectDetails(project.id))?.total_cents).toBe(500);
	await expect(
		upsertAnnotation(
			account.id,
			cancelled.id,
			{ allocations: [{ project_id: project.id, amount_cents: 1201 }] },
			root
		)
	).rejects.toThrow('allocation_exceeded');
});
it('rebuilds transaction-owned allocations and config labels, filters references, and cleans project deletion', async () => {
	const account = await createAccount(
		{ name: 'Cash', source: 'manual', notes: 'Account notes' },
		root
	);
	const project = await createProject({ name: 'Project' }, root);
	const sale = await createManualTransaction(
		account.id,
		{
			date: '2026-10-03',
			amount_cents: 1000,
			label: 'Sale',
			category_id: 'ventes',
			payment_mode_id: 'especes'
		},
		root
	);
	await createManualTransaction(
		account.id,
		{ date: '2026-10-03', amount_cents: -200, label: 'Expense' },
		root
	);
	await createManualTransaction(
		account.id,
		{ date: '2026-10-03', amount_cents: 9000, label: 'Excluded', excluded: true },
		root
	);
	await setTransactionAllocations(
		{ account_id: account.id, transaction_id: sale.id },
		[{ project_id: project.id, amount_cents: 700 }],
		root
	);
	expect(await getAccountWithTotals(account.id)).toMatchObject({
		notes: 'Account notes',
		current_balance_cents: 800
	});
	expect(
		(
			await listTransactions({ category_id: 'ventes', payment_mode_id: 'especes' })
		).transactions.map((t) => t.id)
	).toEqual([sale.id]);
	expect((await listTransactions({ payment_mode_id: 'missing' })).total).toBe(0);
	expect((await getProjectDetails(project.id))?.total_cents).toBe(
		(await listProjectsWithTotals())[0].total_cents
	);
	await mutateConfig(
		'categories',
		{ id: 'ventes', name: 'Sales renamed', kind: 'income', archived: true },
		root
	);
	vi.mocked(statusFingerprint).mockResolvedValue('renamed');
	expect((await getTransaction(account.id, sale.id))?.category_name).toBe('Sales renamed');
	expect(
		JSON.parse(
			String(
				(await getDatabase()).prepare("SELECT value FROM meta WHERE key = 'config'").get()!.value
			)
		).categories.find((c: { id: string }) => c.id === 'ventes').archived
	).toBe(true);
	await deleteProject(project.id, root);
	vi.mocked(statusFingerprint).mockResolvedValue('deleted-project');
	expect((await getTransaction(account.id, sale.id))?.allocations).toEqual([]);
	expect(await listProjectsWithTotals()).toEqual([]);
	await deleteManualTransaction(account.id, sale.id, root);
	vi.mocked(statusFingerprint).mockResolvedValue('deleted-transaction');
	expect(await getTransaction(account.id, sale.id)).toBeNull();
});

it('derives every CCP header checkpoint, deduplicates transactions, and does not store statement checkpoints in JSON', async () => {
	const account = await createAccount({ name: 'CCP', source: 'csv' }, root);
	const content = await readFile(new URL('./csv/testdata/ccp-sample.csv', import.meta.url), 'utf8');
	const dir = path.join(root, 'accounts', account.id);
	await writeFile(path.join(dir, 'statements/a.csv'), content);
	await writeFile(path.join(dir, 'statements/b.csv'), content);
	await addManualCheckpoint(account.id, { date: '2026-10-02', balance_cents: 274800 }, root);
	const totals = await getAccountWithTotals(account.id);
	expect(totals).toMatchObject({
		current_balance_cents: 274853,
		transaction_count: 4,
		mismatch_count: 1,
		anchor: {
			date: '2026-10-02',
			balance_cents: 274853,
			source: 'statement',
			statement_file: 'a.csv'
		}
	});
	expect(totals?.checkpoints.filter((c) => c.source === 'statement')).toHaveLength(2);
	expect(totals?.checkpoints.find((c) => c.source === 'manual')?.difference_cents).toBe(-53);
	const stored = JSON.parse(await readFile(path.join(dir, 'account.json'), 'utf8'));
	expect(stored.checkpoints).toHaveLength(1);
	expect(stored.checkpoints[0]).not.toHaveProperty('source');
	expect(stored.checkpoints[0]).not.toHaveProperty('statement_file');
});
it('loads manual checkpoints for manual and CSV accounts even without transactions', async () => {
	for (const source of ['manual', 'csv'] as const) {
		const account = await createAccount(
			{ name: source, source, initial_checkpoint: { date: '2026-10-01', balance_cents: 20000 } },
			root
		);
		vi.mocked(statusFingerprint).mockResolvedValue(source);
		expect(await getAccountWithTotals(account.id)).toMatchObject({
			current_balance_cents: 20000,
			anchor: { source: 'manual', date: '2026-10-01' }
		});
	}
});

it('guesses active CSV payment modes, but annotations including explicit empty values win', async () => {
	const account = await createAccount({ name: 'Guess', source: 'csv' }, root);
	const content = await readFile(new URL('./csv/testdata/ccp-sample.csv', import.meta.url), 'utf8');
	await writeFile(path.join(root, 'accounts', account.id, 'statements/a.csv'), content);
	const transaction = parseCsvStatement(content, 'ccp').transactions[0];
	expect((await getTransaction(account.id, transaction.id))?.payment_mode_id).toBe('virement');
	await upsertAnnotation(account.id, transaction.id, { payment_mode_id: 'carte' }, root);
	vi.mocked(statusFingerprint).mockResolvedValue('override');
	expect((await getTransaction(account.id, transaction.id))?.payment_mode_id).toBe('carte');
	await upsertAnnotation(account.id, transaction.id, { payment_mode_id: '' }, root);
	vi.mocked(statusFingerprint).mockResolvedValue('empty-override');
	expect((await getTransaction(account.id, transaction.id))?.payment_mode_id).toBe('');
	await mutateConfig('paymentModes', { id: 'virement', name: 'Virement', archived: true }, root);
	vi.mocked(statusFingerprint).mockResolvedValue('archived');
	const unannotated = parseCsvStatement(content, 'ccp').transactions[1];
	expect((await getTransaction(account.id, unannotated.id))?.payment_mode_id).toBe('');
});
