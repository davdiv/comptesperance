import type { PageServerLoad } from './$types';
import {
	listAccountsWithTotals,
	listProjectsWithTotals,
	listThirdPartiesWithCounts,
	listTransactions
} from '$lib/server/queries';

export const load: PageServerLoad = async () => {
	const [accounts, projects, thirdParties, recent] = await Promise.all([
		listAccountsWithTotals(),
		listProjectsWithTotals(),
		listThirdPartiesWithCounts(),
		listTransactions({ limit: 8, include_transfers: true })
	]);
	return { accounts, projects, thirdParties, recent: recent.transactions };
};
