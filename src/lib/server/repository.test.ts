import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { commitAll } from './git';
import {
	deleteManualTransaction,
	createAccount,
	addManualCheckpoint,
	deleteManualCheckpoint,
	readStoredAccountById,
	deleteProject,
	setTransactionAllocations,
	updateManualTransaction,
	validateAllocations,
	createTransferGroup,
	createTransferGroups,
	addTransferMember,
	unlinkTransfer,
	createManualTransaction,
	uploadEvidence,
	linkDocument,
	deleteDocument,
	listDocuments,
	saveDocuments
} from './repository';

vi.mock('./git', () => ({ commitAll: vi.fn().mockResolvedValue(true) }));
let root: string;
beforeEach(async () => {
	vi.clearAllMocks();
	root = await mkdtemp(path.join(tmpdir(), 'comptesperance-delete-'));
	await mkdir(path.join(root, 'projects'));
	for (const id of ['cash', 'bank']) {
		await mkdir(path.join(root, 'accounts', id), { recursive: true });
		await writeFile(
			path.join(root, 'accounts', id, 'account.json'),
			JSON.stringify({
				account: { id, name: id, source: id === 'cash' ? 'manual' : 'csv' },
				transactions: [
					{
						id: 'sale',
						date: '2026-10-03',
						amount_cents: 1000,
						allocations: [{ project_id: 'project', amount_cents: 100 }],
						transfer_id: 'transfer'
					},
					{ id: 'keep', amount_cents: 500, allocations: [] }
				]
			})
		);
	}
	await writeFile(
		path.join(root, 'accounts', 'bank', 'annotations.json'),
		JSON.stringify({
			other: {
				transfer_id: 'transfer',
				notes: 'Keep notes'
			}
		})
	);
	await writeFile(
		path.join(root, 'projects', 'project.json'),
		JSON.stringify({
			id: 'project',
			name: 'Project',
			created_at: '',
			updated_at: ''
		})
	);
});
afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

it('deletes the transaction, its allocations and transfer membership in one commit', async () => {
	await deleteManualTransaction('cash', 'sale', root);
	const account = JSON.parse(
		await readFile(path.join(root, 'accounts', 'cash', 'account.json'), 'utf8')
	);
	const project = JSON.parse(await readFile(path.join(root, 'projects', 'project.json'), 'utf8'));
	const annotations = JSON.parse(
		await readFile(path.join(root, 'accounts', 'bank', 'annotations.json'), 'utf8')
	);
	expect(account.transactions).toEqual([{ id: 'keep', amount_cents: 500, allocations: [] }]);
	expect(project).not.toHaveProperty('allocations');
	expect(annotations.other).toMatchObject({
		transfer_id: null,
		notes: 'Keep notes'
	});
	expect(commitAll).toHaveBeenCalledExactlyOnceWith(
		root,
		'data: delete transaction sale from cash'
	);
});

it('rejects a missing transaction without committing', async () => {
	await expect(deleteManualTransaction('cash', 'missing', root)).rejects.toThrow(
		'Transaction not found'
	);
	expect(commitAll).not.toHaveBeenCalled();
});

it('deletes an unlinked transaction with no allocations', async () => {
	await deleteManualTransaction('cash', 'keep', root);
	expect(commitAll).toHaveBeenCalledTimes(1);
});
it('uploads several files, appends evidence and commits once', async () => {
	const ref = { account_id: 'cash', transaction_id: 'sale' };
	const paths = await uploadEvidence(
		ref,
		[
			{ name: 'first.pdf', data: new Uint8Array([1, 2]) },
			{ name: 'second.png', data: new Uint8Array([3, 4]) }
		],
		root
	);
	expect(paths).toHaveLength(2);
	const account = JSON.parse(await readFile(path.join(root, 'accounts/cash/account.json'), 'utf8'));
	expect(account.transactions[0].evidence).toEqual(paths);
	expect(await readFile(path.join(root, paths[0]))).toEqual(Buffer.from([1, 2]));
	expect(commitAll).toHaveBeenCalledTimes(1);
});

