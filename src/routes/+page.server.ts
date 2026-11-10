import type { PageServerLoad } from './$types';
import {
	listAccountsWithTotals,
	listProjectsWithTotals,
	listThirdPartiesWithCounts
} from '$lib/server/queries';

export const load: PageServerLoad = async () => {
	const [accounts, projects, thirdParties] = await Promise.all([
		listAccountsWithTotals(),
		listProjectsWithTotals(),
		listThirdPartiesWithCounts()
	]);
	return { accounts, projects, thirdParties };
};
