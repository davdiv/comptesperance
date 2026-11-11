<script lang="ts">
	import TransactionFilters from '#lib/components/TransactionFilters.svelte';
	import TransactionPagination from '#lib/components/TransactionPagination.svelte';
	import Amount from '#lib/components/Amount.svelte';
	import StatCard from '#lib/components/StatCard.svelte';

	import { m } from '#lib/paraglide/messages.js';

	import Alert from '#lib/components/Alert.svelte';
	import TransactionTable from '#lib/components/TransactionTable.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import FormPanel from '#lib/components/FormPanel.svelte';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
	const accountNames = $derived(
		Object.fromEntries(data.accounts.map((account) => [account.account_id, account.name]))
	);
</script>

<div class="space-y-6">
	<PageHeader
		title={data.party.name}
		subtitle={m.third_parties_subtitle()}
		back={{ href: '/third-parties', label: m.third_parties_title() }}
	>
		{#snippet meta()}{#each data.party.aliases as alias, i (i)}<span class="badge badge-neutral"
					>{alias}</span
				>{/each}{/snippet}
	</PageHeader>
	{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}

	<p class="text-sm text-stone-500">{m.third_party_perspective()}</p>
	<TransactionFilters
		filters={data.filters}
		options={data.filterOptions}
		config={data.config}
		current={data.filterUrl}
		fixed={data.fixedFilters}
	/>
	<div class="grid gap-4 sm:grid-cols-4">
		<StatCard label={m.stat_transactions()} value={data.total} />
		<div class="card px-5 py-4">
			<div class="text-xs text-stone-500">{m.transactions_total()}</div>
			<div class="mt-2 text-2xl font-semibold"><Amount cents={data.total_cents} /></div>
		</div>
		<div class="card px-5 py-4">
			<div class="text-xs text-stone-500">{m.account_incoming()}</div>
			<div class="mt-2 text-2xl font-semibold"><Amount cents={data.incoming_cents} /></div>
		</div>
		<div class="card px-5 py-4">
			<div class="text-xs text-stone-500">{m.account_outgoing()}</div>
			<div class="mt-2 text-2xl font-semibold"><Amount cents={data.outgoing_cents} /></div>
		</div>
	</div>
	<section class="table-wrap">
		<h2 class="border-b border-stone-200 px-4 py-3 font-semibold">
			{m.third_party_transactions()}
		</h2>
		<TransactionTable
			transactions={data.transactions}
			{accountNames}
			filterUrl={data.filterUrl}
			fixedFilters={data.fixedFilters}
		/>
	</section>
	<TransactionPagination
		filters={data.filters}
		current={data.filterUrl}
		total={data.total}
		hidden={data.hidden_transfer_count}
	/>
	{#if data.user.canWrite}<FormPanel label={m.third_party_edit()} open={!!form?.error}>
			<form method="POST" action="?/update" class="grid gap-4 sm:grid-cols-2">
				<label class="field"
					><span class="field-label">{m.third_party_name()}</span><input
						name="name"
						value={data.party.name}
						required
						class="control md:col-span-2"
					/></label
				>
				<label class="field"
					><span class="field-label">{m.third_party_aliases()}</span><input
						name="aliases"
						value={data.party.aliases.join(', ')}
						class="control md:col-span-2"
					/></label
				>
				<button class="btn sm:col-span-2 sm:w-fit">{m.common_save()}</button>
			</form>
			<form
				method="POST"
				action="?/delete"
				onsubmit={(event) => {
					if (!confirm(m.common_confirm_delete())) event.preventDefault();
				}}
			>
				<button class="btn-danger">{m.common_delete()}</button>
			</form>
		</FormPanel>{/if}
</div>
