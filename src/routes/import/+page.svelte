<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
</script>

<div class="max-w-2xl space-y-6">
	<PageHeader title={m.import_title()} subtitle={m.import_subtitle()} />
	{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}
	{#if form?.ok}
		<Alert tone="success">
			{m.import_success()}
			{form.result.format}: {form.result.transactions}
			{m.stat_transactions().toLowerCase()}.
		</Alert>
	{/if}
	<Alert>{m.import_duplicate_note()}</Alert>
	<form method="POST" enctype="multipart/form-data" class="card space-y-4 p-4">
		<label class="field"
			><span class="field-label">{m.import_account()}</span>
			<select name="account_id" required class="control">
				{#each data.accounts as account (account.account_id)}<option value={account.account_id}
						>{account.name}</option
					>{/each}
			</select>
		</label>
		<label class="field"
			><span class="field-label">{m.import_file()}</span>
			<input type="file" name="file" accept=".csv,text/csv" required class="file-input" />
		</label>
		<label class="field"
			><span class="field-label">{m.import_format()}</span>
			<select name="format" class="control">
				<option value="">{m.import_auto_detect()}</option>
				<option value="ccp">CCP</option>
				<option value="sumup">SumUp</option>
			</select>
		</label>
		<button class="btn">{m.import_submit()}</button>
	</form>
</div>
