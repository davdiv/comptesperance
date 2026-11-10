<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
</script>

<div class="max-w-3xl space-y-6">
	<div>
		<h1 class="text-2xl font-semibold">{m.import_title()}</h1>
		<p class="text-slate-600">{m.import_subtitle()}</p>
	</div>
	{#if form?.error}<p class="rounded bg-red-50 p-3 text-red-700">{form.error}</p>{/if}
	{#if form?.ok}
		<p class="rounded bg-emerald-50 p-3 text-emerald-800">
			{m.import_success()}
			{form.result.format}: {form.result.transactions} transactions.
		</p>
	{/if}
	<p class="rounded bg-slate-100 p-3 text-sm text-slate-700">{m.import_duplicate_note()}</p>
	<form
		method="POST"
		enctype="multipart/form-data"
		class="space-y-4 rounded-xl border border-slate-200 bg-white p-4"
	>
		<label class="block text-sm font-medium"
			>{m.import_account()}
			<select
				name="account_id"
				required
				class="mt-1 w-full rounded border border-slate-300 px-3 py-2"
			>
				{#each data.accounts as account}<option value={account.account_id}>{account.name}</option
					>{/each}
			</select>
		</label>
		<label class="block text-sm font-medium"
			>{m.import_file()}
			<input type="file" name="file" accept=".csv,text/csv" required class="mt-1 w-full text-sm" />
		</label>
		<label class="block text-sm font-medium"
			>Format
			<select name="format" class="mt-1 w-full rounded border border-slate-300 px-3 py-2">
				<option value="">Auto-detect</option>
				<option value="ccp">CCP</option>
				<option value="sumup">SumUp</option>
			</select>
		</label>
		<button class="rounded bg-slate-900 px-4 py-2 text-white">{m.import_submit()}</button>
	</form>
</div>
