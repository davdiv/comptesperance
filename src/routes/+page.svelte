<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatMoney } from '$lib/format';
	import Amount from '$lib/components/Amount.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import TransactionTable from '$lib/components/TransactionTable.svelte';
	import type { PageProps } from './$types';

	const { data }: PageProps = $props();
	const totalBalance = $derived(
		data.accounts.reduce((sum, account) => sum + account.current_balance_cents, 0)
	);
	const transactionCount = $derived(
		data.accounts.reduce((sum, account) => sum + account.transaction_count, 0)
	);
	const accountNames = $derived(
		Object.fromEntries(data.accounts.map((account) => [account.account_id, account.name]))
	);
	const maxBalance = $derived(
		Math.max(1, ...data.accounts.map((account) => Math.abs(account.current_balance_cents)))
	);
</script>

<PageHeader title={m.dashboard_title()} subtitle={m.dashboard_subtitle()} />

<section class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
	<StatCard
		label={m.stat_balance()}
		value={formatMoney(totalBalance)}
		tone={totalBalance < 0 ? 'negative' : 'brand'}
	/>
	<StatCard label={m.stat_accounts()} value={data.accounts.length} />
	<StatCard label={m.stat_projects()} value={data.projects.length} />
	<StatCard label={m.stat_transactions()} value={transactionCount} />
</section>

<div class="grid gap-6 lg:grid-cols-5">
	<section class="card lg:col-span-3">
		<div class="card-header">
			<h2 class="card-title">{m.nav_accounts()}</h2>
			<a href="/accounts" class="link text-xs">{m.view_all()}</a>
		</div>
		{#if data.accounts.length}
			<ul class="divide-y divide-stone-100">
				{#each data.accounts as account (account.account_id)}
					<li>
						<a
							href="/accounts/{account.account_id}"
							class="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-stone-50"
						>
							<span
								class="grid size-9 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-500"
							>
								<Icon name="accounts" class="size-[18px]" />
							</span>
							<div class="min-w-0 flex-1">
								<div class="truncate text-sm font-medium text-stone-900">{account.name}</div>
								{#if account.mismatch_count}<span
										class="mt-1 inline-flex items-center gap-1 text-xs text-amber-700"
										><Icon name="alert" class="size-3" />{m.checkpoint_mismatches({
											count: account.mismatch_count
										})}</span
									>{/if}
								<div class="text-xs text-stone-500">
									{account.transaction_count}
									{m.stat_transactions().toLowerCase()}
								</div>
								<div class="mt-2 h-1 overflow-hidden rounded-full bg-stone-100">
									<div
										class="h-full rounded-full {account.current_balance_cents < 0
											? 'bg-red-400'
											: 'bg-brand-500'}"
										style="width: {(Math.abs(account.current_balance_cents) / maxBalance) * 100}%"
									></div>
								</div>
							</div>
							<div
								class="text-right text-sm font-semibold tabular-nums {account.current_balance_cents <
								0
									? 'text-red-700'
									: 'text-stone-900'}"
							>
								{formatMoney(account.current_balance_cents)}
							</div>
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<EmptyState message={m.empty_state()} icon="accounts" />
		{/if}
	</section>

	<section class="card lg:col-span-2">
		<div class="card-header">
			<h2 class="card-title">{m.nav_projects()}</h2>
			<a href="/projects" class="link text-xs">{m.view_all()}</a>
		</div>
		{#if data.projects.length}
			<ul class="divide-y divide-stone-100">
				{#each data.projects as project (project.id)}
					<li>
						<a
							href="/projects/{project.id}"
							class="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-stone-50"
						>
							<div class="min-w-0">
								<div class="truncate text-sm font-medium text-stone-900">{project.name}</div>
								<div class="text-xs text-stone-500">
									{project.allocation_count}
									{m.project_allocations().toLowerCase()}
								</div>
							</div>
							<Amount cents={project.total_cents} signed={false} class="text-sm font-medium" />
						</a>
					</li>
				{/each}
			</ul>
		{:else}
			<EmptyState message={m.empty_state()} icon="projects" />
		{/if}
	</section>

	<section class="card overflow-hidden lg:col-span-5">
		<div class="card-header">
			<h2 class="card-title">{m.dashboard_recent()}</h2>
			<a href="/transactions" class="link text-xs">{m.view_all()}</a>
		</div>
		<div class="overflow-x-auto">
			<TransactionTable transactions={data.recent} {accountNames} empty={m.empty_state()} />
		</div>
	</section>
</div>
