<script lang="ts">
	import type { TransferGroup } from '$lib/server/transfer-groups';
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate } from '$lib/format';
	import Amount from './Amount.svelte';
	const {
		group,
		accountNames,
		canWrite = false
	}: { group: TransferGroup; accountNames: Record<string, string>; canWrite?: boolean } = $props();
</script>

<div class="space-y-3">
	<div class="flex flex-wrap items-center gap-2">
		<span class="badge {group.balanced ? 'badge-blue' : 'badge-amber'}"
			>{group.balanced ? m.transfer_balanced() : m.transfer_unbalanced()}</span
		><Amount cents={group.total_cents} />
	</div>
	<ul class="divide-y divide-stone-100">
		{#each group.members as member (member.account_id + '/' + member.id)}
			<li class="flex flex-wrap items-center justify-between gap-2 py-3">
				<a class="row-link min-w-0 flex-1" href="/transactions/{member.account_id}/{member.id}"
					><span class="block text-xs text-stone-500"
						>{accountNames[member.account_id] ?? member.account_id} · {formatDate(
							member.date
						)}</span
					>{member.label}</a
				>
				<Amount cents={member.amount_cents} />
				{#if canWrite}<form method="POST" action="?/unlink_transfer">
						<input type="hidden" name="member" value={member.account_id + ':' + member.id} /><button
							class="btn-ghost btn-sm">{m.common_delete()}</button
						>
					</form>{/if}
			</li>{/each}
	</ul>
	<p class="text-sm {group.allocations_balanced ? 'text-stone-500' : 'text-amber-800'}">
		{group.allocations_balanced
			? m.transfer_allocations_balanced()
			: m.transfer_allocations_unbalanced()}
	</p>
	{#each group.project_totals as project (project.project_id)}<div
			class="flex items-center justify-between gap-3 text-sm"
		>
			<a class="link" href="/projects/{project.project_id}">{project.name}</a><span
				class:text-amber-800={project.amount_cents !== 0}
				><Amount cents={project.amount_cents} /></span
			>
		</div>{/each}
</div>
