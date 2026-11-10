<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate, formatMoney } from '$lib/format';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
	const accountNames = $derived(
		new Map(data.accounts.map((account) => [account.account_id, account.name]))
	);
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold">{data.party.name}</h1>
			<p class="text-slate-600">{data.party.aliases.join(', ') || m.third_parties_subtitle()}</p>
		</div>
		<div class="flex items-center gap-3 text-sm">
			<a class="text-blue-700 hover:underline" href="/third-parties">← {m.common_back()}</a>
			{#if data.includeTransfers}<a
					class="text-blue-700 hover:underline"
					href="/third-parties/{data.party.id}">{m.common_hide_transfers()}</a
				>{:else}<a
					class="text-blue-700 hover:underline"
					href="/third-parties/{data.party.id}?include_transfers=1"
					>{m.common_include_transfers()}</a
				>{/if}
		</div>
	</div>
	{#if form?.error}<p class="rounded bg-red-50 p-3 text-red-700">{form.error}</p>{/if}

	{#if data.user.canWrite}
		<form
			method="POST"
			action="?/update"
			class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-4"
		>
			<input
				name="name"
				value={data.party.name}
				required
				placeholder={m.third_party_name()}
				class="rounded border border-slate-300 px-3 py-2 md:col-span-2"
			/>
			<input
				name="aliases"
				value={data.party.aliases.join(', ')}
				placeholder={m.third_party_aliases()}
				class="rounded border border-slate-300 px-3 py-2 md:col-span-2"
			/>
			<button class="rounded bg-slate-900 px-3 py-2 text-white md:col-span-4 md:w-fit"
				>{m.common_save()}</button
			>
		</form>
	{/if}

	<section class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
		<h2 class="border-b border-slate-200 px-4 py-3 font-semibold">
			{m.third_party_transactions()}
		</h2>
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-500">
				<tr>
					<th class="px-4 py-3">{m.common_date()}</th>
					<th class="px-4 py-3">{m.import_account()}</th>
					<th class="px-4 py-3">{m.common_label()}</th>
					<th class="px-4 py-3 text-right">{m.common_amount()}</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.transactions as transaction}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3 whitespace-nowrap"
							><a
								class="text-blue-700 hover:underline"
								href="/transactions/{transaction.account_id}/{transaction.id}"
								>{formatDate(transaction.date)}</a
							></td
						>
						<td class="px-4 py-3"
							>{accountNames.get(transaction.account_id) ?? transaction.account_id}</td
						>
						<td class="px-4 py-3">{transaction.label}</td>
						<td
							class="px-4 py-3 text-right font-medium {transaction.amount_cents >= 0
								? 'text-emerald-700'
								: 'text-red-700'}">{formatMoney(transaction.amount_cents, transaction.currency)}</td
						>
					</tr>
				{:else}
					<tr
						><td colspan="4" class="px-4 py-8 text-center text-slate-500"
							>{m.third_party_no_transactions()}</td
						></tr
					>
				{/each}
			</tbody>
		</table>
	</section>
</div>
