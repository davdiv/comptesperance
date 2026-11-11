<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate, formatMoney } from '#lib/format.ts';
	import type { FixedFilters } from '#lib/transaction-filters.ts';
	import FilterLink from './FilterLink.svelte';
	import AllocationEditor from './AllocationEditor.svelte';
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
		category_id?: string | null;
		category_name?: string | null;
		payment_mode_id?: string | null;
		payment_mode_name?: string | null;
		third_party_id?: string | null;
		third_party_name?: string | null;
		transfer_id?: string | null;
		evidence?: string[];
		excluded?: boolean;
		unallocated_cents?: number;
		allocation_details?: {
			project_id: string;
			project_name?: string | null;
			amount_cents: number;
			note?: string;
		}[];
	}
	let {
		transactions,
		accountNames,
		empty = m.account_no_transactions(),
		compact = false,
		filterUrl = '/transactions',
		fixedFilters = {},
		projectId,
		unallocated = false,
		canWrite = false
	}: {
		transactions: Row[];
		accountNames?: Record<string, string>;
		empty?: string;
		compact?: boolean;
		filterUrl?: string;
		fixedFilters?: FixedFilters;
		projectId?: string;
		unallocated?: boolean;
		canWrite?: boolean;
	} = $props();
</script>

{#snippet party(tx: Row)}
	{#if tx.third_party_id}<FilterLink
			field="third_party_id"
			value={tx.third_party_id}
			label={tx.third_party_name ?? tx.third_party_id}
			current={filterUrl}
			fixed={fixedFilters}
			entityHref="/third-parties/{tx.third_party_id}"
		/>{:else}—{/if}
{/snippet}
{#snippet payment(tx: Row)}
	{#if tx.payment_mode_id}<FilterLink
			field="payment_mode_id"
			value={tx.payment_mode_id}
			label={tx.payment_mode_name ?? m.config_unknown() + ' (' + tx.payment_mode_id + ')'}
			current={filterUrl}
			fixed={fixedFilters}
		/>{:else}—{/if}
{/snippet}
{#if transactions.length}
	<div class="max-w-full overflow-x-auto">
		<table class="table w-full table-fixed sm:w-auto sm:table-auto">
			<thead
				><tr>
					<th class="hidden w-32 sm:table-cell">{m.common_date()}</th><th>{m.common_label()}</th>
					{#if accountNames}<th class="hidden sm:table-cell">{m.import_account()}</th>{/if}
					{#if !compact && !('third_party_id' in fixedFilters)}<th class="hidden sm:table-cell"
							>{m.common_third_party()}</th
						>{/if}
					{#if !compact}<th class="hidden sm:table-cell">{m.payment_mode()}</th>{/if}
					<th class="num w-28 sm:w-auto"
						>{projectId ? m.project_allocation_amount() : m.common_amount()}</th
					>
					{#if unallocated}<th class="num w-28 sm:w-auto">{m.unallocated_remainder()}</th
						>{#if canWrite}<th>{m.common_actions()}</th>{/if}{/if}
				</tr></thead
			>
			<tbody>
				{#each transactions as tx (tx.account_id + '/' + tx.id)}
					{@const allocations = tx.allocation_details ?? []}
					{@const allocation = allocations.find((a) => a.project_id === projectId)}
					{@const remaining =
						tx.amount_cents -
						allocations
							.filter((a) => a.project_name !== null)
							.reduce((sum, a) => sum + a.amount_cents, 0)}
					{@const isPartial = remaining !== 0 && remaining !== tx.amount_cents}
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
							{#if tx.description?.trim() && tx.description.trim() !== (tx.label || tx.description).trim()}<p
									class="mt-1 line-clamp-2 text-xs leading-relaxed text-stone-500"
									title={tx.description}
								>
									{tx.description}
								</p>{/if}
							{#if allocations.length}<div class="mt-1.5 flex flex-wrap items-center gap-1">
									{#each allocations as a (a.project_id)}
										<span
											class="inline-flex max-w-full min-w-0 flex-wrap items-center gap-1 rounded-md bg-brand-50 px-1.5 py-0.5 text-xs text-brand-800"
										>
											<Icon name="projects" class="size-3 shrink-0" />
											{#if a.project_name === null}<span
													>{m.allocation_deleted_project()} ({a.project_id})</span
												>{:else}<FilterLink
													field="project_id"
													value={a.project_id}
													label={a.project_name ?? a.project_id}
													current={filterUrl}
													fixed={fixedFilters}
													entityHref="/projects/{a.project_id}"
													class="truncate hover:underline"
												/>{/if}
											{#if isPartial}<span class="shrink-0 tabular-nums"
													>· {formatMoney(a.amount_cents)}</span
												>{/if}
										</span>
									{/each}
									{#if isPartial}<FilterLink
											field="allocation_status"
											value="partial"
											label={m.allocation_remaining({ amount: formatMoney(remaining) })}
											current={filterUrl}
											fixed={fixedFilters}
											class="text-xs text-stone-500 tabular-nums hover:underline"
										/>{/if}
								</div>{/if}
							<div class="mt-1 flex flex-wrap items-center gap-1.5">
								{#if tx.category_id}<FilterLink
										field="category_id"
										value={tx.category_id}
										label={tx.category_name ?? m.config_unknown() + ' (' + tx.category_id + ')'}
										current={filterUrl}
										fixed={fixedFilters}
										class="badge {tx.category_name ? 'badge-blue' : 'badge-amber'}"
									/>{/if}
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
							{#if !compact}<div class="mt-1 flex flex-wrap gap-2 text-xs sm:hidden">
									{#if !('third_party_id' in fixedFilters)}{@render party(tx)}{/if}{@render payment(
										tx
									)}
								</div>{/if}
						</td>
						{#if accountNames}<td class="hidden whitespace-nowrap text-stone-600 sm:table-cell"
								>{accountNames[tx.account_id] ?? tx.account_id}</td
							>{/if}
						{#if !compact && !('third_party_id' in fixedFilters)}<td
								class="hidden text-stone-600 sm:table-cell">{@render party(tx)}</td
							>{/if}
						{#if !compact}<td class="hidden sm:table-cell">{@render payment(tx)}</td>{/if}
						<td class="num font-medium">
							{#if projectId && allocation && canWrite}<AllocationEditor
									accountId={tx.account_id}
									transactionId={tx.id}
									{projectId}
									amount={allocation.amount_cents}
									note={allocation.note}
								/>{:else}<Amount
									cents={projectId ? (allocation?.amount_cents ?? 0) : tx.amount_cents}
								/>{#if projectId && allocation?.note}<p class="text-xs text-stone-500">
										{allocation.note}
									</p>{/if}{/if}
						</td>
						{#if unallocated}<td class="num"><Amount cents={tx.unallocated_cents ?? 0} /></td
							>{#if canWrite}<td
									><a
										class="btn-secondary btn-sm"
										href="/transactions/{tx.account_id}/{tx.id}#allocations"
										>{m.unallocated_allocate()}</a
									></td
								>{/if}{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}<EmptyState message={empty} icon="transactions" />{/if}
