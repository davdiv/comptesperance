<script lang="ts">
	import type { Snippet } from 'svelte';

	const {
		label,
		value,
		tone = 'default',
		hint
	}: {
		label: string;
		value: string | number;
		tone?: 'default' | 'positive' | 'negative' | 'brand';
		hint?: Snippet;
	} = $props();

	const toneClass = $derived(
		{
			default: 'text-stone-900',
			positive: 'text-emerald-700',
			negative: 'text-red-700',
			brand: 'text-brand-700'
		}[tone]
	);
</script>

<div class="card px-5 py-4">
	<div class="text-xs font-medium text-stone-500">{label}</div>
	<div class="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums {toneClass}">{value}</div>
	{#if hint}<div class="mt-1 text-xs text-stone-500">{@render hint()}</div>{/if}
</div>
