<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate, formatMoney } from '$lib/format';
	import { accountSourceLabel } from '$lib/labels';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
	const transaction = $derived(data.transaction);
	const account = $derived(data.account);
	const isManual = $derived(account.source === 'manual');
	const projectAllocations = $derived(
		data.projects.flatMap((project) =>
			project.allocations
				.filter(
					(allocation) =>
						allocation.account_id === transaction.account_id &&
						allocation.transaction_id === transaction.id
				)
				.map((allocation) => ({ project, allocation }))
		)
	);
</script>

<div class="space-y-6">
	<div class="flex flex-wrap items-start justify-between gap-4">
		<div>
			<h1 class="text-2xl font-semibold">{transaction.label || m.transactions_title()}</h1>
			<p class="text-slate-600">
				{account.name} · {formatDate(transaction.date)} · {accountSourceLabel(account.source)}
			</p>
		</div>
		<div class="flex items-center gap-3">
			<span
				class="text-2xl font-semibold {transaction.amount_cents >= 0
					? 'text-emerald-700'
					: 'text-red-700'}"
			>
				{formatMoney(transaction.amount_cents, transaction.currency)}
			</span>
			<a class="text-sm text-blue-700 hover:underline" href="/accounts/{account.account_id}"
				>← {m.common_back()}</a
			>
		</div>
	</div>
	{#if form?.error}<p class="rounded bg-red-50 p-3 text-red-700">{form.error}</p>{/if}

	<div class="grid gap-6 lg:grid-cols-2">
		<section class="space-y-4">
			<div class="rounded-xl border border-slate-200 bg-white p-4">
				<h2 class="font-semibold">{m.transaction_edit()}</h2>
				<dl class="mt-3 grid grid-cols-2 gap-2 text-sm">
					<div>
						<dt class="text-slate-500">{m.transaction_date()}</dt>
						<dd>{formatDate(transaction.date)}</dd>
					</div>
					<div>
						<dt class="text-slate-500">{m.transaction_value_date()}</dt>
						<dd>{formatDate(transaction.value_date)}</dd>
					</div>
					<div>
						<dt class="text-slate-500">{m.transaction_record_type()}</dt>
						<dd>{transaction.record_type}</dd>
					</div>
					<div>
						<dt class="text-slate-500">{m.transaction_status()}</dt>
						<dd>{transaction.status ?? '—'}</dd>
					</div>
					<div>
						<dt class="text-slate-500">{m.transaction_source()}</dt>
						<dd>{accountSourceLabel(transaction.source)}</dd>
					</div>
					<div>
						<dt class="text-slate-500">{m.transaction_transfer_id()}</dt>
						<dd>{transaction.transfer_id ?? '—'}</dd>
					</div>
				</dl>
				{#if transaction.description}<p class="mt-3 text-sm text-slate-600">
						{transaction.description}
					</p>{/if}
				{#if transaction.raw.length}<details class="mt-3 text-xs text-slate-500">
						<summary>Raw CSV</summary>
						<pre class="mt-2 overflow-x-auto rounded bg-slate-50 p-2">{transaction.raw.join(
								' | '
							)}</pre>
					</details>{/if}
			</div>

			{#if data.user.canWrite}
				<form
					method="POST"
					action="?/save"
					class="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
				>
					<h2 class="font-semibold">{m.common_edit()}</h2>
					{#if isManual}
						<div class="grid gap-3 sm:grid-cols-2">
							<input
								name="date"
								type="date"
								value={transaction.date}
								required
								class="rounded border border-slate-300 px-3 py-2"
							/>
							<input
								name="value_date"
								type="date"
								value={transaction.value_date ?? ''}
								class="rounded border border-slate-300 px-3 py-2"
							/>
							<input
								name="amount"
								value={(transaction.amount_cents / 100).toFixed(2)}
								required
								class="rounded border border-slate-300 px-3 py-2"
							/>
							<input
								name="label"
								value={transaction.label}
								class="rounded border border-slate-300 px-3 py-2"
							/>
						</div>
						<input
							name="description"
							value={transaction.description ?? ''}
							placeholder={m.common_description()}
							class="w-full rounded border border-slate-300 px-3 py-2"
						/>
					{/if}
					<div class="grid gap-3 sm:grid-cols-2">
						<input
							name="category"
							value={transaction.category}
							placeholder={m.common_category()}
							class="rounded border border-slate-300 px-3 py-2"
						/>
						<select name="third_party_id" class="rounded border border-slate-300 px-3 py-2">
							<option value="">{m.common_third_party}: —</option>
							{#each data.thirdParties as party}<option
									value={party.id}
									selected={transaction.third_party_id === party.id}>{party.name}</option
								>{/each}
						</select>
					</div>
					<textarea
						name="notes"
						placeholder={m.common_notes()}
						class="w-full rounded border border-slate-300 px-3 py-2"
						rows="3">{transaction.notes}</textarea
					>
					<label class="flex items-center gap-2 text-sm"
						><input
							name="counts_in_total"
							type="checkbox"
							checked={!transaction.excluded && transaction.counts_in_total}
						/>
						{m.transaction_counts_in_total()}</label
					>
					<button class="rounded bg-slate-900 px-3 py-2 text-white">{m.common_save()}</button>
				</form>

				<section class="rounded-xl border border-slate-200 bg-white p-4">
					<h2 class="font-semibold">{m.transaction_link_transfer()}</h2>
					{#if transaction.transfer_id}
						<p class="mt-2 text-sm">
							{m.transaction_counterpart()}: {transaction.counterpart_account_id}/{transaction.counterpart_transaction_id}
						</p>
						<form method="POST" action="?/unlink_transfer" class="mt-3">
							<button class="rounded border border-slate-300 px-3 py-2 text-sm"
								>{m.transaction_unlink_transfer()}</button
							>
						</form>
					{:else}
						<form method="POST" action="?/link_transfer" class="mt-3 space-y-3">
							<select
								name="counterpart"
								required
								class="w-full rounded border border-slate-300 px-3 py-2"
							>
								<option value="">{m.transaction_candidates()}</option>
								{#each data.candidates as candidate}<option value={candidate.value}
										>{candidate.label}</option
									>{/each}
							</select>
							<button class="rounded bg-slate-900 px-3 py-2 text-white"
								>{m.transaction_link_transfer()}</button
							>
						</form>
					{/if}
				</section>

				<section class="rounded-xl border border-slate-200 bg-white p-4">
					<h2 class="font-semibold">{m.project_add_allocation()}</h2>
					<form
						method="POST"
						action="?/add_project_allocation"
						class="mt-3 grid gap-3 sm:grid-cols-4"
					>
						<select
							name="project_id"
							required
							class="rounded border border-slate-300 px-3 py-2 sm:col-span-2"
						>
							<option value="">{m.projects_title()}</option>
							{#each data.projects as project}<option value={project.id}>{project.name}</option
								>{/each}
						</select>
						<input
							name="amount"
							value={(transaction.amount_cents / 100).toFixed(2)}
							required
							placeholder={m.project_allocation_amount()}
							class="rounded border border-slate-300 px-3 py-2"
						/>
						<input
							name="note"
							placeholder={m.common_notes()}
							class="rounded border border-slate-300 px-3 py-2"
						/>
						<button class="rounded bg-slate-900 px-3 py-2 text-white sm:col-span-4 sm:w-fit"
							>{m.project_add_allocation()}</button
						>
					</form>
					{#if projectAllocations.length}
						<ul class="mt-4 space-y-2 text-sm">
							{#each projectAllocations as item}
								<li class="flex justify-between rounded bg-slate-50 px-3 py-2">
									<a class="text-blue-700 hover:underline" href="/projects/{item.project.id}"
										>{item.project.name}</a
									>
									<span>{formatMoney(item.allocation.amount_cents, transaction.currency)}</span>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}
		</section>

		<section class="space-y-4">
			<div class="rounded-xl border border-slate-200 bg-white p-4">
				<h2 class="font-semibold">{m.common_evidence()}</h2>
				{#if transaction.evidence.length}
					<ul class="mt-3 space-y-2 text-sm">
						{#each transaction.evidence as item}
							<li class="flex items-center justify-between gap-3 rounded bg-slate-50 px-3 py-2">
								<a
									class="truncate text-blue-700 hover:underline"
									href="/documents/download?path={encodeURIComponent(item)}">{item}</a
								>
								{#if data.user.canWrite}<form method="POST" action="?/delete_evidence">
										<input type="hidden" name="path" value={item} /><button
											class="text-red-700 hover:underline">{m.common_delete()}</button
										>
									</form>{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="mt-2 text-sm text-slate-500">{m.transaction_no_evidence()}</p>
				{/if}
				{#if data.user.canWrite}
					<form
						method="POST"
						action="?/upload_evidence"
						enctype="multipart/form-data"
						class="mt-4 flex flex-wrap items-center gap-3"
					>
						<input
							type="file"
							name="file"
							required
							accept=".pdf,.png,.jpg,.jpeg,.webp"
							class="text-sm"
						/>
						<button class="rounded bg-slate-900 px-3 py-2 text-white"
							>{m.transaction_evidence_upload()}</button
						>
					</form>
				{/if}
			</div>
			{#if isManual && data.user.canWrite}
				<form
					method="POST"
					action="?/delete"
					onsubmit={(event) => {
						if (!confirm(m.common_confirm_delete())) event.preventDefault();
					}}
				>
					<button class="rounded border border-red-300 px-3 py-2 text-sm text-red-700"
						>{m.common_delete()}</button
					>
				</form>
			{/if}
		</section>
	</div>
</div>
