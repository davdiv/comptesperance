<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';

	import PageHeader from '$lib/components/PageHeader.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FormPanel from '$lib/components/FormPanel.svelte';
	import Amount from '$lib/components/Amount.svelte';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
</script>

<div class="space-y-6">
	<PageHeader title={m.third_parties_title()} subtitle={m.third_parties_subtitle()} />
	<p class="text-sm text-stone-500">{m.third_party_perspective()}</p>
	{#if data.user.canWrite}
		<FormPanel label={m.third_party_new()} open={!!form?.error}
			><form method="POST" class="grid gap-4 sm:grid-cols-2">
				<label class="field"
					><span class="field-label">{m.third_party_name()}</span><input
						name="name"
						required
						class="control"
					/></label
				>
				<label class="field"
					><span class="field-label">{m.third_party_aliases()}</span><input
						name="aliases"
						class="control"
					/></label
				>
				<button class="btn sm:col-span-2 sm:w-fit">{m.third_party_new()}</button>
			</form></FormPanel
		>
	{/if}
	{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}
	<div class="table-wrap">
		<table class="table">
			<thead>
				<tr>
					<th>{m.third_party_name()}</th>
					<th>{m.third_party_aliases()}</th>
					<th class="num">{m.third_party_transactions()}</th>
					<th class="num">{m.transactions_total()}</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-stone-100">
				{#each data.thirdParties as party (party.id)}
					<tr class="hover:bg-stone-50">
						<td><a class="link font-medium" href="/third-parties/{party.id}">{party.name}</a></td>
						<td class="px-4 py-3 text-stone-600"
							><div class="flex flex-wrap gap-1">
								{#each party.aliases as alias, i (i)}<span class="badge badge-neutral">{alias}</span
									>{:else}—{/each}
							</div></td
						>
						<td class="num">{party.transaction_count}</td>
						<td class="num"><Amount cents={party.total_cents} signed={false} /></td>
					</tr>
				{:else}
					<tr><td colspan="4"><EmptyState message={m.empty_state()} /></td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