it('rejects empty, invalid and oversized batches without saving files', async () => {
	const ref = { account_id: 'cash', transaction_id: 'sale' };
	await expect(uploadEvidence(ref, [], root)).rejects.toThrow('Select at least one file');
	await expect(
		uploadEvidence(
			ref,
			[
				{ name: 'ok.pdf', data: new Uint8Array() },
				{ name: 'bad.exe', data: new Uint8Array() }
			],
			root
		)
	).rejects.toThrow('Unsupported file type');
	await expect(
		uploadEvidence(ref, [{ name: 'big.pdf', data: new Uint8Array(26 * 1024 * 1024) }], root)
	).rejects.toThrow('File is too large');
	expect(await listDocuments(root)).toEqual([]);
	expect(commitAll).not.toHaveBeenCalled();
});

it('links existing documents without duplicates and preserves other annotations', async () => {
	const [document] = await uploadEvidence(
		{ account_id: 'cash', transaction_id: 'sale' },
		[{ name: 'shared.pdf', data: new Uint8Array([1]) }],
		root
	);
	const ref = { account_id: 'bank', transaction_id: 'other' };
	await linkDocument(ref, document, root);
	await linkDocument(ref, document, root);
	const annotations = JSON.parse(
		await readFile(path.join(root, 'accounts/bank/annotations.json'), 'utf8')
	);
	expect(annotations.other.evidence).toEqual([document]);
	expect(annotations.other.notes).toBe('Keep notes');
	expect(await readFile(path.join(root, document))).toEqual(Buffer.from([1]));
	await expect(linkDocument(ref, 'documents/missing.pdf', root)).rejects.toThrow(
		'Document not found'
	);
});

it('deleting a shared document unlinks manual and CSV references in one commit', async () => {
	const [document] = await uploadEvidence(
		{ account_id: 'cash', transaction_id: 'sale' },
		[{ name: 'shared.pdf', data: new Uint8Array([1]) }],
		root
	);
	await linkDocument({ account_id: 'bank', transaction_id: 'other' }, document, root);
	vi.clearAllMocks();
	await deleteDocument(document, root);
	const account = JSON.parse(await readFile(path.join(root, 'accounts/cash/account.json'), 'utf8'));
	const annotations = JSON.parse(
		await readFile(path.join(root, 'accounts/bank/annotations.json'), 'utf8')
	);
	expect(account.transactions[0].evidence).toEqual([]);
	expect(annotations.other.evidence).toEqual([]);
	expect(annotations.other.notes).toBe('Keep notes');
	expect(await listDocuments(root)).toEqual([]);
	expect(commitAll).toHaveBeenCalledTimes(1);
});
it('saves library uploads together in one commit', async () => {
	const paths = await saveDocuments(
		[
			{ name: 'one.pdf', data: new Uint8Array([1]) },
			{ name: 'two.pdf', data: new Uint8Array([2]) }
		],
		root
	);
	expect(paths).toHaveLength(2);
	expect(await listDocuments(root)).toHaveLength(2);
	expect(commitAll).toHaveBeenCalledTimes(1);
	await expect(saveDocuments([], root)).rejects.toThrow('Select at least one file');
});

