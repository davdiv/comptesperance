import { parseTransactionFilters } from './transaction-filters';
import {
	listAccountsWithTotals,
	listThirdPartiesWithCounts,
	listProjectsWithTotals,
	listTransactions
} from './queries';
import type { TransactionFilters } from '$lib/transaction-filters';
export async function transactionFilterState(
	url: URL,
	fixed: Partial<TransactionFilters> = {},
	defaults: Partial<TransactionFilters> = {}
) {
	const [accounts, thirdParties, projects] = await Promise.all([
		listAccountsWithTotals(),
		listThirdPartiesWithCounts(),
		listProjectsWithTotals()
	]);
	const filters = parseTransactionFilters(url, fixed, defaults);
	return {
		filters,
		fixedFilters: fixed,
		filterUrl: url.pathname + url.search,
		filterOptions: { accounts, thirdParties, projects },
		includeTransfers: !!filters.include_transfers
	};
}
export function thirdPartyPerspective(result: Awaited<ReturnType<typeof listTransactions>>) {
	const negate = (value: number) => (value === 0 ? 0 : -value);
	return {
		...result,
		total_cents: negate(result.total_cents),
		incoming_cents: negate(result.outgoing_cents),
		outgoing_cents: negate(result.incoming_cents),
		transactions: result.transactions.map((tx) => ({
			...tx,
			amount_cents: negate(tx.amount_cents),
			allocations: tx.allocations.map((a) => ({ ...a, amount_cents: negate(a.amount_cents) })),
			allocation_details: tx.allocation_details.map((a) => ({
				...a,
				amount_cents: negate(a.amount_cents)
			}))
		}))
	};
}
