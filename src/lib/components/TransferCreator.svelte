<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '#lib/paraglide/messages.js';
	import type { TransactionView } from '#lib/server/queries.ts';
	import type { TransferFilters as TransferFilterState } from '#lib/transfer-filters.ts';
	import { formatDate } from '#lib/format.ts';
	import Amount from './Amount.svelte';
	import TransferFilters from './TransferFilters.svelte';
	import Pagination from './Pagination.svelte';
	let {
		pool,
		filters,
		accounts,
		current,
		success = false
	}: {
		pool: { rows: TransactionView[]; total: number };
		filters: TransferFilterState;
		accounts: { account_id: string; name: string }[];
		current: string;
		success?: boolean;
	} = $props();
	let selected = $state<Record<string, TransactionView>>({});
	const members = $derived(Object.entries(selected));
	const accountNames = $derived(
		Object.fromEntries(accounts.map((item) => [item.account_id, item.name]))
	);
	const balance = $derived(members.reduce((sum, [, item]) => sum + item.amount_cents, 0));
	const valid = $derived(new Set(members.map(([, item]) => item.account_id)).size >= 2);
	$effect(() => {
		if (success) selected = {};
	});
	function toggle(key: string, item?: TransactionView) {
		const next = { ...selected };
		if (item) next[key] = item;
		else delete next[key];
		selected = next;
	}
</script>

<details class="card p-4 sm:p-5" id="transfer-create">
	<summary class="cursor-pointer font-medium">{m.transfers_create()}</summary>
	<div class="mt-4 space-y-4">
		<p class="text-sm text-stone-500">{m.transfer_invalid()}</p>
		<TransferFilters {filters} {current} {accounts} prefix="pool_" />
		<div class="divide-y divide-stone-100">
			{#each pool.rows as item (item.account_id + '/' + item.id)}
				{@const key = JSON.stringify([item.account_id, item.id])}
				<label class="flex cursor-pointer items-center gap-3 py-2.5 text-sm"
					><input
						class="checkbox"
						type="checkbox"
						checked={!!selected[key]}
						onchange={(event) => toggle(key, event.currentTarget.checked ? item : undefined)}
					/><span class="min-w-0 flex-1 [overflow-wrap:anywhere]"
						><span class="block text-xs text-stone-500"
							>{accountNames[item.account_id]} · {formatDate(item.date)}</span
						>{item.label}</span
					><Amount cents={item.amount_cents} class="shrink-0" /></label
				>
			{:else}<p class="py-4 text-sm text-stone-500">{m.empty_state()}</p>{/each}
		</div>
		<Pagination
			{filters}
			{current}
			total={pool.total}
			offsetKey="pool_offset"
			limitKey="pool_limit"
		/>
		<form
			method="POST"
			action="?/create"
			use:enhance
			class="space-y-3 border-t border-stone-200 pt-4"
		>
			<div class="flex flex-wrap items-center justify-between gap-2 text-sm">
				<span class="font-medium">{m.transfers_selected({ count: members.length })}</span><span
					class="text-stone-500">{m.transfer_net()}: <Amount cents={balance} /></span
				>
			</div>
			{#if members.length}<ul class="divide-y divide-stone-100">
					{#each members as [key, item] (key)}<li class="flex items-center gap-3 py-2 text-sm">
							<input type="hidden" name="members" value={key} /><span
								class="min-w-0 flex-1 [overflow-wrap:anywhere]"
								><span class="block text-xs text-stone-500">{accountNames[item.account_id]}</span
								>{item.label}</span
							><Amount cents={item.amount_cents} /><button
								type="button"
								class="btn-ghost btn-sm"
								onclick={() => toggle(key)}
								aria-label={m.transfer_deselect({ label: item.label })}
								>{m.transfer_remove_member()}</button
							>
						</li>{/each}
				</ul>{/if}
			<button class="btn" disabled={!valid}>{m.transfers_create()}</button>
		</form>
	</div>
</details>
