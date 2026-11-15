export const PAGE_SIZE = 50;
export const PAGE_SIZES = [25, 50, 100];

export interface PageOptions {
	limit?: number;
	offset?: number;
}

export function pagination(total: number, options: PageOptions = {}) {
	const limit = Math.max(1, options.limit ?? PAGE_SIZE);
	const offset = Math.min(
		Math.max(0, options.offset ?? 0),
		Math.max(0, Math.ceil(total / limit) - 1) * limit
	);
	return { limit, offset };
}

export function paginate<T>(items: T[], options: PageOptions = {}) {
	const page = pagination(items.length, options);
	return { ...page, total: items.length, rows: items.slice(page.offset, page.offset + page.limit) };
}
