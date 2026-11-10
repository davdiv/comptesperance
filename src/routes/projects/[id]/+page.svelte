<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate, formatMoney } from '$lib/format';
	import Alert from '$lib/components/Alert.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import FormPanel from '$lib/components/FormPanel.svelte';
	import Amount from '$lib/components/Amount.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
</script>

<div class="space-y-6">
	<PageHeader
		title={data.project.name}
		subtitle={data.project.description ?? m.projects_subtitle()}
		back={{ href: '/projects', label: m.projects_title() }}
	>
		{#snippet actions()}<a
				class="btn-secondary"
				href="/projects/{data.project.id}{data.includeTransfers ? '' : '?include_transfers=1'}"
				>{data.includeTransfers ? m.common_hide_transfers() : m.common_include_transfers()}</a
			>{/snippet}
	</PageHeader>
	{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}

	<section class="grid gap-4 md:grid-cols-3">
		<StatCard label={m.project_total()} value={formatMoney(data.total_cents)} tone="brand" />
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
		<table class="table">
			<thead>
				<tr>
					<th>{m.project_allocation_account()}</th>
					<th>{m.common_date()}</th>
					<th>{m.common_label()}</th>
					<th>{m.common_third_party()}</th>
					<th class="num">{m.project_allocation_amount()}</th>
					<th></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-stone-100">
				{#each data.allocations as allocation (allocation.account_id + allocation.transaction_id)}
					<tr class="hover:bg-stone-50">
						<td>{allocation.account_name ?? allocation.account_id}</td>
						<td class="px-4 py-3 whitespace-nowrap">{formatDate(allocation.transaction?.date)}</td>
						<td
							>{#if allocation.transaction}<a
									class="link"
									href="/transactions/{allocation.account_id}/{allocation.transaction_id}"
									>{allocation.transaction.label}</a
								>{:else}{allocation.transaction_id}{/if}</td
						>
						<td>{allocation.transaction?.third_party_name ?? '—'}</td>
						<td class="num"
							>{formatMoney(allocation.amount_cents, allocation.transaction?.currency)}</td
						>
						<td class="num"
							>{#if data.user.canWrite}<form method="POST" action="?/remove_allocation">
									<input type="hidden" name="account_id" value={allocation.account_id} /><input
										type="hidden"
										name="transaction_id"
										value={allocation.transaction_id}
									/><button class="btn-icon text-red-700" aria-label={m.common_delete()}
										><Icon name="trash" /></button
									>
								</form>{/if}</td
						>
					</tr>
				{:else}
					<tr><td colspan="6"><EmptyState message={m.project_no_allocations()} /></td></tr>
				{/each}
			</tbody>
		</table>
	</section>
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
					if (!confirm(m.common_confirm_delete())) event.preventDefault();
				}}
			>
				<button class="btn-danger">{m.common_delete()}</button>
			</form>
		</FormPanel>{/if}
</div>
