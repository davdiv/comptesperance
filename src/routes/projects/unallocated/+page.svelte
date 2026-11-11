<script lang="ts">
	import TransactionFilters from '#lib/components/TransactionFilters.svelte';
	import TransactionPagination from '#lib/components/TransactionPagination.svelte';
	import TransactionTable from '#lib/components/TransactionTable.svelte';

	import { m } from '#lib/paraglide/messages.js';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import FinancialSummary from '#lib/components/FinancialSummary.svelte';
	import Amount from '#lib/components/Amount.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
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
	<section class="card p-5">
		<h2 class="card-title">{m.project_by_account()}</h2>
		<ul class="mt-3 divide-y divide-stone-100">
			{#each data.by_account as account (account.account_id)}
				<li class="flex items-center justify-between gap-3 py-3">
					<a class="link" href="/accounts/{account.account_id}">{account.account_name}</a><Amount
						cents={account.amount_cents}
					/>
				</li>
			{:else}<li><EmptyState message={m.empty_state()} /></li>{/each}
		</ul>
	</section>
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
