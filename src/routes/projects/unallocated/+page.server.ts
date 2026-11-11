import { transactionFilterState } from '$lib/server/transaction-list';
import { getUnallocatedDetails } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const state = await transactionFilterState(url, {
		project_id: undefined,
		allocation_status: undefined,
		excluded: '0'
	});
	return { ...state, ...(await getUnallocatedDetails(state.filters)) };
};
