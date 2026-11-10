<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatMoney } from '$lib/format';
	import { accountSourceLabel, accountTypeLabel } from '$lib/labels';
	import Alert from '$lib/components/Alert.svelte';
	import FormPanel from '$lib/components/FormPanel.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import TransactionTable from '$lib/components/TransactionTable.svelte';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
	const account = $derived(data.account);
</script>

<PageHeader title={account.name} back={{ href: '/accounts', label: m.accounts_title() }}>
	{#snippet meta()}
		<span class="badge badge-neutral">{accountTypeLabel(account.type)}</span>
		<span class="badge {account.source === 'csv' ? 'badge-blue' : 'badge-neutral'}"
			>{accountSourceLabel(account.source)}</span
		>
		<span class="badge badge-neutral">{account.currency}</span>
	{/snippet}
	{#snippet actions()}
		{#if data.user.canWrite && account.source === 'csv'}
			<a href="/import" class="btn-secondary">{m.nav_import()}</a>
		{/if}
	{/snippet}
</PageHeader>

{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}

<section class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<StatCard
		label={m.account_current_balance()}
		value={formatMoney(account.current_balance_cents, account.currency)}
		tone={account.current_balance_cents < 0 ? 'negative' : 'brand'}
	/>
	<StatCard
		label={m.account_opening_balance()}
		value={formatMoney(account.opening_balance_cents, account.currency)}
	/>
	<StatCard
		label={m.account_incoming()}
		value={formatMoney(account.incoming_cents, account.currency)}
		tone="positive"
	/>
	<StatCard
		label={m.account_outgoing()}
		value={formatMoney(account.outgoing_cents, account.currency)}
	/>
</section>

{#if data.issues.length}
	<Alert tone="warning">
		<p class="font-medium">{m.import_errors()}</p>
		<ul class="mt-1 list-disc pl-4">
			{#each data.issues as issue (issue.id)}<li>{issue.message}</li>{/each}
		</ul>
	</Alert>
{/if}

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
					<span class="field-label">{m.transaction_value_date()}</span>
					<input name="value_date" type="date" class="control" />
				</label>
				<label class="field">
					<span class="field-label">{m.transaction_amount()}</span>
					<input name="amount" required inputmode="decimal" placeholder="-12.50" class="control" />
				</label>
				<label class="field">
					<span class="field-label">{m.common_category()}</span>
					<input name="category" class="control" />
				</label>
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
						<input name="counts_in_total" type="checkbox" checked class="checkbox" />
						{m.transaction_counts_in_total()}
					</label>
				</div>
			</form>
		</FormPanel>
	{/if}
{/if}

<section class="table-wrap mb-6">
	<div class="card-header">
		<h2 class="card-title">{m.transactions_title()}</h2>
		<span class="text-xs text-stone-500">{data.transactions.length}</span>
	</div>
	<TransactionTable transactions={data.transactions} />
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
			<label class="field">
				<span class="field-label">{m.account_type()}</span>
				<select name="type" class="control">
					{#each data.accountTypes as type (type)}<option
							value={type}
							selected={type === account.type}>{accountTypeLabel(type)}</option
						>{/each}
				</select>
			</label>
			<label class="field">
				<span class="field-label">{m.account_currency()}</span>
				<input name="currency" value={account.currency} class="control" />
			</label>
			<label class="field">
				<span class="field-label">{m.account_opening_balance()}</span>
				<input
					name="opening_balance"
					inputmode="decimal"
					value={(account.opening_balance_cents / 100).toFixed(2)}
					class="control"
				/>
			</label>
			<div class="sm:col-span-2 lg:col-span-4"><button class="btn">{m.common_save()}</button></div>
		</form>
	</details>
{/if}
