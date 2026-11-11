import { filterFields, type TransactionFilters } from '#lib/transaction-filters.ts';
export function parseTransactionFilters(
	url: URL,
	fixed: Partial<TransactionFilters> = {},
	defaults: Partial<TransactionFilters> = {}
): TransactionFilters {
	const filters: TransactionFilters = { ...defaults };
	for (const field of filterFields) {
		const value = url.searchParams.get(field)?.trim();
		if (field === 'include_transfers') {
			if (value === '1' || value === '0') filters.include_transfers = value === '1';
		} else if (value) filters[field] = value;
	}
	for (const field of ['date_from', 'date_to'] as const) {
		const value = filters[field];
		if (
			value &&
			(!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
				Number.isNaN(new Date(value).getTime()) ||
				new Date(value).toISOString().slice(0, 10) !== value)
		)
			delete filters[field];
	}
	if (!['allocated', 'unallocated', 'partial'].includes(filters.allocation_status ?? ''))
		delete filters.allocation_status;
	if (!['0', '1'].includes(filters.excluded ?? '')) delete filters.excluded;
	const integer = (key: string, fallback: number, max: number) => {
		const n = Number(url.searchParams.get(key) ?? fallback);
		return Number.isSafeInteger(n) && n >= 0 ? Math.min(n, max) : fallback;
	};
	filters.limit = Math.max(1, integer('limit', defaults.limit ?? 500, 1000));
	filters.offset = integer('offset', 0, Number.MAX_SAFE_INTEGER);
	return { ...filters, ...fixed };
}
export function transactionWhere(filters: TransactionFilters) {
	const where: string[] = [];
	const params: (string | number)[] = [];
	for (const key of [
		'account_id',
		'third_party_id',
		'category_id',
		'payment_mode_id',
		'record_type'
	] as const)
		if (filters[key]) {
			where.push('t.' + key + ' = ?');
			params.push(filters[key]!);
		}
	if (filters.excluded === '0' || filters.excluded === '1') {
		where.push('t.excluded = ?');
		params.push(Number(filters.excluded));
	}
	if (filters.date_from) {
		where.push('t.date >= ?');
		params.push(filters.date_from);
	}
	if (filters.date_to) {
		where.push("t.date < date(?, '+1 day')");
		params.push(filters.date_to);
	}
	if (filters.project_id) {
		where.push(
			'EXISTS (SELECT 1 FROM project_allocations pa WHERE pa.account_id=t.account_id AND pa.transaction_id=t.id AND pa.project_id=?)'
		);
		params.push(filters.project_id);
	}
	const exists =
		'EXISTS (SELECT 1 FROM project_allocations pa JOIN projects p ON p.id=pa.project_id WHERE pa.account_id=t.account_id AND pa.transaction_id=t.id)';
	const amount =
		'(SELECT COALESCE(SUM(ABS(pa.amount_cents)),0) FROM project_allocations pa JOIN projects p ON p.id=pa.project_id WHERE pa.account_id=t.account_id AND pa.transaction_id=t.id)';
	if (filters.allocation_status === 'allocated')
		where.push(exists, amount + ' = ABS(t.amount_cents)');
	if (filters.allocation_status === 'unallocated') where.push('NOT ' + exists);
	if (filters.allocation_status === 'partial')
		where.push(exists, amount + ' > 0', amount + ' < ABS(t.amount_cents)');
	if (filters.search?.trim()) {
		where.push(
			"(t.label LIKE ? OR COALESCE(t.description,'') LIKE ? OR COALESCE(t.notes,'') LIKE ? OR COALESCE(c.name,'') LIKE ? OR COALESCE(pm.name,'') LIKE ? OR COALESCE(tp.name,'') LIKE ?)"
		);
		params.push(...Array(6).fill('%' + filters.search.trim() + '%'));
	}
	return { where, params };
}
export function visiblePage<T>(
	items: T[],
	filters: TransactionFilters,
	transfer: (item: T) => boolean
) {
	const visible = filters.include_transfers ? items : items.filter((item) => !transfer(item));
	return {
		rows: visible.slice(
			filters.offset ?? 0,
			(filters.offset ?? 0) + (filters.limit ?? visible.length)
		),
		hidden_transfer_count: items.length - visible.length
	};
}
