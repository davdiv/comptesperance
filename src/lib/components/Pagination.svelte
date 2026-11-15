<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { pagination, PAGE_SIZES, type PageOptions } from '#lib/pagination.ts';
	let {
		filters = {},
		current = '/transactions',
		total = 0,
		hidden = 0,
		offsetKey = 'offset',
		limitKey = 'limit'
	}: {
		filters?: PageOptions;
		current?: string;
		total?: number;
		hidden?: number;
		offsetKey?: string;
		limitKey?: string;
	} = $props();
	const count = $derived(Math.max(0, total - hidden));
	const page = $derived(pagination(count, filters));
	const url = $derived(new URL(current, 'http://localhost'));
	const preserved = $derived(
		[...url.searchParams].filter(([key]) => key !== offsetKey && key !== limitKey)
	);
	function href(current: string, offset: number) {
		const url = new URL(current, 'http://localhost');
		url.searchParams.set(offsetKey, String(offset));
		return url.pathname + url.search + url.hash;
	}
</script>

{#if count > 0 || (filters.offset ?? 0) > 0}
	<nav
		class="flex flex-wrap items-center justify-between gap-3 text-sm"
		aria-label={m.filters_pagination()}
	>
		<div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-stone-500">
			<span
				>{m.filters_page_range({
					start: count ? page.offset + 1 : 0,
					end: Math.min(page.offset + page.limit, count),
					total: count
				})}</span
			>
			<span
				>{m.pdf_page({
					page: Math.floor(page.offset / page.limit) + 1,
					pages: Math.max(1, Math.ceil(count / page.limit))
				})}</span
			>
		</div>
		<div class="flex flex-wrap items-center gap-3">
			<form
				method="GET"
				action={url.pathname + url.hash}
				class="flex items-center gap-2"
				onsubmit={(event) => {
					event.currentTarget.action = url.pathname + window.location.hash;
				}}
			>
				{#each preserved as [name, value], i (i)}<input type="hidden" {name} {value} />{/each}
				<label class="flex items-center gap-2 whitespace-nowrap text-stone-500"
					>{m.pagination_size()}
					<select
						name={limitKey}
						class="control py-1.5"
						value={page.limit}
						onchange={(event) => event.currentTarget.form?.requestSubmit()}
					>
						{#if !PAGE_SIZES.includes(page.limit)}<option value={page.limit}>{page.limit}</option
							>{/if}
						{#each PAGE_SIZES as size (size)}<option value={size}>{size}</option>{/each}
					</select>
				</label>
				<noscript><button class="btn-secondary btn-sm">{m.common_save()}</button></noscript>
			</form>
			<div class="flex gap-2">
				{#if page.offset > 0}<a
						class="btn-secondary btn-sm"
						href={href(current, Math.max(0, page.offset - page.limit))}
						onclick={(event) => {
							event.currentTarget.href = href(
								window.location.href,
								Math.max(0, page.offset - page.limit)
							);
						}}>{m.filters_previous()}</a
					>{:else}<span
						class="btn-secondary btn-sm pointer-events-none opacity-40"
						aria-disabled="true">{m.filters_previous()}</span
					>{/if}
				{#if page.offset + page.limit < count}<a
						class="btn-secondary btn-sm"
						href={href(current, page.offset + page.limit)}
						onclick={(event) => {
							event.currentTarget.href = href(window.location.href, page.offset + page.limit);
						}}>{m.filters_next()}</a
					>{:else}<span
						class="btn-secondary btn-sm pointer-events-none opacity-40"
						aria-disabled="true">{m.filters_next()}</span
					>{/if}
			</div>
		</div>
	</nav>
{/if}
