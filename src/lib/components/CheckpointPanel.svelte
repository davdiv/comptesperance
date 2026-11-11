<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate, formatMoney } from '$lib/format';
	import { checkpointSourceLabel } from '$lib/labels';
	import type { ReconciledCheckpoint } from '$lib/server/balances';
	import EmptyState from './EmptyState.svelte';
	import Icon from './Icon.svelte';
	const { checkpoints, canWrite }: { checkpoints: ReconciledCheckpoint[]; canWrite: boolean } =
		$props();
</script>

<section class="card mb-6">
	<div class="card-header"><h2 class="card-title">{m.checkpoints_title()}</h2></div>
	{#if checkpoints.length}
		<div class="relative overflow-x-auto">
			<table class="table">
				<thead
					><tr
						><th>{m.common_date()}</th><th>{m.checkpoint_source()}</th><th class="num"
							>{m.checkpoint_balance()}</th
						><th class="num">{m.checkpoint_computed()}</th><th>{m.checkpoint_status()}</th
						>{#if canWrite}<th><span class="sr-only">{m.common_actions()}</span></th>{/if}</tr
					></thead
				>
				<tbody
					>{#each checkpoints as checkpoint (checkpoint.id)}
						<tr>
							<td class="whitespace-nowrap tabular-nums">{formatDate(checkpoint.date)}</td>
							<td
								><span
									class="badge {checkpoint.source === 'statement' ? 'badge-blue' : 'badge-neutral'}"
									>{checkpointSourceLabel(checkpoint.source)}</span
								>
								{#if checkpoint.statement_file}<div
										class="mt-1 max-w-48 truncate text-xs text-stone-500"
										title={checkpoint.statement_file}
									>
										{checkpoint.statement_file}
									</div>{/if}
								{#if checkpoint.note}<div class="mt-1 text-xs text-stone-500">
										{checkpoint.note}
									</div>{/if}
							</td>
							<td class="num font-medium">{formatMoney(checkpoint.balance_cents)}</td>
							<td class="num">{formatMoney(checkpoint.computed_balance_cents)}</td>
							<td>
								{#if checkpoint.difference_cents === 0}<span class="badge badge-neutral"
										>{m.checkpoint_ok()}</span
									>
								{:else}<span class="badge badge-amber"
										>{m.checkpoint_mismatch()} · {checkpoint.difference_cents > 0
											? '+'
											: ''}{formatMoney(checkpoint.difference_cents)}</span
									>{/if}
								{#if checkpoint.is_anchor}<div class="mt-1 text-xs text-stone-500">
										{m.checkpoint_anchor()}
									</div>{/if}
							</td>
							{#if canWrite}<td
									>{#if checkpoint.source === 'manual'}<form
											method="POST"
											action="?/delete_checkpoint"
											onsubmit={(event) => {
												if (!confirm(m.common_confirm_delete())) event.preventDefault();
											}}
										>
											<input type="hidden" name="checkpoint_id" value={checkpoint.id} />
											<button class="btn-icon text-red-700" aria-label={m.common_delete()}
												><Icon name="trash" /></button
											>
										</form>{/if}</td
								>{/if}
						</tr>
					{/each}</tbody
				>
			</table>
		</div>
	{:else}<EmptyState message={m.checkpoint_empty()} />{/if}
	{#if canWrite}
		<form
			method="POST"
			action="?/add_checkpoint"
			class="grid gap-4 border-t border-stone-100 p-5 sm:grid-cols-2 lg:grid-cols-4"
		>
			<label class="field"
				><span class="field-label">{m.common_date()}</span><input
					name="date"
					type="date"
					required
					class="control"
				/></label
			>
			<label class="field"
				><span class="field-label">{m.checkpoint_balance()}</span><input
					name="balance"
					inputmode="decimal"
					required
					class="control"
				/></label
			>
			<label class="field"
				><span class="field-label">{m.common_notes()}</span><input
					name="note"
					class="control"
				/></label
			>
			<button class="btn self-end">{m.checkpoint_add()}</button>
		</form>
	{/if}
</section>
