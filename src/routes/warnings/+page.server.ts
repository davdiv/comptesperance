import { listWarnings } from '#lib/server/warnings.ts';
import { parseTransactionFilters } from '#lib/server/transaction-filters.ts';
import { paginate } from '#lib/pagination.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const filters = parseTransactionFilters(url);
	return {
		...paginate(await listWarnings(), filters),
		filters,
		filterUrl: url.pathname + url.search
	};
};
