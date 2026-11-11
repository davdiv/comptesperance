export const filterFields = [
	'search',
	'account_id',
	'third_party_id',
	'date_from',
	'date_to',
	'category_id',
	'payment_mode_id',
	'project_id',
	'allocation_status',
	'record_type',
	'excluded',
	'include_transfers'
] as const;
export type FilterField = (typeof filterFields)[number];
export interface TransactionFilters {
	search?: string;
	account_id?: string;
	third_party_id?: string;
	date_from?: string;
	date_to?: string;
	category_id?: string;
	payment_mode_id?: string;
	project_id?: string;
	allocation_status?: string;
	record_type?: string;
	excluded?: string;
	include_transfers?: boolean;
	limit?: number;
	offset?: number;
}
export type FixedFilters = Partial<TransactionFilters>;
export function filterHref(current: string, changes: Record<string, string | number | undefined>) {
	const url = new URL(current, 'http://localhost');
	url.searchParams.delete('offset');
	for (const [key, value] of Object.entries(changes)) {
		if (value === undefined || value === '') url.searchParams.delete(key);
		else url.searchParams.set(key, String(value));
	}
	return url.pathname + url.search + url.hash;
}
export function resetFilterHref(current: string) {
	const changes = Object.fromEntries(
		[...filterFields, 'offset', 'limit'].map((key) => [key, undefined])
	);
	return filterHref(current, changes);
}
