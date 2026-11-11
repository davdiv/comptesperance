<script lang="ts">
	import type { Snippet } from 'svelte';
	import StatCard from '#lib/components/StatCard.svelte';
	import { formatMoney } from '#lib/format.ts';
	import { m } from '#lib/paraglide/messages.js';

	const {
		total,
		incoming,
		outgoing,
		transfers = 0,
		totalLabel,
		totalHint,
		totalLast = false,
		class: className = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-4'
	}: {
		total: number;
		incoming: number;
		outgoing: number;
		transfers?: number;
		totalLabel: string;
		totalHint?: Snippet;
		totalLast?: boolean;
		class?: string;
	} = $props();
</script>

{#snippet net()}
	<StatCard
		label={totalLabel}
		value={formatMoney(total)}
		tone={total < 0 ? 'negative' : 'brand'}
		hint={totalHint}
	/>
{/snippet}

<section class={className}>
	{#if !totalLast}{@render net()}{/if}
	<StatCard label={m.account_incoming()} value={formatMoney(incoming)} tone="positive" />
	<StatCard label={m.account_outgoing()} value={formatMoney(outgoing)} />
	{#if transfers !== 0}<StatCard label={m.common_transfers()} value={formatMoney(transfers)} />{/if}
	{#if totalLast}{@render net()}{/if}
</section>
