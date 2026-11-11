import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { commitAll } from './git';
import {
	deleteManualTransaction,
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
						counterpart_account_id: 'bank',
						counterpart_transaction_id: 'other',
						transfer_id: 'transfer'
					},
					{ id: 'keep' }
				]
			})
		);
	}
	await writeFile(
		path.join(root, 'accounts', 'bank', 'annotations.json'),
		JSON.stringify({
			other: {
				transfer_id: 'transfer',
				counterpart_account_id: 'cash',
				counterpart_transaction_id: 'sale',
				notes: 'Keep notes'
			}
		})
	);
	await writeFile(
		path.join(root, 'projects', 'project.json'),
		JSON.stringify({
			id: 'project',
			allocations: [
				{ account_id: 'cash', transaction_id: 'sale', amount_cents: 100 },
				{ account_id: 'cash', transaction_id: 'keep', amount_cents: 200 }
			]
		})
	);
});
afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});

it('deletes the transaction, its allocations and counterpart link in one commit', async () => {
	await deleteManualTransaction('cash', 'sale', root);
	const account = JSON.parse(
		await readFile(path.join(root, 'accounts', 'cash', 'account.json'), 'utf8')
	);
	const project = JSON.parse(await readFile(path.join(root, 'projects', 'project.json'), 'utf8'));
	const annotations = JSON.parse(
		await readFile(path.join(root, 'accounts', 'bank', 'annotations.json'), 'utf8')
	);
	expect(account.transactions).toEqual([{ id: 'keep' }]);
	expect(project.allocations).toEqual([
		{ account_id: 'cash', transaction_id: 'keep', amount_cents: 200 }
	]);
	expect(annotations.other).toMatchObject({
		transfer_id: null,
		counterpart_account_id: null,
		counterpart_transaction_id: null,
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
