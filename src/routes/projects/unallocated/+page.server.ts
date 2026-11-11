import { getUnallocatedDetails } from '$lib/server/queries';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const includeTransfers = url.searchParams.get('include_transfers') === '1';
	return { ...(await getUnallocatedDetails(includeTransfers)), includeTransfers };
};
