import type { PageServerLoad } from './$types';
import { listAccountsWithTotals, listProjectsWithTotals } from '#lib/server/queries.ts';

export const load: PageServerLoad = async () => {
	const [accounts, projects] = await Promise.all([
		listAccountsWithTotals(),
		listProjectsWithTotals()
	]);
	return { accounts, projects };
};
