<script lang="ts">
	import type { Snippet } from 'svelte';
	import { SvelteURL } from 'svelte/reactivity';
	import { m } from '#lib/paraglide/messages.js';
	import { PAGE_SIZE } from '#lib/pagination.ts';
	let {
		current,
		fields,
		active = false,
		limit = PAGE_SIZE,
		limitKey = 'limit',
		offsetKey = 'offset',
		resetHref,
		children,
		actions
	}: {
		current: string;
		fields: readonly string[];
		active?: boolean;
		limit?: number;
		limitKey?: string;
		offsetKey?: string;
		resetHref: string;
		children: Snippet;
		actions?: Snippet;
	} = $props();
	const url = $derived(new SvelteURL(current, 'http://localhost'));
	const preserved = $derived(
		[...url.searchParams].filter(([key]) => ![...fields, offsetKey, limitKey].includes(key))
	);
</script>

<details class="card" open={active}>
	<summary class="cursor-pointer px-5 py-4 text-sm font-semibold">{m.filters_title()}</summary>
	<form
		method="GET"
		action={url.pathname + url.hash}
		onsubmit={(event) => {
			event.currentTarget.action = url.pathname + window.location.hash;
		}}
		class="grid gap-4 border-t border-stone-100 p-5 sm:grid-cols-2 lg:grid-cols-3"
	>
		{#each preserved as [name, value], i (i)}<input type="hidden" {name} {value} />{/each}
		<input type="hidden" name={limitKey} value={limit} />
		{@render children()}
		<div class="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
			<button class="btn">{m.common_search()}</button>
			<a
				class="btn-ghost"
				href={resetHref}
				onclick={(event) => {
					const target = new SvelteURL(resetHref, window.location.origin);
					target.hash = window.location.hash;
					event.currentTarget.href = target.pathname + target.search + target.hash;
				}}>{m.common_reset()}</a
			>
			{@render actions?.()}
		</div>
	</form>
</details>
