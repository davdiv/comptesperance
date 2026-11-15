<script lang="ts">
	import type { TransactionView } from '#lib/server/queries.ts';
	import { formatDate } from '#lib/format.ts';
	import { m } from '#lib/paraglide/messages.js';
	import Amount from './Amount.svelte';
	let {
		members,
		accountNames,
		canRemove = false
	}: {
		members: Pick<TransactionView, 'account_id' | 'id' | 'date' | 'label' | 'amount_cents'>[];
		accountNames: Record<string, string>;
		canRemove?: boolean;
	} = $props();
</script>

<ul class="divide-y divide-stone-100">
	{#each members as member (member.account_id + '/' + member.id)}
		<li class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
			<a
				class="row-link min-w-0 flex-1 basis-36 [overflow-wrap:anywhere]"
				href="/transactions/{member.account_id}/{member.id}"
				><span class="block text-xs font-normal text-stone-500"
					>{accountNames[member.account_id] ?? member.account_id} · {formatDate(member.date)}</span
				>{member.label}</a
			>
			<Amount cents={member.amount_cents} class="shrink-0" />
			{#if canRemove}<form method="POST" action="?/unlink_transfer">
					<input type="hidden" name="member" value={member.account_id + ':' + member.id} /><button
						class="btn-ghost btn-sm">{m.transfer_remove_member()}</button
					>
				</form>{/if}
		</li>
	{/each}
</ul>
