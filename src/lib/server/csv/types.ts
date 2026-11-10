import type { ParsedTransaction } from '$lib/types';

export interface ParsedStatement {
	transactions: ParsedTransaction[];
	errors: string[];
}
