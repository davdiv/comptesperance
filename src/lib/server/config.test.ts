import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { commitAll } from './git';
import { ensureConfig, mutateConfig, readConfig, saveAppName } from './config';

vi.mock('./git', () => ({ commitAll: vi.fn().mockResolvedValue(true) }));
let root: string;
beforeEach(async () => {
	root = await mkdtemp(path.join(tmpdir(), 'comptesperance-config-'));
	await ensureConfig(root);
	vi.clearAllMocks();
});
afterEach(async () => {
	await rm(root, { recursive: true, force: true });
});
it('initializes missing files once without overwriting existing configuration', async () => {
	expect((await readConfig(root)).app.name).toBe('Comptesperance');
	await saveAppName('Custom', root);
	vi.clearAllMocks();
	await ensureConfig(root);
	expect(commitAll).not.toHaveBeenCalled();
	await rm(path.join(root, 'config/payment-modes.json'));
	await ensureConfig(root);
	expect((await readConfig(root)).app.name).toBe('Custom');
	expect((await readConfig(root)).paymentModes.map((mode) => mode.id)).toEqual([
		'carte',
		'virement',
		'especes',
		'cheque',
		'prelevement'
	]);
	expect(commitAll).toHaveBeenCalledTimes(1);
});
it('trims app names and rejects empty names without committing', async () => {
	await expect(saveAppName('  ', root)).rejects.toThrow('config_invalid');
	expect(commitAll).not.toHaveBeenCalled();
	await saveAppName(' My accounts ', root);
	expect(JSON.parse(await readFile(path.join(root, 'config/app.json'), 'utf8'))).toEqual({
		name: 'My accounts'
	});
	expect(commitAll).toHaveBeenCalledTimes(1);
});
it('adds, renames, changes kind, archives, unarchives and removes an unused category', async () => {
	await mutateConfig('categories', { name: 'Extra', kind: 'income' }, root);
	let category = (await readConfig(root)).categories.find((entry) => entry.name === 'Extra')!;
	expect(category.kind).toBe('income');
	await mutateConfig(
		'categories',
		{ id: category.id, name: 'Renamed', kind: 'expense', archived: true },
		root
	);
	category = (await readConfig(root)).categories.find((entry) => entry.id === category.id)!;
	expect(category).toMatchObject({ name: 'Renamed', kind: 'expense', archived: true });
	await mutateConfig('categories', { ...category, archived: false }, root);
	expect(
		(await readConfig(root)).categories.find((entry) => entry.id === category.id)?.archived
	).toBe(false);
	await mutateConfig('categories', { id: category.id, remove: true }, root);
	expect((await readConfig(root)).categories.some((entry) => entry.id === category.id)).toBe(false);
	expect(commitAll).toHaveBeenCalledTimes(4);
});
it('adds, renames, archives and deletes unused payment modes', async () => {
	await mutateConfig('paymentModes', { name: 'Other' }, root);
	const mode = (await readConfig(root)).paymentModes.find((entry) => entry.name === 'Other')!;
	await mutateConfig('paymentModes', { ...mode, name: 'Updated', archived: true }, root);
	expect((await readConfig(root)).paymentModes.find((entry) => entry.id === mode.id)).toMatchObject(
		{ name: 'Updated', archived: true }
	);
	await mutateConfig('paymentModes', { id: mode.id, remove: true }, root);
	expect((await readConfig(root)).paymentModes.some((entry) => entry.id === mode.id)).toBe(false);
	expect(commitAll).toHaveBeenCalledTimes(3);
});
it.each(['manual', 'csv'])(
	'blocks deletion of entries used in %s transactions but allows archiving',
	async (source) => {
		const dir = path.join(root, 'accounts/test');
		await mkdir(dir, { recursive: true });
		const transaction = { id: 'tx', category_id: 'dons', payment_mode_id: 'carte' };
		await writeFile(
			path.join(dir, 'account.json'),
			JSON.stringify({ account: { id: 'test', source }, transactions: [transaction] })
		);
		await writeFile(path.join(dir, 'annotations.json'), JSON.stringify({ tx: transaction }));
		await expect(mutateConfig('categories', { id: 'dons', remove: true }, root)).rejects.toThrow(
			'config_in_use'
		);
		await expect(mutateConfig('paymentModes', { id: 'carte', remove: true }, root)).rejects.toThrow(
			'config_in_use'
		);
		expect(commitAll).not.toHaveBeenCalled();
		await mutateConfig(
			'categories',
			{ id: 'dons', name: 'Dons', kind: 'income', archived: true },
			root
		);
		expect(commitAll).toHaveBeenCalledTimes(1);
	}
);
it('rejects unknown ids, empty names and invalid kinds without writes', async () => {
	await expect(mutateConfig('categories', { name: '', kind: 'income' }, root)).rejects.toThrow(
		'config_invalid'
	);
	await expect(mutateConfig('categories', { name: 'New', kind: 'other' }, root)).rejects.toThrow(
		'config_invalid'
	);
	await expect(mutateConfig('categories', { id: 'missing', remove: true }, root)).rejects.toThrow(
		'config_invalid'
	);
	expect(commitAll).not.toHaveBeenCalled();
});

it('initializes defaults once for concurrent readers', async () => {
	await rm(path.join(root, 'config'), { recursive: true });
	const configs = await Promise.all([readConfig(root), readConfig(root), readConfig(root)]);
	expect(configs.map((config) => config.app.name)).toEqual([
		'Comptesperance',
		'Comptesperance',
		'Comptesperance'
	]);
	expect(commitAll).toHaveBeenCalledTimes(1);
});
