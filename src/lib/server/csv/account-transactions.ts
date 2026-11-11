import path from 'node:path';
import type { ParsedTransaction } from '#lib/types.ts';
import { detectCsvFormat, parseCsvStatement } from './index';
import { enrichSumupSales } from './sumup';
import { listFilesRecursive, readTextFile } from '../store';

export async function accountCsvTransactions(dir: string) {
	const transactions = new Map<
		string,
		{ transaction: ParsedTransaction; format: 'ccp' | 'sumup' }
	>();
	for (const name of await listFilesRecursive(path.join(dir, 'statements'))) {
		if (!name.toLowerCase().endsWith('.csv')) continue;
		const content = await readTextFile(path.join(dir, 'statements', name));
		const format = detectCsvFormat(content);
		if (!format) continue;
		for (const transaction of parseCsvStatement(content, format).transactions) {
			if (!transactions.has(transaction.id))
				transactions.set(transaction.id, { transaction, format });
		}
	}
	const result = [...transactions.values()];
	enrichSumupSales(result.map((item) => item.transaction));
	return result;
}
