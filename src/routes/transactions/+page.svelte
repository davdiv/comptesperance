<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate, formatMoney } from '$lib/format';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="page-title">{m.transactions_title()}</h1>
		<p class="text-slate-600">{m.projects_subtitle()}</p>
	</div>
	<form method="GET" class="card grid gap-3 p-4 md:grid-cols-6">
		<input
			name="search"
			value={data.filters.search ?? ''}
			placeholder={m.common_search()}
			class="control md:col-span-2"
		/>
		<select name="account_id" class="control">
			<option value="">{m.import_account()}: {m.common_all()}</option>
			{#each data.accounts as account}<option
					value={account.account_id}
					selected={data.filters.account_id === account.account_id}>{account.name}</option
				>{/each}
		</select>
		<select name="third_party_id" class="control">
			<option value="">{m.common_third_party}: {m.common_all()}</option>
			{#each data.thirdParties as party}<option
					value={party.id}
					selected={data.filters.third_party_id === party.id}>{party.name}</option
				>{/each}
		</select>
		<input name="date_from" type="date" value={data.filters.date_from ?? ''} class="control" />
		<input name="date_to" type="date" value={data.filters.date_to ?? ''} class="control" />
		<label class="flex items-center gap-2 text-sm md:col-span-6">
			<input type="checkbox" name="include_transfers" value="1" checked={data.includeTransfers} />
			{m.common_include_transfers()}
		</label>
		<button class="btn md:col-span-6 md:w-fit">{m.common_search()}</button>
	</form>
	<div class="table-wrap">
		<table class="table">
			<thead class="bg-slate-50 text-left text-slate-500">
				<tr>
					<th class="px-4 py-3">{m.common_date()}</th>
					<th class="px-4 py-3">{m.import_account()}</th>
					<th class="px-4 py-3">{m.common_label()}</th>
					<th class="px-4 py-3">{m.common_third_party()}</th>
					<th class="px-4 py-3 text-right">{m.common_amount()}</th>
					<th class="px-4 py-3">{m.transaction_record_type()}</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.transactions as transaction}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3 whitespace-nowrap"
							><a class="link" href="/transactions/{transaction.account_id}/{transaction.id}"
								>{formatDate(transaction.date)}</a
							></td
						>
						<td class="px-4 py-3"
							>{data.accounts.find((account) => account.account_id === transaction.account_id)
								?.name ?? transaction.account_id}</td
						>
						<td class="px-4 py-3">{transaction.label}</td>
						<td class="px-4 py-3">{transaction.third_party_name ?? '—'}</td>
						<td
							class="px-4 py-3 text-right font-medium {transaction.amount_cents >= 0
								? 'text-emerald-700'
								: 'text-red-700'}">{formatMoney(transaction.amount_cents, transaction.currency)}</td
						>
						<td class="px-4 py-3">{transaction.record_type}</td>
					</tr>
				{:else}
					<tr
						><td colspan="6" class="px-4 py-8 text-center text-slate-500">{m.empty_state()}</td></tr
					>
				{/each}
			</tbody>
		</table>
	</div>
</div>
