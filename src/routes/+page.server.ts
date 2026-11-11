import { transactionFilterState } from '#lib/server/transaction-list.ts';
import type { PageServerLoad } from './$types';
import {
	listAccountsWithTotals,
	listProjectsWithTotals,
	listThirdPartiesWithCounts,
	listTransactions
} from '#lib/server/queries.ts';

export const load: PageServerLoad = async ({ url }) => {
	const state = await transactionFilterState(url, {}, { include_transfers: true, limit: 8 });
	const [accounts, projects, thirdParties, recent] = await Promise.all([
		listAccountsWithTotals(state.filters),
		listProjectsWithTotals(state.filters),
		listThirdPartiesWithCounts(),
		listTransactions(state.filters)
	]);
	return { ...state, ...recent, accounts, projects, thirdParties, recent: recent.transactions };
};
