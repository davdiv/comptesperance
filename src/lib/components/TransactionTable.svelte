<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate, formatMoney } from '$lib/format';
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
		allocation_details?: {
			project_id: string;
			project_name?: string | null;
			amount_cents: number;
		}[];
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
	<div class="max-w-full overflow-x-auto">
		<table class="table w-full table-fixed sm:w-auto sm:table-auto">
			<thead>
				<tr>
					<th class="hidden w-32 sm:table-cell">{m.common_date()}</th>
					<th>{m.common_label()}</th>
					{#if accountNames}<th class="hidden sm:table-cell">{m.import_account()}</th>{/if}
					{#if !compact}<th class="hidden sm:table-cell">{m.common_third_party()}</th>{/if}
					{#if !compact}<th class="hidden sm:table-cell">{m.payment_mode()}</th>{/if}
					<th class="num w-28 sm:w-auto">{m.common_amount()}</th>
				</tr>
			</thead>
			<tbody>
				{#each transactions as tx (tx.account_id + '/' + tx.id)}
					{@const allocations = tx.allocation_details ?? []}
					{@const remaining =
						tx.amount_cents - allocations.reduce((sum, item) => sum + item.amount_cents, 0)}
					<tr class="group">
						<td class="hidden whitespace-nowrap text-stone-500 tabular-nums sm:table-cell"
							>{formatDate(tx.date)}</td
						>
						<td class="max-w-md min-w-0 sm:min-w-48">
							<div class="mb-1 text-xs text-stone-500 sm:hidden">
								{formatDate(tx.date)}{#if accountNames}
									· {accountNames[tx.account_id] ?? tx.account_id}{/if}
							</div>
							<a href="/transactions/{tx.account_id}/{tx.id}" class="row-link block truncate"
								>{tx.label || tx.description || '—'}</a
							>
							{#if tx.description?.trim() && tx.description.trim() !== (tx.label || tx.description).trim()}
								<p
									class="mt-1 line-clamp-2 text-xs leading-relaxed text-stone-500"
									title={tx.description}
								>
									{tx.description}
								</p>
							{/if}
							{#if allocations.length}
								<div class="mt-1.5 flex flex-wrap items-center gap-1">
									{#each allocations as allocation (allocation.project_id)}
										<a
											href="/projects/{allocation.project_id}"
											title={allocation.project_name ?? allocation.project_id}
											class="inline-flex max-w-full min-w-0 items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-xs text-brand-800 hover:bg-brand-100"
										>
											<Icon name="projects" class="size-3 shrink-0" />
											<span class="truncate"
												>{allocation.project_name ?? allocation.project_id}</span
											>
											{#if allocation.amount_cents !== tx.amount_cents}<span
													class="shrink-0 tabular-nums"
													>· {formatMoney(allocation.amount_cents)}</span
												>{/if}
										</a>
									{/each}
									{#if remaining !== 0}<span class="text-xs text-stone-500 tabular-nums"
											>{m.allocation_remaining({ amount: formatMoney(remaining) })}</span
										>{/if}
								</div>
							{/if}
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
						{#if accountNames}<td class="hidden whitespace-nowrap text-stone-600 sm:table-cell"
								>{accountNames[tx.account_id] ?? tx.account_id}</td
							>{/if}
						{#if !compact}<td class="hidden text-stone-600 sm:table-cell"
								>{tx.third_party_name ?? '—'}</td
							>{/if}
						{#if !compact}<td class="hidden sm:table-cell"
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
	</div>
{:else}
	<EmptyState message={empty} icon="transactions" />
{/if}
