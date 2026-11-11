<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import Icon from './Icon.svelte';
	const {
		accountId,
		transactionId,
		projectId,
		amount,
		note = ''
	}: {
		accountId: string;
		transactionId: string;
		projectId: string;
		amount: number;
		note?: string;
	} = $props();
</script>

<form method="POST" action="?/edit_allocation" class="flex flex-wrap items-end gap-2">
	<input type="hidden" name="account_id" value={accountId} />
	<input type="hidden" name="transaction_id" value={transactionId} />
	<input type="hidden" name="project_id" value={projectId} />
	<label class="field"
		><span class="field-label">{m.common_amount()}</span><input
			class="control w-28"
			name="amount"
			inputmode="decimal"
			required
			value={(amount / 100).toFixed(2)}
		/></label
	>
	<label class="field min-w-24 flex-1"
		><span class="field-label">{m.common_notes()}</span><input
			class="control"
			name="note"
			value={note}
		/></label
	>
	<button class="btn-secondary" name="operation" value="save">{m.common_save()}</button>
	<button
		class="btn-icon text-red-700"
		name="operation"
		value="remove"
		formnovalidate
		aria-label={m.common_delete()}><Icon name="trash" /></button
	>
</form>
