<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { filterHref } from '#lib/transaction-filters.ts';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Alert from '#lib/components/Alert.svelte';
	import Pagination from '#lib/components/Pagination.svelte';
	import TransferFilters from '#lib/components/TransferFilters.svelte';
	import TransferGroupCard from '#lib/components/TransferGroupCard.svelte';
	import TransferGroupSuggestion from '#lib/components/TransferGroupSuggestion.svelte';
	import TransferCreator from '#lib/components/TransferCreator.svelte';
	import type { PageProps } from './$types';
	const { data, form }: PageProps = $props();
	const accountNames = $derived(
		Object.fromEntries(data.accounts.map((item) => [item.account_id, item.name]))
	);
</script>

<div class="space-y-6">
	<PageHeader title={m.nav_transfers()} subtitle={m.transfers_subtitle()} />
	{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}
	<TransferFilters
		filters={data.filters}
		current={data.filterUrl}
		accounts={data.accounts}
		status={data.tab === 'groups'}
	/>
	<section class="card overflow-hidden">
		<div
			class="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 sm:px-5"
		>
			<nav class="flex min-w-0 gap-4" aria-label={m.nav_transfers()}>
				{#each [['groups', m.transfers_groups(), data.groupCount], ['suggestions', m.transfers_suggested(), data.suggestionCount]] as [tab, label, count] (tab)}
					<a
						href={filterHref(data.filterUrl, { tab })}
						aria-current={data.tab === tab ? 'page' : undefined}
						class="flex min-w-0 flex-wrap items-center gap-2 border-b-2 py-4 text-sm font-medium {data.tab ===
						tab
							? 'border-brand-600 text-brand-800'
							: 'border-transparent text-stone-500 hover:text-stone-800'}"
						>{label}<span class="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
							>{count}</span
						></a
					>
				{/each}
			</nav>
			{#if data.tab === 'suggestions' && data.user.canWrite && data.suggestions.length}<form
					method="POST"
					action="?/link_suggestion"
					class="pb-3 sm:py-2"
				>
					{#each data.suggestions as suggestion (suggestion.key)}<input
							type="hidden"
							name="suggestion_key"
							value={suggestion.key}
						/>{/each}<button class="btn-secondary btn-sm">{m.transfers_link_page()}</button>
				</form>{/if}
		</div>
		<div class="divide-y divide-stone-200">
			{#if data.tab === 'groups'}
				{#each data.groups as group (group.id)}<div class="p-4 sm:px-5">
						<TransferGroupCard {group} {accountNames} canWrite={data.user.canWrite} />
					</div>{:else}<EmptyState message={m.empty_state()} />{/each}
			{:else}
				{#each data.suggestions as suggestion (suggestion.key)}<div class="p-4 sm:px-5">
						<TransferGroupSuggestion {suggestion} {accountNames} canWrite={data.user.canWrite} />
					</div>{:else}<EmptyState message={m.transfers_no_suggestions()} />{/each}
			{/if}
		</div>
	</section>
	<Pagination
		filters={data.filters}
		current={data.filterUrl}
		total={data.tab === 'groups' ? data.groupCount : data.suggestionCount}
	/>
	{#if data.user.canWrite}<TransferCreator
			pool={data.pool}
			filters={data.poolFilters}
			accounts={data.accounts}
			current={data.filterUrl + '#transfer-create'}
			success={!!form?.ok}
		/>{/if}
</div>
