import type { ParsedTransaction } from '#lib/types.ts';

export interface ParsedStatement {
	transactions: ParsedTransaction[];
	errors: string[];
}
