import { expect, it } from 'vitest';
import { paginate, pagination } from './pagination';
import { visiblePage } from './server/transaction-filters';

it('defaults to 50 rows and recovers stale pages including empty results', () => {
	expect(pagination(106)).toEqual({ limit: 50, offset: 0 });
	expect(pagination(106, { limit: 25, offset: 999 })).toEqual({ limit: 25, offset: 100 });
	expect(paginate([1, 2, 3], { limit: 2, offset: 999 })).toEqual({
		limit: 2,
		offset: 2,
		total: 3,
		rows: [3]
	});
	expect(pagination(0, { offset: 999 })).toEqual({ limit: 50, offset: 0 });
});

it('keeps unpaginated exports complete even beyond the browsing limit', () => {
	const rows = Array.from({ length: 1501 }, (_, id) => ({ id }));
	expect(visiblePage(rows, {}, () => false).rows).toHaveLength(1501);
	expect(visiblePage(rows, { limit: undefined, offset: 0 }, () => false).rows).toHaveLength(1501);
});
