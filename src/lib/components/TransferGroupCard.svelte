<script lang="ts">
	import type { TransferGroup } from '#lib/server/transfer-groups.ts';
	import { m } from '#lib/paraglide/messages.js';
	import Amount from './Amount.svelte';
	import TransferMembers from './TransferMembers.svelte';
	let {
		group,
		accountNames,
		canWrite = false
	}: { group: TransferGroup; accountNames: Record<string, string>; canWrite?: boolean } = $props();
</script>

<div class="space-y-2">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<div class="flex flex-wrap gap-2">
			<span class="badge {group.balanced ? 'badge-blue' : 'badge-amber'}"
				>{group.balanced ? m.transfer_balanced() : m.transfer_unbalanced()}</span
			>{#if !group.allocations_balanced}<span class="badge badge-amber"
					>{m.transfer_allocations_unbalanced()}</span
				>{/if}
		</div>
		<div class="text-sm text-stone-500">
			{m.transfer_moved()}: <Amount
				cents={group.moved_cents}
				signed={false}
				class="font-semibold text-stone-900"
			/>{#if group.total_cents !== 0}<span class="ml-3"
					>{m.transfer_net()}: <Amount cents={group.total_cents} /></span
				>{/if}
		</div>
	</div>
	<TransferMembers members={group.members} {accountNames} canRemove={canWrite} />
	<details class="border-t border-stone-100 pt-2">
		<summary class="cursor-pointer text-xs font-medium text-stone-500"
			>{m.project_allocations()} · {group.allocations_balanced
				? m.transfer_allocations_balanced()
				: m.transfer_allocations_unbalanced()}</summary
		>
		<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
			<span>{m.account_outgoing()}: <Amount cents={group.outgoing_cents} /></span><span
				>{m.account_incoming()}: <Amount cents={group.incoming_cents} /></span
			><span>{m.transfer_net()}: <Amount cents={group.total_cents} /></span>
		</div>
		{#if group.project_totals.length}<div class="mt-2 overflow-x-auto">
				<table class="table w-full text-sm">
					<thead
						><tr
							><th>{m.nav_projects()}</th><th class="num">{m.transfer_moved()}</th><th class="num"
								>{m.transfer_net()}</th
							></tr
						></thead
					><tbody>
						{#each group.project_totals as project (project.project_id)}<tr
								><td
									><a class="link" href="/projects/{project.project_id}">{project.name}</a
									>{#if project.amount_cents !== 0}<p class="mt-1 text-xs text-stone-500">
											{m.account_outgoing()}: <Amount cents={project.outgoing_cents} /> · {m.account_incoming()}:
											<Amount cents={project.incoming_cents} />
										</p>{/if}</td
								><td class="num"><Amount cents={project.moved_cents} signed={false} /></td><td
									class="num"
									class:text-amber-800={project.amount_cents !== 0}
									><Amount cents={project.amount_cents} /></td
								></tr
							>{/each}
					</tbody>
				</table>
			</div>{:else}<p class="mt-2 text-sm text-stone-500">{m.project_no_allocations()}</p>{/if}
	</details>
</div>
