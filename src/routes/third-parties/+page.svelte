<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatMoney } from '$lib/format';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-semibold">{m.third_parties_title()}</h1>
		<p class="text-slate-600">{m.third_parties_subtitle()}</p>
	</div>
	{#if data.user.canWrite}
		<form
			method="POST"
			class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3"
		>
			<input
				name="name"
				required
				placeholder={m.third_party_name()}
				class="rounded border border-slate-300 px-3 py-2 md:col-span-2"
			/>
			<input
				name="aliases"
				placeholder={m.third_party_aliases()}
				class="rounded border border-slate-300 px-3 py-2"
			/>
			<button class="rounded bg-slate-900 px-3 py-2 text-white md:col-span-3 md:w-fit"
				>{m.third_party_new()}</button
			>
		</form>
	{/if}
	{#if form?.error}<p class="rounded bg-red-50 p-3 text-red-700">{form.error}</p>{/if}
	<div class="overflow-x-auto rounded-xl border border-slate-200 bg-white">
		<table class="min-w-full divide-y divide-slate-200 text-sm">
			<thead class="bg-slate-50 text-left text-slate-500">
				<tr>
					<th class="px-4 py-3">{m.third_party_name()}</th>
					<th class="px-4 py-3">{m.third_party_aliases()}</th>
					<th class="px-4 py-3 text-right">{m.third_party_transactions()}</th>
					<th class="px-4 py-3 text-right">{m.common_amount()}</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.thirdParties as party}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3"
							><a class="font-medium text-blue-700 hover:underline" href="/third-parties/{party.id}"
								>{party.name}</a
							></td
						>
						<td class="px-4 py-3 text-slate-600">{party.aliases.join(', ') || '—'}</td>
						<td class="px-4 py-3 text-right">{party.transaction_count}</td>
						<td class="px-4 py-3 text-right">{formatMoney(party.total_cents)}</td>
					</tr>
				{:else}
					<tr
						><td colspan="4" class="px-4 py-8 text-center text-slate-500">{m.empty_state()}</td></tr
					>
				{/each}
			</tbody>
		</table>
	</div>
</div>
