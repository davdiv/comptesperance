import type { PageOptions } from './pagination';

export const transferFields = ['search', 'account_id', 'date_from', 'date_to', 'balance'] as const;

export interface TransferFilters extends PageOptions {
	search?: string;
	account_id?: string;
	date_from?: string;
	date_to?: string;
	balance: string;
}
