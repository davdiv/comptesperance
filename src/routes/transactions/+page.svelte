<script lang="ts">
	import TransactionFilters from '#lib/components/TransactionFilters.svelte';
	import TransactionPagination from '#lib/components/TransactionPagination.svelte';

	import { m } from '#lib/paraglide/messages.js';

	import Alert from '#lib/components/Alert.svelte';
	import TransferSuggestion from '#lib/components/TransferSuggestion.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import TransactionTable from '#lib/components/TransactionTable.svelte';
	import type { PageProps } from './$types';
	import StatCard from '#lib/components/StatCard.svelte';
	import Amount from '#lib/components/Amount.svelte';

	const { data, form }: PageProps = $props();
	const accountNames = $derived(
		Object.fromEntries(data.accounts.map((a) => [a.account_id, a.name]))
	);
</script>

<div class="space-y-6">
	<PageHeader title={m.transactions_title()} subtitle={m.transactions_subtitle()} />
	{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}
	{#if data.user.canWrite && data.suggestions.length}<section class="card p-5">
			<h2 class="card-title mb-4">{m.transfers_suggested()}</h2>
			<div class="grid gap-4 lg:grid-cols-2">
				{#each data.suggestions as suggestion (suggestion.first.account_id + suggestion.first.id + suggestion.transaction.account_id + suggestion.transaction.id)}
					<div class="space-y-2">
						<a
							class="link text-sm"
							href="/transactions/{suggestion.first.account_id}/{suggestion.first.id}"
							>{accountNames[suggestion.first.account_id]} · {suggestion.first.label}</a
						>
						<TransferSuggestion
							first={suggestion.first}
							match={suggestion}
							{accountNames}
							canWrite={true}
							action="?/link_suggestion"
						/>
					</div>{/each}
			</div>
		</section>{/if}
	<TransactionFilters
		filters={data.filters}
		options={data.filterOptions}
		config={data.config}
		current={data.filterUrl}
		fixed={data.fixedFilters}
	/>
	<div class="grid gap-4 sm:grid-cols-2" data-testid="transaction-summary">
		<StatCard label={m.stat_transactions()} value={data.total}>
			{#snippet hint()}{#if data.hidden_transfer_count > 0}{m.transactions_hidden_transfers({
						count: data.hidden_transfer_count
					})}{/if}{/snippet}
		</StatCard>
		<div class="card px-5 py-4">
			<div class="text-xs font-medium text-stone-500">{m.transactions_total()}</div>
			<div class="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">
				<Amount cents={data.total_cents} />
			</div>
		</div>
	</div>
	<div class="table-wrap">
		<TransactionTable
			transactions={data.transactions}
			{accountNames}
			filterUrl={data.filterUrl}
			fixedFilters={data.fixedFilters}
		/>
	</div>
	<TransactionPagination
		filters={data.filters}
		current={data.filterUrl}
		total={data.total}
		hidden={data.hidden_transfer_count}
	/>
</div>
