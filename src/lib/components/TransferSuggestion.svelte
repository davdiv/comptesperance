<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate, formatMoney } from '$lib/format';
	import type { TransferMatch, TransferTransaction } from '$lib/server/transfer-matcher';
	const {
		first,
		match,
		accountNames,
		canWrite,
		action
	}: {
		first: TransferTransaction;
		match: TransferMatch;
		accountNames: Record<string, string>;
		canWrite: boolean;
		action: string;
	} = $props();
</script>

<div class="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm">
	<a class="link block" href="/transactions/{match.transaction.account_id}/{match.transaction.id}"
		>{accountNames[match.transaction.account_id] ?? match.transaction.account_id} · {formatDate(
			match.transaction.date
		)} · {match.transaction.label} · {formatMoney(match.transaction.amount_cents)}</a
	>
	{#if match.reference}<p class="text-xs text-stone-500">
			{m.transfer_reference({ reference: match.reference })}
		</p>{/if}
	{#if canWrite}<form method="POST" {action}>
			<input type="hidden" name="first_account" value={first.account_id} />
			<input type="hidden" name="first_transaction" value={first.id} />
			<input
				type="hidden"
				name="counterpart"
				value={match.transaction.account_id + ':' + match.transaction.id}
			/>
			<button class="btn-secondary">{m.transaction_link_transfer()}</button>
		</form>{/if}
</div>
