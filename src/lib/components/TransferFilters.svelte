<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { filterHref } from '#lib/transaction-filters.ts';
	import FilterPanel from './FilterPanel.svelte';
	import {
		transferFields,
		type TransferFilters as TransferFilterState
	} from '#lib/transfer-filters.ts';
	let {
		filters,
		current,
		accounts,
		prefix = '',
		status = false
	}: {
		filters: TransferFilterState;
		current: string;
		accounts: { account_id: string; name: string }[];
		prefix?: string;
		status?: boolean;
	} = $props();
	const fields = $derived(transferFields.map((field) => prefix + field));
	const active = $derived(
		!!(
			filters.search ||
			filters.account_id ||
			filters.date_from ||
			filters.date_to ||
			(status && filters.balance)
		)
	);
	const resetHref = $derived(
		filterHref(
			current,
			Object.fromEntries(
				[...fields, prefix + 'limit', prefix + 'offset'].map((key) => [key, undefined])
			),
			prefix + 'offset'
		)
	);
</script>

<FilterPanel
	{current}
	{fields}
	{active}
	limit={filters.limit}
	limitKey={prefix + 'limit'}
	offsetKey={prefix + 'offset'}
	{resetHref}
>
	<label class="field"
		><span class="field-label">{m.common_search()}</span><input
			class="control"
			name={prefix + 'search'}
			value={filters.search ?? ''}
		/></label
	>
	<label class="field"
		><span class="field-label">{m.import_account()}</span><select
			class="control"
			name={prefix + 'account_id'}
			value={filters.account_id ?? ''}
			><option value="">{m.common_all()}</option
			>{#each accounts as account (account.account_id)}<option value={account.account_id}
					>{account.name}</option
				>{/each}</select
		></label
	>
	<label class="field"
		><span class="field-label">{m.date_from()}</span><input
			class="control"
			type="date"
			name={prefix + 'date_from'}
			value={filters.date_from ?? ''}
		/></label
	>
	<label class="field"
		><span class="field-label">{m.date_to()}</span><input
			class="control"
			type="date"
			name={prefix + 'date_to'}
			value={filters.date_to ?? ''}
		/></label
	>
	{#if status}<label class="field"
			><span class="field-label">{m.transfer_status()}</span><select
				class="control"
				name={prefix + 'balance'}
				value={filters.balance}
				><option value="">{m.common_all()}</option><option value="balanced"
					>{m.transfer_balanced()}</option
				><option value="unbalanced">{m.transfer_unbalanced()}</option><option
					value="allocations_unbalanced">{m.transfer_allocations_unbalanced()}</option
				></select
			></label
		>{/if}
</FilterPanel>
