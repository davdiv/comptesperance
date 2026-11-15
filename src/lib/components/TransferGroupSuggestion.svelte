<script lang="ts">
	import type { TransactionView } from '#lib/server/queries.ts';
	import { m } from '#lib/paraglide/messages.js';
	import TransferMembers from './TransferMembers.svelte';
	const {
		suggestion,
		accountNames,
		canWrite = false,
		action = '?/link_suggestion'
	}: {
		suggestion: { key: string; reference: string | null; members: TransactionView[] };
		accountNames: Record<string, string>;
		canWrite?: boolean;
		action?: string;
	} = $props();
</script>

<div class="space-y-2">
	<p class="mb-2 text-xs font-medium text-brand-800">
		{suggestion.reference ?? m.transfer_balanced()}
	</p>
	<TransferMembers members={suggestion.members} {accountNames} />
	{#if canWrite}<form method="POST" {action} class="mt-3">
			<input type="hidden" name="suggestion_key" value={suggestion.key} /><button
				class="btn-secondary">{m.transaction_link_transfer()}</button
			>
		</form>{/if}
</div>
