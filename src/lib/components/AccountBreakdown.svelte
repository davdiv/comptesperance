<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Amount from '#lib/components/Amount.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';

	const {
		accounts,
		emptyMessage = m.project_no_allocations()
	}: {
		accounts: {
			account_id: string;
			account_name: string | null;
			incoming_cents: number;
			outgoing_cents: number;
			transfer_cents?: number;
			amount_cents: number;
		}[];
		emptyMessage?: string;
	} = $props();
</script>

<section class="card p-5">
	<h2 class="font-semibold">{m.project_by_account()}</h2>
	<ul class="mt-3 divide-y divide-stone-100 text-sm">
		{#each accounts as item (item.account_id)}
			<li class="flex flex-wrap items-center justify-between gap-4 py-3">
				<div class="min-w-0">
					<a class="link font-medium" href="/accounts/{item.account_id}"
						>{item.account_name ?? item.account_id}</a
					>
					<div class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
						{#if item.transfer_cents}<span
								>{m.common_transfers()}: <Amount cents={item.transfer_cents} signed={false} /></span
							>{/if}
						<span
							>{m.account_incoming()}: <Amount
								cents={item.incoming_cents}
								signed={false}
								class="text-emerald-700"
							/></span
						>
						<span
							>{m.account_outgoing()}: <Amount cents={item.outgoing_cents} signed={false} /></span
						>
					</div>
				</div>
				<Amount
					cents={item.amount_cents}
					signed={false}
					class="shrink-0 text-right font-medium tabular-nums"
				/>
			</li>
		{:else}<li><EmptyState message={emptyMessage} /></li>{/each}
	</ul>
</section>
