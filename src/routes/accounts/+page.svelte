<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatMoney } from '$lib/format';
	import { accountSourceLabel, accountTypeLabel } from '$lib/labels';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold">{m.accounts_title()}</h1>
			<p class="text-slate-600">{m.accounts_subtitle()}</p>
		</div>
	</div>
	{#if data.user.canWrite}
		<form
			method="POST"
			class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-6"
		>
			<input
				name="name"
				required
				placeholder={m.account_name()}
				class="rounded border border-slate-300 px-3 py-2 md:col-span-2"
			/>
			<select name="type" class="rounded border border-slate-300 px-3 py-2">
				{#each data.accountTypes as type}<option value={type}>{accountTypeLabel(type)}</option
					>{/each}
			</select>
			<select name="source" class="rounded border border-slate-300 px-3 py-2">
				{#each data.sources as source}<option value={source}>{accountSourceLabel(source)}</option
					>{/each}
			</select>
			<input
				name="currency"
				value="EUR"
				placeholder={m.account_currency()}
				class="rounded border border-slate-300 px-3 py-2"
			/>
			<input
				name="opening_balance"
				placeholder={m.account_opening_balance()}
				class="rounded border border-slate-300 px-3 py-2"
			/>
			<button class="rounded bg-slate-900 px-3 py-2 text-white md:col-span-6 md:w-fit"
				>{m.account_new()}</button
			>
		</form>
	{/if}
	{#if form?.error}<p class="rounded bg-red-50 p-3 text-red-700">{form.error}</p>{/if}
	<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-500">
				<tr>
					<th class="px-4 py-3">{m.account_name()}</th>
					<th class="px-4 py-3">{m.account_type()}</th>
					<th class="px-4 py-3">{m.account_source()}</th>
					<th class="px-4 py-3 text-right">{m.account_opening_balance()}</th>
					<th class="px-4 py-3 text-right">{m.account_incoming()}</th>
					<th class="px-4 py-3 text-right">{m.account_outgoing()}</th>
					<th class="px-4 py-3 text-right">{m.account_current_balance()}</th>
					<th class="px-4 py-3 text-right">{m.account_transaction_count()}</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.accounts as account}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3"
							><a
								class="font-medium text-blue-700 hover:underline"
								href="/accounts/{account.account_id}">{account.name}</a
							></td
						>
						<td class="px-4 py-3">{accountTypeLabel(account.type as never)}</td>
						<td class="px-4 py-3">{accountSourceLabel(account.source)}</td>
						<td class="px-4 py-3 text-right"
							>{formatMoney(account.opening_balance_cents, account.currency)}</td
						>
						<td class="px-4 py-3 text-right text-emerald-700"
							>{formatMoney(account.incoming_cents, account.currency)}</td
						>
						<td class="px-4 py-3 text-right text-red-700"
							>{formatMoney(account.outgoing_cents, account.currency)}</td
						>
						<td class="px-4 py-3 text-right font-semibold"
							>{formatMoney(account.current_balance_cents, account.currency)}</td
						>
						<td class="px-4 py-3 text-right">{account.transaction_count}</td>
					</tr>
				{:else}
					<tr
						><td colspan="8" class="px-4 py-8 text-center text-slate-500">{m.empty_state()}</td></tr
					>
				{/each}
			</tbody>
		</table>
	</div>
</div>
