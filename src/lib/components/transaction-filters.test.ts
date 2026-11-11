import { render } from 'svelte/server';
import { expect, it } from 'vitest';
import TransactionFilters from './TransactionFilters.svelte';
import FilterLink from './FilterLink.svelte';
import TransactionPagination from './TransactionPagination.svelte';
it('collapses empty filters, opens active ones and hides fixed fields', () => {
	expect(render(TransactionFilters).body).not.toContain(' open');
	const html = render(TransactionFilters, {
		props: {
			current: '/third-parties/t?search=cake&mode=custom',
			filters: { search: 'cake', third_party_id: 't' },
			fixed: { third_party_id: 't' }
		}
	}).body;
	expect(html).toContain(' open');
	expect(html).not.toContain('name="third_party_id"');
	expect(html).toContain('name="search"');
	expect(html).toContain('name="mode" value="custom"');
});
it('adds a filter while retaining navigation and renders fixed dimensions as text', () => {
	const props = {
		field: 'project_id' as const,
		value: 'p',
		label: 'Project',
		entityHref: '/projects/p',
		current: '/accounts/cash?search=cake&offset=5'
	};
	const html = render(FilterLink, { props }).body;
	expect(html).toContain('/accounts/cash?search=cake&amp;project_id=p');
	expect(html).toContain('href="/projects/p"');
	expect(html).not.toContain('offset=');
	expect(
		render(FilterLink, { props: { ...props, fixed: { project_id: 'p' } } }).body
	).not.toContain('data-filter=');
});
it('preserves active filters in pagination and omits empty page controls', () => {
	expect(render(TransactionPagination).body).not.toContain('<nav');
	const html = render(TransactionPagination, {
		props: { current: '/transactions?category_id=c', filters: { limit: 2 }, total: 5, hidden: 1 }
	}).body;
	expect(html).toContain('category_id=c&amp;offset=2');
});
