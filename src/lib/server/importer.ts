import path from 'node:path';
import { detectCsvFormat, parseCsvStatement, type CsvFormat } from './csv';
import { commitAll } from './git';
import { ensureDataRepo, readStoredAccountById, slugify } from './repository';
import { mkdir } from 'node:fs/promises';
import { pathExists, writeTextFile } from './store';

export interface ImportResult {
	path: string;
	format: CsvFormat;
	transactions: number;
	errors: string[];
}

export async function importCsvFile(
	accountId: string,
	fileName: string,
	content: string,
	formatOverride?: CsvFormat,
	root?: string
): Promise<ImportResult> {
	const repo = root ?? (await ensureDataRepo());
	const accountFile = await readStoredAccountById(accountId, repo);
	if (!accountFile) throw new Error('Account not found');
	if (accountFile.account.source !== 'csv') throw new Error('Account does not accept CSV imports');

	const format = formatOverride ?? detectCsvFormat(content);
	if (!format) throw new Error('Unsupported CSV format');
	const parsed = parseCsvStatement(content, format);
	if (parsed.transactions.length === 0 && parsed.errors.length > 0) {
		throw new Error(parsed.errors.join(' '));
	}

	const statementsDir = path.join(accountFile.dir, 'statements');
	await mkdir(statementsDir, { recursive: true });
	const safeName = safeCsvFileName(fileName);
	let targetName = safeName;
	let suffix = 1;
	while (await pathExists(path.join(statementsDir, targetName))) {
		targetName = withSuffix(safeName, suffix);
		suffix += 1;
	}
	await writeTextFile(path.join(statementsDir, targetName), content);
	await commitAll(repo, `data: import ${format} csv into ${accountId}`);
	return {
		path: `accounts/${accountId}/statements/${targetName}`,
		format,
		transactions: parsed.transactions.length,
		errors: parsed.errors
	};
}

function safeCsvFileName(fileName: string): string {
	const base = path.basename(fileName || 'import.csv');
	const extension = path.extname(base).toLowerCase() === '.csv' ? '.csv' : '.csv';
	const stem = path.basename(base, path.extname(base));
	const slug = slugify(stem).slice(0, 60) || 'import';
	return `${slug}${extension}`;
}

function withSuffix(fileName: string, suffix: number): string {
	const extension = path.extname(fileName);
	const stem = path.basename(fileName, extension);
	return `${stem}-${suffix}${extension}`;
}
