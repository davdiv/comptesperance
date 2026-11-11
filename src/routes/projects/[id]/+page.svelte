<script lang="ts">
	import TransactionFilters from '#lib/components/TransactionFilters.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import TransactionPagination from '#lib/components/TransactionPagination.svelte';
	import TransactionTable from '#lib/components/TransactionTable.svelte';

	import { m } from '#lib/paraglide/messages.js';
	import Alert from '#lib/components/Alert.svelte';
	import AccountBreakdown from '#lib/components/AccountBreakdown.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import FormPanel from '#lib/components/FormPanel.svelte';
	import FinancialSummary from '#lib/components/FinancialSummary.svelte';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
</script>

<div class="space-y-6">
	<PageHeader
		title={data.project.name}
		subtitle={data.project.description ?? m.projects_subtitle()}
		back={{ href: '/projects', label: m.projects_title() }}
	>
		{#snippet actions()}
			<a
				class="btn"
				href="/projects/{encodeURIComponent(data.project.id)}/export.pdf{new URL(
					data.filterUrl,
					'http://localhost'
				).search}"
				download><Icon name="documents" />{m.pdf_export()}</a
			>
		{/snippet}
	</PageHeader>
	{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}

	<TransactionFilters
		filters={data.filters}
		options={data.filterOptions}
		config={data.config}
		current={data.filterUrl}
		fixed={data.fixedFilters}
	/>
	<FinancialSummary
		total={data.total_cents}
		incoming={data.incoming_cents}
		outgoing={data.outgoing_cents}
		transfers={data.transfer_cents}
		totalLabel={m.project_total()}
	/>
	<AccountBreakdown accounts={data.by_account} />

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