it('validates groups before writes, adds members, removes members and dissolves small groups in one commit each', async () => {
	const bank = await createAccount({ name: 'Group bank', source: 'manual' }, root);
	const third = await createAccount({ name: 'Third', source: 'manual' }, root);
	const incoming = await createManualTransaction(
		bank.id,
		{ date: '2026-10-03', label: 'Incoming', amount_cents: -300 },
		root
	);
	const extra = await createManualTransaction(
		third.id,
		{ date: '2026-10-03', label: 'Extra', amount_cents: -200 },
		root
	);
	const a = { account_id: 'cash', transaction_id: 'keep' },
		b = { account_id: bank.id, transaction_id: incoming.id },
		c = { account_id: third.id, transaction_id: extra.id };
	vi.clearAllMocks();
	await expect(createTransferGroup([a, a], root)).rejects.toThrow('transfer_invalid');
	await expect(
		createTransferGroups(
			[
				[a, b],
				[b, c]
			],
			root
		)
	).rejects.toThrow('transfer_invalid');
	await expect(createTransferGroup([a, { ...b, transaction_id: 'missing' }], root)).rejects.toThrow(
		'transfer_invalid'
	);
	expect(commitAll).not.toHaveBeenCalled();
	const id = await createTransferGroup([a, b], root);
	expect(commitAll).toHaveBeenCalledTimes(1);
	await expect(createTransferGroup([a, c], root)).rejects.toThrow('transfer_invalid');
	await addTransferMember(id, c, root);
	expect(commitAll).toHaveBeenCalledTimes(2);
	await unlinkTransfer(a, root);
	expect(commitAll).toHaveBeenCalledTimes(3);
	expect((await readStoredAccountById(bank.id, root))?.transactions?.[0].transfer_id).toBe(id);
	await deleteManualTransaction(bank.id, incoming.id, root);
	expect(commitAll).toHaveBeenCalledTimes(4);
	expect((await readStoredAccountById(third.id, root))?.transactions?.[0].transfer_id).toBeNull();
});
it('stores allocations on a manual transaction and leaves project metadata alone', async () => {
	await setTransactionAllocations(
		{ account_id: 'cash', transaction_id: 'sale' },
		[{ project_id: 'project', amount_cents: 400, note: 'Part' }],
		root
	);
	const file = JSON.parse(await readFile(path.join(root, 'accounts/cash/account.json'), 'utf8'));
	expect(file.transactions[0].allocations).toEqual([
		{ project_id: 'project', amount_cents: 400, note: 'Part' }
	]);
	const project = JSON.parse(await readFile(path.join(root, 'projects/project.json'), 'utf8'));
	expect(project).not.toHaveProperty('allocations');
	expect(commitAll).toHaveBeenCalledTimes(1);
});
it('rejects oversubscribed, opposite-sign, duplicate and fractional allocations without committing', async () => {
	for (const allocations of [
		[{ project_id: 'project', amount_cents: 1001 }],
		[{ project_id: 'project', amount_cents: -1 }],
		[{ project_id: 'project', amount_cents: 1.5 }],
		[
			{ project_id: 'project', amount_cents: 500 },
			{ project_id: 'project', amount_cents: 1 }
		]
	])
		await expect(
			setTransactionAllocations({ account_id: 'cash', transaction_id: 'sale' }, allocations, root)
		).rejects.toThrow();
	await expect(updateManualTransaction('cash', 'sale', { amount_cents: 50 }, root)).rejects.toThrow(
		'allocation_exceeded'
	);
	expect(commitAll).not.toHaveBeenCalled();
});
it('drops missing-project allocations before validating allocation changes on manual transactions', async () => {
	for (const active of [1000, 600, 0]) {
		await setTransactionAllocations(
			{ account_id: 'cash', transaction_id: 'sale' },
			[
				{ project_id: 'deleted', amount_cents: 1000 },
				{ project_id: 'also-deleted', amount_cents: 1000 },
				...(active ? [{ project_id: 'project', amount_cents: active, note: 'Keep note' }] : [])
			],
			root
		);
		const file = await readStoredAccountById('cash', root);
		expect(file?.transactions?.find((item) => item.id === 'sale')?.allocations).toEqual(
			active ? [{ project_id: 'project', amount_cents: active, note: 'Keep note' }] : []
		);
	}
	expect(commitAll).toHaveBeenCalledTimes(3);
});
it('deletes a project and removes manual and CSV allocations in one commit while keeping other fields', async () => {
	const annotationsPath = path.join(root, 'accounts/bank/annotations.json');
	const annotations = JSON.parse(await readFile(annotationsPath, 'utf8'));
	annotations.other.allocations = [
		{ project_id: 'project', amount_cents: 100 },
		{ project_id: 'another', amount_cents: 200 }
	];
	await writeFile(annotationsPath, JSON.stringify(annotations));
	await deleteProject('project', root);
	const account = JSON.parse(await readFile(path.join(root, 'accounts/cash/account.json'), 'utf8'));
	expect(account.transactions[0].allocations).toEqual([]);
	const updated = JSON.parse(await readFile(annotationsPath, 'utf8'));
	expect(updated.other.allocations).toEqual([{ project_id: 'another', amount_cents: 200 }]);
	expect(updated.other.notes).toBe('Keep notes');
	await expect(readFile(path.join(root, 'projects/project.json'))).rejects.toThrow();
	expect(commitAll).toHaveBeenCalledTimes(1);
});

