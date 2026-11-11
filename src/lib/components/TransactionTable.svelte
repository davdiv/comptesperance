<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate } from '$lib/format';
	import Amount from './Amount.svelte';
	import EmptyState from './EmptyState.svelte';
	import Icon from './Icon.svelte';

	interface Row {
		id: string;
		account_id: string;
		date: string;
		label: string;
		description?: string | null;
		amount_cents: number;
		record_type?: string | null;
		category_id?: string | null;
		category_name?: string | null;
		payment_mode_id?: string | null;
		payment_mode_name?: string | null;
		third_party_name?: string | null;
		transfer_id?: string | null;
		evidence?: string[];
		excluded?: boolean;
	}

	const {
		transactions,
		accountNames,
		empty = m.account_no_transactions(),
		compact = false
	}: {
		transactions: Row[];
		accountNames?: Record<string, string>;
		empty?: string;
		compact?: boolean;
	} = $props();
</script>

{#if transactions.length}
	<table class="table">
		<thead>
			<tr>
				<th class="w-32">{m.common_date()}</th>
				<th>{m.common_label()}</th>
				{#if accountNames}<th>{m.import_account()}</th>{/if}
				{#if !compact}<th>{m.common_third_party()}</th>{/if}
				{#if !compact}<th>{m.payment_mode()}</th>{/if}
				<th class="num">{m.common_amount()}</th>
			</tr>
		</thead>
		<tbody>
			{#each transactions as tx (tx.account_id + '/' + tx.id)}
				<tr class="group">
					<td class="whitespace-nowrap text-stone-500 tabular-nums">{formatDate(tx.date)}</td>
					<td class="max-w-md">
						<a href="/transactions/{tx.account_id}/{tx.id}" class="row-link block truncate"
							>{tx.label || tx.description || '—'}</a
						>
						<div class="mt-1 flex flex-wrap items-center gap-1.5">
							{#if tx.category_id}<span
									class="badge {tx.category_name ? 'badge-blue' : 'badge-amber'}"
									>{tx.category_name ?? m.config_unknown() + ' (' + tx.category_id + ')'}</span
								>{/if}
							{#if tx.transfer_id}<span class="badge badge-violet"
									><Icon name="transactions" class="size-3" />{m.common_transfers()}</span
								>{/if}
							{#if tx.excluded}<span class="badge badge-amber">{m.transaction_excluded()}</span
								>{/if}
							{#if tx.evidence?.length}<span
									class="inline-flex items-center gap-0.5 text-xs text-stone-500"
									title={m.common_evidence()}
									><Icon name="paperclip" class="size-3" />{tx.evidence.length}</span
								>{/if}
						</div>
					</td>
					{#if accountNames}<td class="whitespace-nowrap text-stone-600"
							>{accountNames[tx.account_id] ?? tx.account_id}</td
						>{/if}
					{#if !compact}<td class="text-stone-600">{tx.third_party_name ?? '—'}</td>{/if}
					{#if !compact}<td
							>{tx.payment_mode_name ??
								(tx.payment_mode_id
									? m.config_unknown() + ' (' + tx.payment_mode_id + ')'
									: '—')}</td
						>{/if}
					<td class="num font-medium"><Amount cents={tx.amount_cents} /></td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<EmptyState message={empty} icon="transactions" />
{/if}
