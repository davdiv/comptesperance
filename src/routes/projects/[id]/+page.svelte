<script lang="ts">
	import TransactionFilters from '#lib/components/TransactionFilters.svelte';
	import TransactionPagination from '#lib/components/TransactionPagination.svelte';
	import TransactionTable from '#lib/components/TransactionTable.svelte';

	import { m } from '#lib/paraglide/messages.js';
	import { formatMoney } from '#lib/format.ts';
	import Alert from '#lib/components/Alert.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import FormPanel from '#lib/components/FormPanel.svelte';
	import Amount from '#lib/components/Amount.svelte';
	import StatCard from '#lib/components/StatCard.svelte';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
</script>

<div class="space-y-6">
	<PageHeader
		title={data.project.name}
		subtitle={data.project.description ?? m.projects_subtitle()}
		back={{ href: '/projects', label: m.projects_title() }}
	></PageHeader>
	{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}

	<TransactionFilters
		filters={data.filters}
		options={data.filterOptions}
		config={data.config}
		current={data.filterUrl}
		fixed={data.fixedFilters}
	/>
	<section class="grid gap-4 md:grid-cols-3">
		<StatCard
			label={m.project_total()}
			value={formatMoney(data.total_cents)}
			tone={data.total_cents < 0 ? 'negative' : 'brand'}
		/>
		<div class="card p-4 md:col-span-2">
			<h2 class="font-semibold">{m.project_by_account()}</h2>
			<ul class="mt-3 divide-y divide-stone-100 text-sm">
				{#each data.by_account as item (item.account_id)}
					<li class="flex items-center justify-between gap-4 py-3">
						<div class="min-w-0">
							<a class="link font-medium" href="/accounts/{item.account_id}"
								>{item.account_name ?? item.account_id}</a
							>
							<p class="mt-0.5 text-xs text-stone-500">
								{item.count}
								{m.project_allocations().toLowerCase()}
							</p>
						</div>
						<Amount
							cents={item.amount_cents}
							signed={false}
							class="shrink-0 text-right font-medium tabular-nums"
						/>
					</li>
				{:else}<li><EmptyState message={m.project_no_allocations()} /></li>{/each}
			</ul>
		</div>
	</section>

	<section class="table-wrap">
		<h2 class="card-header card-title">{m.project_allocations()}</h2>
		<TransactionTable
			transactions={data.transactions ??
				data.allocations.flatMap((a) => (a.transaction ? [a.transaction] : []))}
			accountNames={Object.fromEntries(
				data.filterOptions?.accounts.map((a) => [a.account_id, a.name]) ?? []
			)}
			filterUrl={data.filterUrl}
			fixedFilters={data.fixedFilters}
			projectId={data.project.id}
			canWrite={data.user.canWrite}
		/>
	</section>
	<TransactionPagination
		filters={data.filters}
		current={data.filterUrl}
		total={data.transaction_count}
		hidden={data.hidden_transfer_count}
	/>
	{#if data.user.canWrite}<FormPanel label={m.project_edit()} open={!!form?.error}>
			<form method="POST" action="?/update" class="space-y-4">
				<h2 class="font-semibold">{m.project_edit()}</h2>
				<label class="field"
					><span class="field-label">{m.project_name()}</span><input
						name="name"
						value={data.project.name}
						required
						class="control w-full"
					/></label
				>
				<label class="field"
					><span class="field-label">{m.common_description()}</span><textarea
						name="description"
						class="control w-full"
						rows="3">{data.project.description ?? ''}</textarea
					></label
				>
				<button class="btn">{m.common_save()}</button>
			</form>
			<form
				class="mt-4"
				method="POST"
				action="?/delete"
				onsubmit={(event) => {
					if (!confirm(m.project_delete_confirm())) event.preventDefault();
				}}
			>
				<button class="btn-danger">{m.common_delete()}</button>
			</form>
		</FormPanel>{/if}
</div>
