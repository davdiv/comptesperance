import type { AccountType, ParsedTransaction } from '$lib/types';
import { detectCcp, parseCcpReport, type CcpAccountMeta } from './ccp';
import { detectSumup, parseSumupReport } from './sumup';

export type CsvFormat = 'ccp' | 'sumup';

export interface ParsedCsvStatement {
	format: CsvFormat;
	transactions: ParsedTransaction[];
	errors: string[];
	account?: CcpAccountMeta | null;
}

export function detectCsvFormat(input: string, accountType?: AccountType): CsvFormat | null {
	if (detectSumup(input)) return 'sumup';
	if (detectCcp(input)) return 'ccp';
	if (accountType === 'sumup') return 'sumup';
	if (accountType === 'bank' || accountType === 'stripe' || accountType === 'cash') return 'ccp';
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
