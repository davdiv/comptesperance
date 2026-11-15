import { parseTransactionFilters } from './transaction-filters';
import type { TransactionView } from './queries';
import type { TransferGroup } from './transfer-groups';
import { transferFields, type TransferFilters } from '#lib/transfer-filters.ts';

export function transferFilters(url: URL, prefix = ''): TransferFilters {
	const params = new URL('http://localhost');
	for (const field of [...transferFields, 'limit', 'offset']) {
		const value = url.searchParams.get(prefix + field);
		if (value !== null) params.searchParams.set(field, value);
	}
	const parsed = parseTransactionFilters(params);
	const balance = url.searchParams.get(prefix + 'balance') ?? '';
	return {
		search: parsed.search,
		account_id: parsed.account_id,
		date_from: parsed.date_from,
		date_to: parsed.date_to,
		limit: parsed.limit,
		offset: parsed.offset,
		balance: ['balanced', 'unbalanced', 'allocations_unbalanced'].includes(balance) ? balance : ''
	};
}

export function matchingTransferMembers(
	members: TransactionView[],
	filters: ReturnType<typeof transferFilters>,
	accountNames: Record<string, string>
) {
	const search = filters.search?.toLocaleLowerCase();
	return members.some(
		(member) =>
			(!filters.account_id || member.account_id === filters.account_id) &&
			(!filters.date_from || member.date.slice(0, 10) >= filters.date_from) &&
			(!filters.date_to || member.date.slice(0, 10) <= filters.date_to) &&
			(!search ||
				[
					member.label,
					member.description,
					member.notes,
					accountNames[member.account_id],
					...member.allocation_details.map((a) => a.project_name)
				].some((value) => value?.toLocaleLowerCase().includes(search)))
	);
}

export function matchingTransferGroup(
	group: TransferGroup,
	filters: ReturnType<typeof transferFilters>
) {
	if (filters.balance === 'balanced') return group.balanced;
	if (filters.balance === 'unbalanced') return !group.balanced;
	if (filters.balance === 'allocations_unbalanced') return !group.allocations_balanced;
	return true;
}
