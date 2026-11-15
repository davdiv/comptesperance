<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate } from '#lib/format.ts';
	import Amount from '#lib/components/Amount.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Pagination from '#lib/components/Pagination.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import type { PageProps } from './$types';
	const { data }: PageProps = $props();
	const labels = $derived({
		transfer_balance: m.warnings_transfer_balance(),
		transfer_allocations: m.warnings_transfer_allocations(),
		checkpoint: m.warnings_checkpoint(),
		import: m.warnings_import()
	});
</script>

<div class="space-y-6">
	<PageHeader title={m.nav_warnings()} subtitle={m.warnings_subtitle()}>
		{#snippet meta()}<span class="badge badge-neutral">{data.total}</span>{/snippet}
	</PageHeader>
	<section class="card divide-y divide-stone-100" aria-label={m.nav_warnings()}>
		{#each data.rows as warning (warning.id)}
			<article class="flex gap-3 p-4 sm:p-5">
				<Icon name="alert" class="mt-0.5 size-5 text-amber-600" />
				<div class="min-w-0 flex-1 space-y-1 [overflow-wrap:anywhere]">
					<a class="row-link" href={warning.href}>{labels[warning.kind]}</a>
					<p class="text-sm font-medium">{warning.subject ?? m.nav_import()}</p>
					{#if warning.detail}<p class="text-sm whitespace-pre-wrap text-stone-500">
							{warning.detail}
						</p>{/if}
					{#if warning.date}<p class="text-sm text-stone-500">{formatDate(warning.date)}</p>{/if}
					{#if warning.difference_cents !== undefined}<p class="text-sm text-stone-500">
							{warning.kind === 'checkpoint' ? m.warnings_difference() : m.transfer_net()}: <Amount
								cents={warning.difference_cents}
							/>
						</p>{/if}
				</div>
			</article>
		{:else}<EmptyState message={m.warnings_empty()} icon="check" />{/each}
	</section>
	<Pagination
		current={data.filterUrl}
		filters={data.filters}
		total={data.total}
		label={m.nav_warnings()}
	/>
</div>
