import type { ParsedTransaction } from '$lib/types';
import { detectCcp, parseCcpReport, type CcpAccountMeta } from './ccp';
import { detectSumup, parseSumupReport } from './sumup';

export type CsvFormat = 'ccp' | 'sumup';

export interface ParsedCsvStatement {
	format: CsvFormat;
	transactions: ParsedTransaction[];
	errors: string[];
	account?: CcpAccountMeta | null;
}

export function detectCsvFormat(input: string): CsvFormat | null {
	if (detectSumup(input)) return 'sumup';
	if (detectCcp(input)) return 'ccp';
	return null;
}

export function parseCsvStatement(input: string, format: CsvFormat): ParsedCsvStatement {
	if (format === 'sumup') {
		const result = parseSumupReport(input);
		return { format, transactions: result.transactions, errors: result.errors };
	}
	const result = parseCcpReport(input);
	return {
		format,
		transactions: result.transactions,
		errors: result.errors,
		account: result.account
	};
}
