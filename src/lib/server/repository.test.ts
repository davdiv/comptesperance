import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { commitAll } from './git';
import { deleteManualTransaction } from './repository';

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
				account: { id, source: id === 'cash' ? 'manual' : 'csv' },
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
