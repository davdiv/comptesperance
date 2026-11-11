<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { filterHref, type FilterField, type FixedFilters } from '#lib/transaction-filters.ts';
	let {
		field,
		value,
		label,
		current = '/transactions',
		fixed = {},
		entityHref,
		class: className = 'link'
	}: {
		field: FilterField;
		value: string;
		label: string;
		current?: string;
		fixed?: FixedFilters;
		entityHref?: string;
		class?: string;
	} = $props();
</script>

{#if field in fixed}<span class={className}>{label}</span>{:else}<a
		class={className}
		href={filterHref(current, { [field]: value })}
		onclick={(event) => {
			event.currentTarget.href = filterHref(window.location.href, { [field]: value });
		}}
		data-filter={field}>{label}</a
	>{/if}
{#if entityHref}<a
		class="ml-1 inline-block text-xs text-stone-500 hover:text-brand-800"
		href={entityHref}
		title={m.filters_open_entity({ name: label })}
		aria-label={m.filters_open_entity({ name: label })}>↗</a
	>{/if}
