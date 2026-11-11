<script lang="ts">
	import TransactionFilters from '#lib/components/TransactionFilters.svelte';
	import TransactionPagination from '#lib/components/TransactionPagination.svelte';
	import TransactionTable from '#lib/components/TransactionTable.svelte';

	import { m } from '#lib/paraglide/messages.js';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import FinancialSummary from '#lib/components/FinancialSummary.svelte';
	import AccountBreakdown from '#lib/components/AccountBreakdown.svelte';
	import type { PageProps } from './$types';
	const { data }: PageProps = $props();
</script>

<div class="space-y-6">
	<PageHeader
		title={m.unallocated_title()}
		subtitle={m.unallocated_description()}
		back={{ href: '/projects', label: m.projects_title() }}
	></PageHeader>
	<TransactionFilters
		filters={data.filters}
		options={data.filterOptions}
		config={data.config}
		current={data.filterUrl}
		fixed={data.fixedFilters}
	/>
	<FinancialSummary
		class="grid gap-4 sm:grid-cols-3"
		total={data.total_cents}
		incoming={data.incoming_cents}
		outgoing={data.outgoing_cents}
		totalLabel={m.unallocated_net()}
		totalLast
	/>
	<AccountBreakdown accounts={data.by_account} emptyMessage={m.empty_state()} />
	<section class="table-wrap">
		<div class="flex items-center justify-between gap-3 border-b border-stone-200 p-4">
			<h2 class="card-title">{m.stat_transactions()}</h2>
			<span class="text-right text-xs text-stone-500"
				>{data.transaction_count}
				{#if data.hidden_transfer_count > 0}<span class="mt-1 block"
						>{m.transactions_hidden_transfers({
							count: data.hidden_transfer_count
						})}</span
					>{/if}
			</span>
		</div>
		<TransactionTable
			transactions={data.transactions}
			accountNames={Object.fromEntries(
				data.filterOptions?.accounts.map((a) => [a.account_id, a.name]) ?? []
			)}
			filterUrl={data.filterUrl}
			fixedFilters={data.fixedFilters}
			unallocated
			canWrite={data.user.canWrite}
		/>
	</section>
	<TransactionPagination
		filters={data.filters}
		current={data.filterUrl}
		total={data.transaction_count}
		hidden={data.hidden_transfer_count}
	/>
</div>
