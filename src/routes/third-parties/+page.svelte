<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatMoney } from '$lib/format';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
</script>

<div class="space-y-6">
	<div>
		<h1 class="page-title">{m.third_parties_title()}</h1>
		<p class="text-slate-600">{m.third_parties_subtitle()}</p>
	</div>
	{#if data.user.canWrite}
		<form method="POST" class="card grid gap-3 p-4 md:grid-cols-3">
			<input
				name="name"
				required
				placeholder={m.third_party_name()}
				class="control md:col-span-2"
			/>
			<input name="aliases" placeholder={m.third_party_aliases()} class="control" />
			<button class="btn md:col-span-3 md:w-fit">{m.third_party_new()}</button>
		</form>
	{/if}
	{#if form?.error}<p class="alert-error">{form.error}</p>{/if}
	<div class="table-wrap">
		<table class="table">
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
							><a class="link font-medium" href="/third-parties/{party.id}">{party.name}</a></td
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
