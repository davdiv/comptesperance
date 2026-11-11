<script lang="ts">
	import type { TransactionView } from '$lib/server/queries';
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate } from '$lib/format';
	import Amount from './Amount.svelte';
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

<div class="rounded-lg border border-brand-100 bg-brand-50/40 p-4">
	<p class="mb-2 text-xs font-medium text-brand-800">
		{suggestion.reference ?? m.transfer_balanced()}
	</p>
	<ul class="divide-y divide-brand-100">
		{#each suggestion.members as member (member.account_id + '/' + member.id)}<li
				class="flex items-center justify-between gap-3 py-2 text-sm"
			>
				<a class="row-link min-w-0" href="/transactions/{member.account_id}/{member.id}"
					><span class="block text-xs text-stone-500"
						>{accountNames[member.account_id] ?? member.account_id} · {formatDate(
							member.date
						)}</span
					>{member.label}</a
				><Amount cents={member.amount_cents} />
			</li>{/each}
	</ul>
	{#if canWrite}<form method="POST" {action} class="mt-3">
			<input type="hidden" name="suggestion_key" value={suggestion.key} /><button
				class="btn-secondary">{m.transaction_link_transfer()}</button
			>
		</form>{/if}
</div>
