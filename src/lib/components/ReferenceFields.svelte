<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { Category, PaymentMode } from '$lib/types';
	const {
		categories,
		paymentModes,
		categoryId = '',
		paymentModeId = '',
		filter = false
	}: {
		categories: Category[];
		paymentModes: PaymentMode[];
		categoryId?: string;
		paymentModeId?: string;
		filter?: boolean;
	} = $props();
</script>

<label class="field">
	<span class="field-label">{m.common_category()}</span>
	<select name="category_id" class="control">
		<option value="">{filter ? m.common_all() : '—'}</option>
		{#if categoryId && !categories.some((item) => item.id === categoryId)}
			<option value={categoryId} selected>{m.config_unknown()} ({categoryId})</option>
		{/if}
		{#each ['income', 'expense'] as const as kind (kind)}
			<optgroup label={kind === 'income' ? m.category_income() : m.category_expense()}>
				{#each categories.filter((item) => item.kind === kind && (!item.archived || item.id === categoryId)) as item (item.id)}
					<option value={item.id} selected={item.id === categoryId}
						>{item.name}{item.archived ? ' · ' + m.config_archived() : ''}</option
					>
				{/each}
			</optgroup>
		{/each}
	</select>
	{#if categoryId && !categories.some((item) => item.id === categoryId)}<span
			class="text-xs text-amber-700">{m.config_unknown()} ({categoryId})</span
		>{/if}
</label>
<label class="field">
	<span class="field-label">{m.payment_mode()}</span>
	<select name="payment_mode_id" class="control">
		<option value="">{filter ? m.common_all() : '—'}</option>
		{#if paymentModeId && !paymentModes.some((item) => item.id === paymentModeId)}
			<option value={paymentModeId} selected>{m.config_unknown()} ({paymentModeId})</option>
		{/if}
		{#each paymentModes.filter((item) => !item.archived || item.id === paymentModeId) as item (item.id)}
			<option value={item.id} selected={item.id === paymentModeId}
				>{item.name}{item.archived ? ' · ' + m.config_archived() : ''}</option
			>
		{/each}
	</select>
	{#if paymentModeId && !paymentModes.some((item) => item.id === paymentModeId)}<span
			class="text-xs text-amber-700">{m.config_unknown()} ({paymentModeId})</span
		>{/if}
</label>
