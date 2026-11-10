import type { PageServerLoad } from './$types';
import {
	listAccountsWithTotals,
	listThirdPartiesWithCounts,
	listTransactions
} from '$lib/server/queries';

export const load: PageServerLoad = async ({ url }) => {
	const includeTransfers = url.searchParams.get('include_transfers') === '1';
	const filters = {
		account_id: url.searchParams.get('account_id') || undefined,
		third_party_id: url.searchParams.get('third_party_id') || undefined,
		search: url.searchParams.get('search') || undefined,
		date_from: url.searchParams.get('date_from') || undefined,
		date_to: url.searchParams.get('date_to') || undefined,
		record_type: url.searchParams.get('record_type') || undefined,
		include_transfers: includeTransfers,
		limit: 500
	};
	const [transactions, accounts, thirdParties] = await Promise.all([
		listTransactions(filters),
		listAccountsWithTotals(),
		listThirdPartiesWithCounts()
	]);
	return { ...transactions, accounts, thirdParties, filters, includeTransfers };
};
