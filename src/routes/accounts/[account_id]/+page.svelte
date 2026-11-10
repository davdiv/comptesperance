<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate, formatMoney } from '$lib/format';
	import { accountSourceLabel, accountTypeLabel } from '$lib/labels';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
	const account = $derived(data.account);
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="page-title">{account.name}</h1>
			<p class="text-slate-600">
				{accountTypeLabel(account.type)} · {accountSourceLabel(account.source)}
			</p>
		</div>
		<a class="link text-sm" href="/accounts">← {m.common_back()}</a>
	</div>
	{#if form?.error}<p class="alert-error">{form.error}</p>{/if}

	<section class="grid gap-4 md:grid-cols-4">
		<div class="card p-4">
			<div class="text-sm text-slate-500">{m.account_opening_balance()}</div>
			<div class="text-xl font-semibold">
				{formatMoney(account.opening_balance_cents, account.currency)}
			</div>
		</div>
		<div class="card p-4">
			<div class="text-sm text-slate-500">{m.account_incoming()}</div>
			<div class="text-xl font-semibold text-emerald-700">
				{formatMoney(account.incoming_cents, account.currency)}
			</div>
		</div>
		<div class="card p-4">
			<div class="text-sm text-slate-500">{m.account_outgoing()}</div>
			<div class="text-xl font-semibold text-red-700">
				{formatMoney(account.outgoing_cents, account.currency)}
			</div>
		</div>
		<div class="card p-4">
			<div class="text-sm text-slate-500">{m.account_current_balance()}</div>
			<div class="text-xl font-semibold">
				{formatMoney(account.current_balance_cents, account.currency)}
			</div>
		</div>
	</section>

	{#if data.user.canWrite}
		<section class="grid gap-4 lg:grid-cols-2">
			<form method="POST" action="?/update" class="card space-y-3 p-4">
				<h2 class="font-semibold">{m.account_edit()}</h2>
				<input
					name="name"
					value={account.name}
					placeholder={m.account_name()}
					class="control w-full"
				/>
				<select name="type" class="control w-full">
					{#each data.accountTypes as type}<option value={type} selected={type === account.type}
							>{accountTypeLabel(type)}</option
						>{/each}
				</select>
				<input
					name="currency"
					value={account.currency}
					placeholder={m.account_currency()}
					class="control w-full"
				/>
				<input
					name="opening_balance"
					value={(account.opening_balance_cents / 100).toFixed(2)}
					placeholder={m.account_opening_balance()}
					class="control w-full"
				/>
				<button class="btn">{m.common_save()}</button>
			</form>
			{#if account.source === 'manual'}
				<form method="POST" action="?/add_transaction" class="card space-y-3 p-4">
					<h2 class="font-semibold">{m.transaction_new()}</h2>
					<div class="grid gap-3 sm:grid-cols-2">
						<input name="date" type="date" required class="control" />
						<input name="value_date" type="date" class="control" />
						<input name="amount" required placeholder={m.transaction_amount()} class="control" />
						<input name="label" placeholder={m.common_label()} class="control" />
						<input name="category" placeholder={m.common_category()} class="control" />
						<input name="description" placeholder={m.common_description()} class="control" />
						<input name="notes" placeholder={m.common_notes()} class="control" />
					</div>
					<label class="flex items-center gap-2 text-sm"
						><input name="counts_in_total" type="checkbox" checked />
						{m.transaction_counts_in_total()}</label
					>
					<button class="btn">{m.common_create()}</button>
				</form>
			{/if}
		</section>
	{/if}

	{#if data.issues.length}
		<section class="rounded-xl border border-amber-200 bg-amber-50 p-4">
			<h2 class="font-semibold text-amber-900">{m.import_errors()}</h2>
			<ul class="mt-2 list-disc pl-5 text-sm text-amber-900">
				{#each data.issues as issue}<li>{issue.message}</li>{/each}
			</ul>
		</section>
	{/if}

	<section class="table-wrap">
		<table class="table">
			<thead class="bg-slate-50 text-left text-slate-500">
				<tr>
					<th class="px-4 py-3">{m.common_date()}</th>
					<th class="px-4 py-3">{m.common_label()}</th>
					<th class="px-4 py-3">{m.common_third_party()}</th>
					<th class="px-4 py-3 text-right">{m.common_amount()}</th>
					<th class="px-4 py-3">{m.transaction_record_type()}</th>
					<th class="px-4 py-3">{m.common_evidence()}</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.transactions as transaction}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3 whitespace-nowrap"
							><a class="link" href="/transactions/{account.account_id}/{transaction.id}"
								>{formatDate(transaction.date)}</a
							></td
						>
						<td class="px-4 py-3">{transaction.label}</td>
						<td class="px-4 py-3">{transaction.third_party_name ?? '—'}</td>
						<td
							class="px-4 py-3 text-right font-medium {transaction.amount_cents >= 0
								? 'text-emerald-700'
								: 'text-red-700'}">{formatMoney(transaction.amount_cents, transaction.currency)}</td
						>
						<td class="px-4 py-3">{transaction.record_type}</td>
						<td class="px-4 py-3">{transaction.evidence.length}</td>
					</tr>
				{:else}
					<tr
						><td colspan="6" class="px-4 py-8 text-center text-slate-500"
							>{m.account_no_transactions()}</td
						></tr
					>
				{/each}
			</tbody>
		</table>
	</section>
</div>
