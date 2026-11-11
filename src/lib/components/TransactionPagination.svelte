<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { filterHref, type TransactionFilters } from '#lib/transaction-filters.ts';
	let {
		filters = {},
		current = '/transactions',
		total = 0,
		hidden = 0
	}: { filters?: TransactionFilters; current?: string; total?: number; hidden?: number } = $props();
	const count = $derived(Math.max(0, total - hidden));
	const limit = $derived(filters.limit ?? 500);
	const offset = $derived(filters.offset ?? 0);
</script>

{#if offset > 0 || count > limit}
	<nav
		class="flex flex-wrap items-center justify-between gap-3 text-sm"
		aria-label={m.filters_pagination()}
	>
		<span class="text-stone-500"
			>{m.filters_page_range({
				start: count ? Math.min(offset + 1, count) : 0,
				end: Math.min(offset + limit, count),
				total: count
			})}</span
		>
		<div class="flex gap-2">
			{#if offset > 0}<a
					class="btn-secondary"
					href={filterHref(current, { offset: Math.max(0, offset - limit) })}
					onclick={(event) => {
						event.currentTarget.href = filterHref(window.location.href, {
							offset: Math.max(0, offset - limit)
						});
					}}>{m.filters_previous()}</a
				>{/if}
			{#if offset + limit < count}<a
					class="btn-secondary"
					href={filterHref(current, { offset: offset + limit })}
					onclick={(event) => {
						event.currentTarget.href = filterHref(window.location.href, { offset: offset + limit });
					}}>{m.filters_next()}</a
				>{/if}
		</div>
	</nav>
{/if}
