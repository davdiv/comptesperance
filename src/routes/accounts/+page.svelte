<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatMoney } from '$lib/format';
	import { accountSourceLabel } from '$lib/labels';
	import Alert from '$lib/components/Alert.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FormPanel from '$lib/components/FormPanel.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
	const total = $derived(data.accounts.reduce((sum, a) => sum + a.current_balance_cents, 0));
</script>

<PageHeader title={m.accounts_title()} subtitle={m.accounts_subtitle()} />

{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}

{#if data.user.canWrite}
	<FormPanel label={m.account_new()} open={!!form?.error}>
		<form method="POST" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
			<label class="field lg:col-span-2">
				<span class="field-label">{m.account_name()}</span>
				<input name="name" required class="control" />
			</label>
			<label class="field">
				<span class="field-label">{m.account_source()}</span>
				<select name="source" class="control">
					{#each data.sources as source (source)}<option value={source}
							>{accountSourceLabel(source)}</option
						>{/each}
				</select>
			</label>
			<label class="field lg:col-span-3"
				><span class="field-label">{m.common_notes()}</span><textarea name="notes" class="control"
				></textarea></label
			>
			<div class="lg:col-span-6"><button class="btn">{m.common_create()}</button></div>
		</form>
	</FormPanel>
{/if}

<div class="table-wrap">
	{#if data.accounts.length}
		<table class="table">
			<thead>
				<tr>
					<th>{m.account_name()}</th>
					<th>{m.account_source()}</th>
					<th class="num">{m.account_incoming()}</th>
					<th class="num">{m.account_outgoing()}</th>
					<th class="num">{m.account_current_balance()}</th>
				</tr>
			</thead>
			<tbody>
				{#each data.accounts as account (account.account_id)}
					<tr>
						<td>
							<a href="/accounts/{account.account_id}" class="flex items-center gap-3">
								<span
									class="grid size-8 shrink-0 place-items-center rounded-lg bg-stone-100 text-stone-500"
								>
									<Icon name="accounts" />
								</span>
								<span>
									<span class="row-link block">{account.name}</span>
									<span class="text-xs text-stone-500"
										>{account.transaction_count}
										{m.account_transaction_count().toLowerCase()}</span
									>
								</span>
							</a>
						</td>
						<td>
							<span class="badge {account.source === 'csv' ? 'badge-blue' : 'badge-neutral'}"
								>{accountSourceLabel(account.source)}</span
							>
						</td>
						<td class="num text-emerald-700">{formatMoney(account.incoming_cents)}</td>
						<td class="num text-stone-600">{formatMoney(account.outgoing_cents)}</td>
						<td
							class="num font-semibold {account.current_balance_cents < 0
								? 'text-red-700'
								: 'text-stone-900'}">{formatMoney(account.current_balance_cents)}</td
						>
					</tr>
				{/each}
			</tbody>
			<tfoot>
				<tr>
					<td colspan="4" class="text-stone-500">{m.stat_balance()}</td>
					<td class="num {total < 0 ? 'text-red-700' : 'text-stone-900'}">{formatMoney(total)}</td>
				</tr>
			</tfoot>
		</table>
	{:else}
		<EmptyState message={m.empty_state()} icon="accounts" />
	{/if}
</div>
