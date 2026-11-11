<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate } from '#lib/format.ts';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Alert from '#lib/components/Alert.svelte';
	import Amount from '#lib/components/Amount.svelte';
	import TransferGroupCard from '#lib/components/TransferGroupCard.svelte';
	import TransferGroupSuggestion from '#lib/components/TransferGroupSuggestion.svelte';
	import type { PageProps } from './$types';
	const { data, form }: PageProps = $props();
	const accountNames = $derived(
		Object.fromEntries(data.accounts.map((item) => [item.account_id, item.name]))
	);
</script>

<div class="space-y-6">
	<PageHeader title={m.nav_transfers()} subtitle={m.transfers_subtitle()} />
	{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}
	<section class="card p-5">
		<div class="mb-4 flex flex-wrap items-center justify-between gap-3">
			<h2 class="card-title">{m.transfers_suggested()}</h2>
			{#if data.user.canWrite && data.suggestions.length}<form
					method="POST"
					action="?/link_suggestion"
				>
					<input type="hidden" name="all" value="1" /><button class="btn-secondary"
						>{m.transfers_link_all()}</button
					>
				</form>{/if}
		</div>
		{#if data.suggestions.length}<div class="grid gap-4 xl:grid-cols-2">
				{#each data.suggestions as suggestion (suggestion.key)}<TransferGroupSuggestion
						{suggestion}
						{accountNames}
						canWrite={data.user.canWrite}
					/>{/each}
			</div>{:else}<EmptyState message={m.transfers_no_suggestions()} />{/if}
	</section>
	<section class="space-y-4">
		<h2 class="text-lg font-semibold">{m.transfers_groups()}</h2>
		{#each data.groups as group (group.id)}<div class="card p-5">
				<TransferGroupCard {group} {accountNames} canWrite={data.user.canWrite} />
			</div>{:else}<div class="card"><EmptyState message={m.empty_state()} /></div>{/each}
	</section>
	{#if data.user.canWrite}<details class="card p-5">
			<summary class="cursor-pointer font-medium">{m.transfers_create()}</summary>
			<form method="POST" action="?/create" class="mt-4 space-y-4">
				<p class="text-sm text-stone-500">{m.transfer_invalid()}</p>
				<div class="max-h-96 divide-y divide-stone-100 overflow-y-auto">
					{#each data.pool as item (item.account_id + '/' + item.id)}<label
							class="flex items-center gap-3 py-3 text-sm"
							><input
								class="checkbox"
								type="checkbox"
								name="members"
								value={JSON.stringify([item.account_id, item.id])}
							/><span class="min-w-0 flex-1"
								><span class="block text-xs text-stone-500"
									>{accountNames[item.account_id]} · {formatDate(item.date)}</span
								>{item.label}</span
							><Amount cents={item.amount_cents} /></label
						>{/each}
				</div>
				<button class="btn">{m.transfers_create()}</button>
			</form>
		</details>{/if}
</div>