it('validates the absolute total across projects, negative amounts and empty allocations', () => {
	expect(() =>
		validateAllocations(-1000, [
			{ project_id: 'first', amount_cents: -400 },
			{ project_id: 'second', amount_cents: -600 }
		])
	).not.toThrow();
	expect(() => validateAllocations(0, [])).not.toThrow();
	expect(() =>
		validateAllocations(1000, [
			{ project_id: 'first', amount_cents: 600 },
			{ project_id: 'second', amount_cents: 500 }
		])
	).toThrow('allocation_exceeded');
});

it.each(['cash', 'bank'])(
	'adds and deletes manual checkpoints on %s with one commit each and preserves account data',
	async (accountId) => {
		const before = await readStoredAccountById(accountId, root);
		const added = await addManualCheckpoint(
			accountId,
			{ date: '2026-10-02', balance_cents: 0, note: ' Count ' },
			root
		);
		expect(added).toMatchObject({ date: '2026-10-02', balance_cents: 0, note: 'Count' });
		expect(added.id).toBeTruthy();
		expect(commitAll).toHaveBeenCalledTimes(1);
		const file = await readStoredAccountById(accountId, root);
		expect(file?.checkpoints).toEqual([added]);
		expect(file?.transactions).toEqual(before?.transactions);
		expect(file?.annotations).toEqual(before?.annotations);
		await deleteManualCheckpoint(accountId, added.id, root);
		expect((await readStoredAccountById(accountId, root))?.checkpoints).toEqual([]);
		expect(commitAll).toHaveBeenCalledTimes(2);
	}
);
it('rejects invalid checkpoint dates, amounts and missing ids without committing', async () => {
	for (const [date, balance_cents] of [
		['2026-02-30', 100],
		['2026-1-01', 100],
		['', 100],
		['2026-10-02', 1.5]
	] as const) {
		await expect(addManualCheckpoint('cash', { date, balance_cents }, root)).rejects.toThrow(
			'checkpoint_invalid'
		);
	}
	await expect(deleteManualCheckpoint('cash', 'statement:file.csv', root)).rejects.toThrow(
		'Checkpoint not found'
	);
	expect(commitAll).not.toHaveBeenCalled();
});
it('creates an account and initial manual checkpoint in the same commit', async () => {
	const account = await createAccount(
		{
			name: 'New cash',
			source: 'manual',
			initial_checkpoint: { date: '2026-10-02', balance_cents: -100 }
		},
		root
	);
	expect((await readStoredAccountById(account.id, root))?.checkpoints?.[0]).toMatchObject({
		date: '2026-10-02',
		balance_cents: -100
	});
	expect(commitAll).toHaveBeenCalledTimes(1);
	await expect(
		createAccount(
			{ name: 'Invalid', source: 'csv', initial_checkpoint: { date: 'invalid', balance_cents: 0 } },
			root
		)
	).rejects.toThrow('checkpoint_invalid');
	expect(commitAll).toHaveBeenCalledTimes(1);
});
