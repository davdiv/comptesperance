<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import {
		filterFields,
		resetFilterHref,
		type TransactionFilters,
		type FixedFilters,
		type FilterField
	} from '#lib/transaction-filters.ts';
	import ReferenceFields from './ReferenceFields.svelte';
	let {
		filters = {},
		options = { accounts: [], thirdParties: [], projects: [] },
		config = { categories: [], paymentModes: [] },
		current = '/transactions',
		fixed = {},
		hide = []
	}: {
		filters?: TransactionFilters;
		options?: {
			accounts: { account_id: string; name: string }[];
			thirdParties: { id: string; name: string }[];
			projects: { id: string; name: string }[];
		};
		config?: {
			categories: import('#lib/types.ts').Category[];
			paymentModes: import('#lib/types.ts').PaymentMode[];
		};
		current?: string;
		fixed?: FixedFilters;
		hide?: FilterField[];
	} = $props();
	const hidden = $derived(new Set([...Object.keys(fixed), ...hide]));
	const url = $derived(new URL(current, 'http://localhost'));
	const active = $derived(
		filterFields.some((key) => !hidden.has(key) && !!url.searchParams.get(key))
	);
	const preserved = $derived(
		[...url.searchParams].filter(
			([key]) => ![...filterFields, 'offset', 'limit'].includes(key as FilterField)
		)
	);
</script>

<details class="card" open={active}>
	<summary class="cursor-pointer px-5 py-4 text-sm font-semibold">{m.filters_title()}</summary>
	<form
		method="GET"
		action={url.pathname + url.hash}
		onsubmit={(event) => {
			event.currentTarget.action = url.pathname + window.location.hash;
		}}
		class="grid gap-4 border-t border-stone-100 p-5 sm:grid-cols-2 lg:grid-cols-3"
	>
		{#each preserved as [name, value], i (i)}<input type="hidden" {name} {value} />{/each}
		<input type="hidden" name="limit" value={filters.limit ?? 500} />
		<label class="field"
			><span class="field-label">{m.common_search()}</span><input
				name="search"
				value={filters.search ?? ''}
				class="control"
			/></label
		>
		{#if !hidden.has('account_id')}<label class="field"
				><span class="field-label">{m.import_account()}</span><select
					name="account_id"
					class="control"
					value={filters.account_id ?? ''}
					><option value="">{m.common_all()}</option
					>{#each options.accounts as account (account.account_id)}<option
							value={account.account_id}>{account.name}</option
						>{/each}</select
				></label
			>{/if}
		{#if !hidden.has('third_party_id')}<label class="field"
				><span class="field-label">{m.common_third_party()}</span><select
					name="third_party_id"
					class="control"
					value={filters.third_party_id ?? ''}
					><option value="">{m.common_all()}</option
					>{#each options.thirdParties as party (party.id)}<option value={party.id}
							>{party.name}</option
						>{/each}</select
				></label
			>{/if}
		<label class="field"
			><span class="field-label">{m.date_from()}</span><input
				class="control"
				type="date"
				name="date_from"
				value={filters.date_from ?? ''}
			/></label
		>
		<label class="field"
			><span class="field-label">{m.date_to()}</span><input
				class="control"
				type="date"
				name="date_to"
				value={filters.date_to ?? ''}
			/></label
		>
		<ReferenceFields
			categories={config.categories}
			paymentModes={config.paymentModes}
			categoryId={filters.category_id}
			paymentModeId={filters.payment_mode_id}
			filter
		/>
		{#if !hidden.has('project_id')}<label class="field"
				><span class="field-label">{m.nav_projects()}</span><select
					class="control"
					name="project_id"
					value={filters.project_id ?? ''}
					><option value="">{m.common_all()}</option
					>{#each options.projects as project (project.id)}<option value={project.id}
							>{project.name}</option
						>{/each}</select
				></label
			>{/if}
		{#if !hidden.has('allocation_status')}<label class="field"
				><span class="field-label">{m.allocation_status()}</span><select
					class="control"
					name="allocation_status"
					value={filters.allocation_status ?? ''}
					><option value="">{m.common_all()}</option><option value="allocated"
						>{m.allocation_allocated()}</option
					><option value="unallocated">{m.allocation_unallocated()}</option><option value="partial"
						>{m.allocation_partial()}</option
					></select
				></label
			>{/if}
		{#if !hidden.has('excluded')}<label class="field"
				><span class="field-label">{m.transaction_excluded()}</span><select
					class="control"
					name="excluded"
					value={filters.excluded ?? ''}
					><option value="">{m.common_all()}</option><option value="0"
						>{m.filters_not_excluded()}</option
					><option value="1">{m.filters_only_excluded()}</option></select
				></label
			>{/if}
		<label class="field"
			><span class="field-label">{m.filters_record_type()}</span><input
				class="control"
				name="record_type"
				value={filters.record_type ?? ''}
			/></label
		>
		<label class="field"
			><span class="field-label">{m.common_transfers()}</span><select
				class="control"
				name="include_transfers"
				value={filters.include_transfers ? '1' : '0'}
				><option value="0">{m.common_hide_transfers()}</option><option value="1"
					>{m.common_include_transfers()}</option
				></select
			></label
		>
		<div class="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
			<button class="btn">{m.common_search()}</button><a
				class="btn-ghost"
				href={resetFilterHref(current)}
				onclick={(event) => {
					event.currentTarget.href = resetFilterHref(window.location.href);
				}}>{m.common_reset()}</a
			>
			{#if filters.project_id && !hidden.has('project_id')}<a
					class="link text-sm"
					href="/projects/{filters.project_id}">{m.filters_open_project()}</a
				>{/if}
			{#if filters.third_party_id && !hidden.has('third_party_id')}<a
					class="link text-sm"
					href="/third-parties/{filters.third_party_id}">{m.filters_open_party()}</a
				>{/if}
		</div>
	</form>
</details>
