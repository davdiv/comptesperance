<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate, formatMoney } from '$lib/format';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="page-title">{data.project.name}</h1>
			<p class="text-slate-600">{data.project.description ?? m.projects_subtitle()}</p>
		</div>
		<div class="flex items-center gap-3 text-sm">
			<a class="link" href="/projects">← {m.common_back()}</a>
			{#if data.includeTransfers}<a class="link" href="/projects/{data.project.id}"
					>{m.common_hide_transfers()}</a
				>{:else}<a class="link" href="/projects/{data.project.id}?include_transfers=1"
					>{m.common_include_transfers()}</a
				>{/if}
		</div>
	</div>
	{#if form?.error}<p class="alert-error">{form.error}</p>{/if}

	<section class="grid gap-4 md:grid-cols-3">
		<div class="card p-4">
			<div class="text-sm text-slate-500">{m.project_total()}</div>
			<div class="page-title">{formatMoney(data.total_cents)}</div>
		</div>
		<div class="card p-4 md:col-span-2">
			<h2 class="font-semibold">{m.project_by_account()}</h2>
			<div class="mt-2 flex flex-wrap gap-2 text-sm">
				{#each data.by_account as item}<span class="rounded bg-slate-100 px-2 py-1"
						>{item.account_name ?? item.account_id}: {formatMoney(item.amount_cents)} ({item.count})</span
					>{:else}<span class="text-slate-500">{m.project_no_allocations()}</span>{/each}
			</div>
		</div>
	</section>

	{#if data.user.canWrite}
		<div class="grid gap-6 lg:grid-cols-2">
			<form method="POST" action="?/update" class="card space-y-3 p-4">
				<h2 class="font-semibold">{m.project_edit()}</h2>
				<input name="name" value={data.project.name} required class="control w-full" />
				<textarea name="description" class="control w-full" rows="3"
					>{data.project.description ?? ''}</textarea
				>
				<button class="btn">{m.common_save()}</button>
			</form>
			<form
				method="POST"
				action="?/delete"
				onsubmit={(event) => {
					if (!confirm(m.common_confirm_delete())) event.preventDefault();
				}}
			>
				<button class="rounded border border-red-300 px-3 py-2 text-sm text-red-700"
					>{m.common_delete()}</button
				>
			</form>
		</div>
	{/if}

	<section class="table-wrap">
		<h2 class="border-b border-slate-200 px-4 py-3 font-semibold">{m.project_allocations()}</h2>
		<table class="table">
			<thead class="bg-slate-50 text-left text-slate-500">
				<tr>
					<th class="px-4 py-3">{m.project_allocation_account()}</th>
					<th class="px-4 py-3">{m.common_date()}</th>
					<th class="px-4 py-3">{m.common_label()}</th>
					<th class="px-4 py-3">{m.common_third_party()}</th>
					<th class="px-4 py-3 text-right">{m.project_allocation_amount()}</th>
					<th class="px-4 py-3"></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.allocations as allocation}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3">{allocation.account_name ?? allocation.account_id}</td>
						<td class="px-4 py-3 whitespace-nowrap">{formatDate(allocation.transaction?.date)}</td>
						<td class="px-4 py-3"
							>{#if allocation.transaction}<a
									class="link"
									href="/transactions/{allocation.account_id}/{allocation.transaction_id}"
									>{allocation.transaction.label}</a
								>{:else}{allocation.transaction_id}{/if}</td
						>
						<td class="px-4 py-3">{allocation.transaction?.third_party_name ?? '—'}</td>
						<td class="px-4 py-3 text-right font-medium"
							>{formatMoney(allocation.amount_cents, allocation.transaction?.currency)}</td
						>
						<td class="px-4 py-3 text-right"
							>{#if data.user.canWrite}<form method="POST" action="?/remove_allocation">
									<input type="hidden" name="account_id" value={allocation.account_id} /><input
										type="hidden"
										name="transaction_id"
										value={allocation.transaction_id}
									/><button class="text-red-700 hover:underline">{m.common_delete()}</button>
								</form>{/if}</td
						>
					</tr>
				{:else}
					<tr
						><td colspan="6" class="px-4 py-8 text-center text-slate-500"
							>{m.project_no_allocations()}</td
						></tr
					>
				{/each}
			</tbody>
		</table>
	</section>
</div>
