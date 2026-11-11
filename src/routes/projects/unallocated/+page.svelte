<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import Amount from '$lib/components/Amount.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { formatDate, formatMoney } from '$lib/format';
	import type { PageProps } from './$types';
	const { data }: PageProps = $props();
</script>

<div class="space-y-6">
	<PageHeader
		title={m.unallocated_title()}
		subtitle={m.unallocated_description()}
		back={{ href: '/projects', label: m.projects_title() }}
	>
		{#snippet actions()}<a
				class="btn-secondary"
				href="/projects/unallocated{data.includeTransfers ? '' : '?include_transfers=1'}"
				>{data.includeTransfers ? m.common_hide_transfers() : m.common_include_transfers()}</a
			>{/snippet}
	</PageHeader>
	<div class="grid gap-4 sm:grid-cols-3">
		<StatCard
			label={m.account_incoming()}
			value={formatMoney(data.incoming_cents)}
			tone="positive"
		/>
		<StatCard label={m.account_outgoing()} value={formatMoney(data.outgoing_cents)} />
		<StatCard
			label={m.unallocated_net()}
			value={formatMoney(data.total_cents)}
			tone={data.total_cents < 0 ? 'negative' : 'brand'}
		/>
	</div>
	<section class="card p-5">
		<h2 class="card-title">{m.project_by_account()}</h2>
		<ul class="mt-3 divide-y divide-stone-100">
			{#each data.by_account as account (account.account_id)}
				<li class="flex items-center justify-between gap-3 py-3">
					<a class="link" href="/accounts/{account.account_id}">{account.account_name}</a><Amount
						cents={account.amount_cents}
					/>
				</li>
			{:else}<li><EmptyState message={m.empty_state()} /></li>{/each}
		</ul>
	</section>
	<section class="table-wrap">
		<div class="flex items-center justify-between gap-3 border-b border-stone-200 p-4">
			<h2 class="card-title">{m.stat_transactions()}</h2>
			<span class="text-right text-xs text-stone-500"
				>{data.transaction_count}
				{#if data.transaction_count > data.transactions.length}<span class="mt-1 block"
						>{m.transactions_hidden_transfers({
							count: data.transaction_count - data.transactions.length
						})}</span
					>{/if}
			</span>
		</div>
		<div class="overflow-x-auto">
			<table class="table">
				<thead
					><tr
						><th>{m.transaction_date()}</th><th>{m.common_label()}</th><th>{m.import_account()}</th
						><th class="num">{m.common_amount()}</th><th class="num">{m.unallocated_remainder()}</th
						>{#if data.user.canWrite}<th>{m.common_actions()}</th>{/if}</tr
					></thead
				>
				<tbody>
					{#each data.transactions as transaction (transaction.account_id + '/' + transaction.id)}
						<tr
							><td class="whitespace-nowrap">{formatDate(transaction.date)}</td><td
								><a class="row-link" href="/transactions/{transaction.account_id}/{transaction.id}"
									>{transaction.label}</a
								>{#if transaction.transfer_id}<span class="badge badge-violet ml-2"
										>{m.common_transfers()}</span
									>{/if}</td
							><td>{transaction.account_name}</td><td class="num"
								><Amount cents={transaction.amount_cents} /></td
							><td class="num"><Amount cents={transaction.unallocated_cents} /></td
							>{#if data.user.canWrite}<td
									><a
										class="btn-secondary btn-sm"
										href="/transactions/{transaction.account_id}/{transaction.id}#allocations"
										>{m.unallocated_allocate()}</a
									></td
								>{/if}</tr
						>
					{:else}<tr
							><td colspan={data.user.canWrite ? 6 : 5}><EmptyState message={m.empty_state()} /></td
							></tr
						>{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
