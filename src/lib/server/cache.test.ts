import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { commitAll, statusFingerprint } from './git';
import { importCsvFile } from './importer';
import { getDatabase } from './cache';
import {
	createAccount,
	addManualCheckpoint,
	createManualTransaction,
	createProject,
	setTransactionAllocations,
	upsertAnnotation,
	deleteProject,
	deleteManualTransaction,
	setStatementCheckpointIgnored,
	updateAccount
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
import { annotationFromTransaction, editedClassification } from './annotations';

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
it('reallocates a CSV transaction despite orphan allocations, preserving unrelated annotations', async () => {
	const account = await createAccount({ name: 'SumUp', source: 'csv' }, root);
	const project = await createProject({ name: 'Active project' }, root);
	const content = await readFile(
		new URL('./csv/testdata/sumup-sample.csv', import.meta.url),
		'utf8'
	);
	await writeFile(path.join(root, 'accounts', account.id, 'statements/sample.csv'), content);
	const sale = parseCsvStatement(content, 'sumup').transactions.find(
		(item) => item.record_type === 'vente' && !item.excluded
	)!;
	const orphan = { project_id: 'deleted', amount_cents: sale.amount_cents };
	await upsertAnnotation(
		account.id,
		sale.id,
		{ notes: 'Keep notes', payment_mode_id: '', allocations: [orphan] },
		root
	);
	for (const amount of [sale.amount_cents, 500, 0]) {
		const allocations = amount
			? [{ project_id: project.id, amount_cents: amount, note: 'Current' }]
			: [];
		await setTransactionAllocations(
			{ account_id: account.id, transaction_id: sale.id },
			[orphan, ...allocations],
			root
		);
		vi.mocked(statusFingerprint).mockResolvedValue('allocation-' + amount);
		const transaction = await getTransaction(account.id, sale.id);
		expect(transaction).toMatchObject({ allocations, notes: 'Keep notes', payment_mode_id: '' });
		const stored = JSON.parse(
			await readFile(path.join(root, 'accounts', account.id, 'annotations.json'), 'utf8')
		);
		expect(stored[sale.id].allocations ?? []).toEqual(allocations);
	}
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
}, 15_000);

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
it('persists ignore decisions across re-imports and account edits, and restores statements with one commit each', async () => {
	const account = await createAccount({ name: 'Ignored CCP', source: 'csv' }, root);
	const content = await readFile(new URL('./csv/testdata/ccp-sample.csv', import.meta.url), 'utf8');
	await importCsvFile(account.id, 'sample.csv', content, 'ccp', root);
	await addManualCheckpoint(account.id, { date: '2026-10-02', balance_cents: 274800 }, root);
	const before = await getAccountWithTotals(account.id);
	expect(before?.mismatch_count).toBe(1);
	const statement = before!.checkpoints.find((c) => c.source === 'statement')!;
	let commits = vi.mocked(commitAll).mock.calls.length;
	await setStatementCheckpointIgnored(account.id, statement.id, true, root);
	expect(commitAll).toHaveBeenCalledTimes(commits + 1);
	vi.mocked(statusFingerprint).mockResolvedValue('ignored');
	expect(await getAccountWithTotals(account.id)).toMatchObject({
		current_balance_cents: 274800,
		mismatch_count: 0,
		anchor: { source: 'manual' }
	});
	await updateAccount(account.id, { notes: 'Keep ignore decision' }, root);
	await importCsvFile(account.id, 'sample.csv', content, 'ccp', root);
	await importCsvFile(account.id, 'renamed.csv', content, 'ccp', root);
	vi.mocked(statusFingerprint).mockResolvedValue('re-imported');
	const reimported = await getAccountWithTotals(account.id);
	expect(reimported).toMatchObject({
		current_balance_cents: 274800,
		mismatch_count: 0,
		transaction_count: 4
	});
	expect(reimported!.checkpoints.filter((c) => c.source === 'statement')).toHaveLength(3);
	expect(
		reimported!.checkpoints
			.filter((c) => c.source === 'statement')
			.every((c) => c.ignored && !c.is_anchor)
	).toBe(true);
	const stored = JSON.parse(
		await readFile(path.join(root, 'accounts', account.id, 'account.json'), 'utf8')
	);
	expect(stored.ignored_statement_checkpoints).toHaveLength(1);
	expect(stored.checkpoints).toHaveLength(1);
	commits = vi.mocked(commitAll).mock.calls.length;
	await setStatementCheckpointIgnored(account.id, statement.id, false, root);
	expect(commitAll).toHaveBeenCalledTimes(commits + 1);
	vi.mocked(statusFingerprint).mockResolvedValue('restored');
	const restored = await getAccountWithTotals(account.id);
	expect(restored).toMatchObject({
		current_balance_cents: 274853,
		mismatch_count: 1,
		anchor: { source: 'statement' }
	});
	expect(restored!.checkpoints.every((c) => !c.ignored)).toBe(true);
});

it('rejects invalid statement checkpoint mutations without committing', async () => {
	const account = await createAccount({ name: 'CCP validation', source: 'csv' }, root);
	const sumup = await readFile(new URL('./csv/testdata/sumup-sample.csv', import.meta.url), 'utf8');
	await importCsvFile(account.id, 'sumup.csv', sumup, 'sumup', root);
	const commits = vi.mocked(commitAll).mock.calls.length;
	for (const id of [
		'',
		'manual',
		'statement:missing.csv',
		'statement:../../../config/app.json',
		'statement:sumup.csv'
	]) {
		await expect(setStatementCheckpointIgnored(account.id, id, true, root)).rejects.toThrow();
	}
	await expect(
		setStatementCheckpointIgnored('missing-account', 'statement:file.csv', true, root)
	).rejects.toThrow();
	expect(commitAll).toHaveBeenCalledTimes(commits);
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
	for (const annotation of [{ evidence: [] }, { notes: 'Updated', payment_mode_id: undefined }]) {
		await upsertAnnotation(account.id, transaction.id, annotation, root);
		vi.mocked(statusFingerprint).mockResolvedValue(JSON.stringify(annotation));
		expect((await getTransaction(account.id, transaction.id))?.payment_mode_id).toBe('');
		const stored = JSON.parse(
			await readFile(path.join(root, 'accounts', account.id, 'annotations.json'), 'utf8')
		);
		expect(stored[transaction.id].payment_mode_id).toBe('');
	}
	await mutateConfig('paymentModes', { id: 'virement', name: 'Virement', archived: true }, root);
	vi.mocked(statusFingerprint).mockResolvedValue('archived');
	const unannotated = parseCsvStatement(content, 'ccp').transactions[1];
	expect((await getTransaction(account.id, unannotated.id))?.payment_mode_id).toBe('');
});

it('deduplicates SumUp sales and derived fees across statement sets and supports fee annotations', async () => {
	const account = await createAccount({ name: 'SumUp gross', source: 'csv' }, root);
	const content = await readFile(
		new URL('./csv/testdata/sumup-sample.csv', import.meta.url),
		'utf8'
	);
	const [header, ...rows] = content.trim().split('\n');
	const statements = path.join(root, 'accounts', account.id, 'statements');
	await writeFile(
		path.join(statements, 'sales.csv'),
		[header, ...rows.filter((row) => row.includes(',Vente,'))].join('\n')
	);
	await writeFile(
		path.join(statements, 'payouts.csv'),
		[header, ...rows.filter((row) => row.includes(',Virement,'))].join('\n')
	);
	await writeFile(path.join(statements, 'duplicate.csv'), content);
	const result = await listTransactions({ account_id: account.id });
	expect(result.total).toBe(4);
	expect((await getAccountWithTotals(account.id))?.current_balance_cents).toBe(0);
	const fee = result.transactions.find((item) => item.record_type === 'fee')!;
	expect(fee).toMatchObject({ amount_cents: -44, category_id: 'frais-bancaires' });
	const sale = result.transactions.find((item) => item.record_type === 'vente' && !item.excluded)!;
	expect(sale.description).toContain('PID9000007');
	expect(sale.attributes?.payout_transaction_id).toBeDefined();
	await upsertAnnotation(
		account.id,
		fee.id,
		{ excluded: true, category_id: 'achats', notes: 'Fee override' },
		root
	);
	vi.mocked(statusFingerprint).mockResolvedValue('fee-override');
	expect(await getTransaction(account.id, fee.id)).toMatchObject({
		excluded: true,
		category_id: 'achats',
		notes: 'Fee override'
	});
	expect((await getAccountWithTotals(account.id))?.current_balance_cents).toBe(44);
});

it('keeps CSV classification defaults dynamic across unrelated annotation saves and preserves explicit clears', async () => {
	const account = await createAccount({ name: 'Dynamic defaults', source: 'csv' }, root);
	const content = await readFile(
		new URL('./csv/testdata/sumup-sample.csv', import.meta.url),
		'utf8'
	);
	await writeFile(path.join(root, 'accounts', account.id, 'statements/sample.csv'), content);
	const { transactions } = await listTransactions({ account_id: account.id });
	const sale = transactions.find((item) => item.record_type === 'vente' && !item.excluded)!;
	const fee = transactions.find((item) => item.record_type === 'fee')!;
	expect(sale).toMatchObject({ payment_mode_id: 'carte', payment_mode_is_guessed: true });
	expect(fee).toMatchObject({ category_id: 'frais-bancaires', category_is_guessed: true });
	for (const transaction of [sale, fee]) {
		const form = new FormData();
		form.set('category_id', transaction.category_id);
		form.set('payment_mode_id', transaction.payment_mode_id);
		await upsertAnnotation(
			account.id,
			transaction.id,
			annotationFromTransaction(transaction, {
				...editedClassification(transaction, form),
				notes: 'Updated note',
				evidence: []
			}),
			root
		);
	}
	const stored = JSON.parse(
		await readFile(path.join(root, 'accounts', account.id, 'annotations.json'), 'utf8')
	);
	for (const annotation of Object.values(stored)) {
		expect(annotation).not.toHaveProperty('payment_mode_id');
		expect(annotation).not.toHaveProperty('category_id');
	}
	await mutateConfig('paymentModes', { id: 'carte', name: 'Carte bancaire', archived: true }, root);
	await mutateConfig(
		'categories',
		{ id: 'frais-bancaires', name: 'Frais bancaires', kind: 'expense', archived: true },
		root
	);
	vi.mocked(statusFingerprint).mockResolvedValue('archived-defaults');
	expect((await getTransaction(account.id, sale.id))?.payment_mode_id).toBe('');
	expect((await getTransaction(account.id, fee.id))?.category_id).toBe('');
	await upsertAnnotation(account.id, fee.id, { category_id: '', payment_mode_id: '' }, root);
	await mutateConfig(
		'categories',
		{ id: 'frais-bancaires', name: 'Frais bancaires', kind: 'expense' },
		root
	);
	vi.mocked(statusFingerprint).mockResolvedValue('explicit-empty-category');
	expect(await getTransaction(account.id, fee.id)).toMatchObject({
		category_id: '',
		category_is_guessed: false,
		payment_mode_id: '',
		payment_mode_is_guessed: false
	});
});
