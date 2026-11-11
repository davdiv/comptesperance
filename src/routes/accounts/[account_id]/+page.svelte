<script lang="ts">
	import TransactionFilters from '#lib/components/TransactionFilters.svelte';
	import TransactionPagination from '#lib/components/TransactionPagination.svelte';

	import { m } from '#lib/paraglide/messages.js';
	import { formatMoney, formatDate } from '#lib/format.ts';
	import { accountSourceLabel, checkpointSourceLabel } from '#lib/labels.ts';
	import CheckpointPanel from '#lib/components/CheckpointPanel.svelte';
	import Alert from '#lib/components/Alert.svelte';
	import ReferenceFields from '#lib/components/ReferenceFields.svelte';
	import FormPanel from '#lib/components/FormPanel.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import StatCard from '#lib/components/StatCard.svelte';
	import TransactionTable from '#lib/components/TransactionTable.svelte';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
	const account = $derived(data.account);
</script>

<PageHeader title={account.name} back={{ href: '/accounts', label: m.accounts_title() }}>
	{#snippet meta()}
		<span class="badge {account.source === 'csv' ? 'badge-blue' : 'badge-neutral'}"
			>{accountSourceLabel(account.source)}</span
		>
	{/snippet}
	{#snippet actions()}
		{#if data.user.canWrite && account.source === 'csv'}
			<a href="/import" class="btn-secondary">{m.nav_import()}</a>
		{/if}
	{/snippet}
</PageHeader>

{#if account.notes}<p class="card mb-6 p-5 whitespace-pre-wrap">{account.notes}</p>{/if}

{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}

<section class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<StatCard
		label={m.account_current_balance()}
		value={formatMoney(account.current_balance_cents)}
		tone={account.current_balance_cents < 0 ? 'negative' : 'brand'}
	>
		{#snippet hint()}<span class="text-stone-500"
				>{account.anchor
					? m.checkpoint_as_of({
							date: formatDate(account.anchor.date),
							source: checkpointSourceLabel(account.anchor.source)
						})
					: m.checkpoint_zero_start()}</span
			>{/snippet}
	</StatCard>
	<StatCard label={m.account_incoming()} value={formatMoney(data.incoming_cents)} tone="positive" />
	<StatCard label={m.account_outgoing()} value={formatMoney(data.outgoing_cents)} />
</section>

{#if data.issues.length || account.mismatch_count}
	<Alert tone="warning">
		<p class="font-medium">{m.account_issues()}</p>
		<ul class="mt-1 list-disc pl-4">
			{#each data.issues as issue (issue.id)}<li>{issue.message}</li>{/each}
			{#each account.checkpoints.filter((checkpoint) => !checkpoint.ignored && checkpoint.difference_cents !== 0) as checkpoint (checkpoint.id)}
				<li>
					{m.checkpoint_issue({
						date: formatDate(checkpoint.date),
						difference: formatMoney(checkpoint.difference_cents)
					})}
				</li>
			{/each}
		</ul>
	</Alert>
{/if}

<CheckpointPanel checkpoints={account.checkpoints} canWrite={data.user.canWrite} />

{#if data.user.canWrite}
	{#if account.source === 'manual'}
		<FormPanel label={m.transaction_new()}>
			<form
				method="POST"
				action="?/add_transaction"
				class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
			>
				<label class="field">
					<span class="field-label">{m.transaction_date()}</span>
					<input name="date" type="date" required class="control" />
				</label>
				<label class="field">
					<span class="field-label">{m.transaction_amount()}</span>
					<input name="amount" required inputmode="decimal" placeholder="-12.50" class="control" />
				</label>
				<ReferenceFields
					categories={data.config.categories}
					paymentModes={data.config.paymentModes}
				/>
				<label class="field sm:col-span-2">
					<span class="field-label">{m.common_label()}</span>
					<input name="label" class="control" />
				</label>
				<label class="field sm:col-span-2">
					<span class="field-label">{m.common_description()}</span>
					<input name="description" class="control" />
				</label>
				<label class="field sm:col-span-2 lg:col-span-4">
					<span class="field-label">{m.common_notes()}</span>
					<input name="notes" class="control" />
				</label>
				<div class="flex flex-wrap items-center gap-4 sm:col-span-2 lg:col-span-4">
					<button class="btn">{m.common_create()}</button>
					<label class="flex items-center gap-2 text-sm text-stone-700">
						<input name="excluded" type="checkbox" class="checkbox" />
						{m.transaction_excluded()}
					</label>
				</div>
			</form>
		</FormPanel>
	{/if}
{/if}

<div class="mb-6">
	<TransactionFilters
		filters={data.filters}
		options={data.filterOptions}
		config={data.config}
		current={data.filterUrl}
		fixed={data.fixedFilters}
	/>
</div>
<section class="table-wrap mb-6">
	<div class="card-header">
		<h2 class="card-title">{m.transactions_title()}</h2>
		<span class="text-xs text-stone-500">{data.total}</span>
	</div>
	<TransactionTable
		transactions={data.transactions}
		filterUrl={data.filterUrl}
		fixedFilters={data.fixedFilters}
	/><TransactionPagination
		filters={data.filters}
		current={data.filterUrl}
		total={data.total}
		hidden={data.hidden_transfer_count}
	/>
</section>

{#if data.user.canWrite}
	<details class="card group">
		<summary
			class="cursor-pointer list-none px-5 py-3.5 text-sm font-medium text-stone-600 hover:text-stone-900 [&::-webkit-details-marker]:hidden"
		>
			{m.account_edit()}
		</summary>
		<form
			method="POST"
			action="?/update"
			class="grid gap-4 border-t border-stone-100 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4"
		>
			<label class="field">
				<span class="field-label">{m.account_name()}</span>
				<input name="name" value={account.name} class="control" />
			</label>
			<label class="field sm:col-span-2"
				><span class="field-label">{m.common_notes()}</span><textarea name="notes" class="control"
					>{account.notes ?? ''}</textarea
				></label
			>
			<div class="sm:col-span-2 lg:col-span-4"><button class="btn">{m.common_save()}</button></div>
		</form>
	</details>
{/if}
