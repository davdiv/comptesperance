<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';

	import Alert from '$lib/components/Alert.svelte';
	import TransferSuggestion from '$lib/components/TransferSuggestion.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import TransactionTable from '$lib/components/TransactionTable.svelte';
	import ReferenceFields from '$lib/components/ReferenceFields.svelte';
	import type { PageProps } from './$types';

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
	<form method="GET" class="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
		<label class="field"
			><span class="field-label">{m.common_search()}</span><span class="relative"
				><Icon name="search" class="absolute top-2.5 left-3 size-4 text-stone-400" /><input
					name="search"
					value={data.filters.search ?? ''}
					class="control w-full pl-9"
				/></span
			></label
		>
		<label class="field"
			><span class="field-label">{m.import_account()}</span><select
				name="account_id"
				class="control"
			>
				<option value="">{m.common_all()}</option>
				{#each data.accounts as account (account.account_id)}<option
						value={account.account_id}
						selected={data.filters.account_id === account.account_id}>{account.name}</option
					>{/each}
			</select></label
		>
		<label class="field"
			><span class="field-label">{m.common_third_party()}</span><select
				name="third_party_id"
				class="control"
			>
				<option value="">{m.common_all()}</option>
				{#each data.thirdParties as party (party.id)}<option
						value={party.id}
						selected={data.filters.third_party_id === party.id}>{party.name}</option
					>{/each}
			</select></label
		>
		<label class="field"
			><span class="field-label">{m.date_from()}</span><input
				name="date_from"
				type="date"
				value={data.filters.date_from ?? ''}
				class="control"
			/></label
		>
		<label class="field"
			><span class="field-label">{m.date_to()}</span><input
				name="date_to"
				type="date"
				value={data.filters.date_to ?? ''}
				class="control"
			/></label
		>
		<ReferenceFields
			categories={data.config.categories}
			paymentModes={data.config.paymentModes}
			categoryId={data.filters.category_id}
			paymentModeId={data.filters.payment_mode_id}
			filter
		/>
		<label class="field"
			><span class="field-label">{m.allocation_status()}</span>
			<select name="allocation_status" class="control" value={data.filters.allocation_status ?? ''}>
				<option value="">{m.common_all()}</option>
				<option value="allocated">{m.allocation_allocated()}</option>
				<option value="unallocated">{m.allocation_unallocated()}</option>
				<option value="partial">{m.allocation_partial()}</option>
			</select>
		</label>
		<label class="field"
			><span class="field-label">{m.nav_projects()}</span>
			<select name="project_id" class="control" value={data.filters.project_id ?? ''}>
				<option value="">{m.common_all()}</option>
				{#each data.projects as project (project.id)}<option value={project.id}
						>{project.name}</option
					>{/each}
			</select>
		</label>
		<label class="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
			<input
				type="checkbox"
				class="checkbox"
				name="include_transfers"
				value="1"
				checked={data.includeTransfers}
			/>
			{m.common_include_transfers()}
		</label>
		<div class="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
			<button class="btn">{m.common_search()}</button><a class="btn-ghost" href="/transactions"
				>{m.common_reset()}</a
			>
		</div>
	</form>
	<div class="table-wrap">
		<TransactionTable transactions={data.transactions} {accountNames} />
	</div>
</div>
