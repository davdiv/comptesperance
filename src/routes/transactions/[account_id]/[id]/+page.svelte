<script lang="ts">
	import TransferGroupSuggestion from '$lib/components/TransferGroupSuggestion.svelte';
	import TransferGroupCard from '$lib/components/TransferGroupCard.svelte';
	import TransferSuggestion from '$lib/components/TransferSuggestion.svelte';
	import AllocationEditor from '$lib/components/AllocationEditor.svelte';
	import { documentDisplayName } from '$lib/documents';
	import { m } from '$lib/paraglide/messages.js';
	import { formatDate, formatMoney } from '$lib/format';
	import { accountSourceLabel } from '$lib/labels';
	import Alert from '$lib/components/Alert.svelte';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Icon from '$lib/components/Icon.svelte';
	import Amount from '$lib/components/Amount.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import ReferenceFields from '$lib/components/ReferenceFields.svelte';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
	const transaction = $derived(data.transaction);
	const account = $derived(data.account);
	const isManual = $derived(account.source === 'manual');

	const remaining = $derived(
		transaction.amount_cents -
			transaction.allocations.reduce((sum, item) => sum + item.amount_cents, 0)
	);
	const availableProjects = $derived(
		data.projects.filter(
			(project) => !transaction.allocations.some((item) => item.project_id === project.id)
		)
	);
	const projectAllocations = $derived(
		transaction.allocations.map((allocation) => ({
			allocation,
			project: data.projects.find((project) => project.id === allocation.project_id) ?? {
				id: allocation.project_id,
				name: allocation.project_id
			}
		}))
	);
</script>

<div class="space-y-6">
	<PageHeader
		title={transaction.label || m.transactions_title()}
		subtitle={formatDate(transaction.date)}
		back={{ href: '/accounts/' + account.account_id, label: account.name }}
	>
		{#snippet actions()}<Amount
				cents={transaction.amount_cents}
				class="text-3xl font-semibold"
			/>{/snippet}
		{#snippet meta()}<span class="badge badge-blue">{accountSourceLabel(account.source)}</span
			>{#if transaction.transfer_id}<span class="badge badge-violet">{m.common_transfers()}</span
				>{/if}{#if transaction.excluded}<span class="badge badge-amber"
					>{m.transaction_excluded()}</span
				>{/if}{/snippet}
	</PageHeader>
	{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}

	<div class="grid gap-6 lg:grid-cols-3">
		<section class="space-y-6 lg:col-span-2">
			<div class="card p-4">
				<h2 class="card-title">{m.transaction_details()}</h2>
				<dl class="dl mt-4">
					<div>
						<dt class="text-stone-500">{m.transaction_date()}</dt>
						<dd>{formatDate(transaction.date)}</dd>
					</div>
					{#if !isManual}<div>
							<dt class="text-stone-500">{m.transaction_value_date()}</dt>
							<dd>{formatDate(transaction.value_date)}</dd>
						</div>
						<div>
							<dt class="text-stone-500">{m.transaction_status()}</dt>
							<dd>{transaction.status ?? '—'}</dd>
						</div>{/if}
					<div>
						<dt class="text-stone-500">{m.transaction_source()}</dt>
						<dd>{accountSourceLabel(transaction.source)}</dd>
					</div>
					<div>
						<dt class="text-stone-500">{m.transaction_transfer_id()}</dt>
						<dd>{transaction.transfer_id ?? '—'}</dd>
					</div>

					<div>
						<dt>{m.common_category()}</dt>
						<dd
							class={transaction.category_id &&
							!data.config.categories.some((c) => c.id === transaction.category_id)
								? 'text-amber-700'
								: ''}
						>
							{data.config.categories.find((c) => c.id === transaction.category_id)?.name ??
								(transaction.category_id
									? m.config_unknown() + ' (' + transaction.category_id + ')'
									: '—')}
						</dd>
					</div>
					<div>
						<dt>{m.payment_mode()}</dt>
						<dd>
							{data.config.paymentModes.find((p) => p.id === transaction.payment_mode_id)?.name ??
								(transaction.payment_mode_id
									? m.config_unknown() + ' (' + transaction.payment_mode_id + ')'
									: '—')}
						</dd>
					</div>
					<div>
						<dt>{m.common_notes()}</dt>
						<dd class="whitespace-pre-wrap">{transaction.notes || '—'}</dd>
					</div>
				</dl>
				{#if transaction.description}<p class="mt-3 text-sm text-stone-600">
						{transaction.description}
					</p>{/if}
			</div>

			{#if data.user.canWrite}
				<form method="POST" action="?/save" class="card space-y-3 p-4">
					<h2 class="card-title">{m.common_edit()}</h2>
					{#if isManual}
						<div class="grid gap-3 sm:grid-cols-2">
							<label class="field"
								><span class="field-label">{m.transaction_date()}</span><input
									name="date"
									type="date"
									value={transaction.date}
									required
									class="control"
								/></label
							>
							<label class="field"
								><span class="field-label">{m.common_amount()}</span><input
									name="amount"
									value={(transaction.amount_cents / 100).toFixed(2)}
									required
									class="control"
								/></label
							>
							<label class="field"
								><span class="field-label">{m.common_label()}</span><input
									name="label"
									value={transaction.label}
									class="control"
								/></label
							>
						</div>
						<label class="field"
							><span class="field-label">{m.common_description()}</span><input
								name="description"
								value={transaction.description ?? ''}
								class="control w-full"
							/></label
						>
					{/if}
					<div class="grid gap-3 sm:grid-cols-2">
						<ReferenceFields
							categories={data.config.categories}
							paymentModes={data.config.paymentModes}
							categoryId={transaction.category_id}
							paymentModeId={transaction.payment_mode_id}
						/>
						<label class="field"
							><span class="field-label">{m.common_third_party()}</span><select
								name="third_party_id"
								class="control"
							>
								<option value="">—</option>
								{#each data.thirdParties as party (party.id)}<option
										value={party.id}
										selected={transaction.third_party_id === party.id}>{party.name}</option
									>{/each}
							</select></label
						>
					</div>
					<label class="field"
						><span class="field-label">{m.common_notes()}</span><textarea
							name="notes"
							placeholder={m.common_notes()}
							class="control w-full"
							rows="3">{transaction.notes}</textarea
						></label
					>
					<label class="flex items-center gap-2 text-sm"
						><input
							name="excluded"
							type="checkbox"
							class="checkbox"
							checked={transaction.excluded}
						/>
						{m.transaction_excluded()}</label
					>
					<button class="btn">{m.common_save()}</button>
				</form>
			{/if}
			<section class="card p-4" id="allocations">
				<h2 class="card-title">{m.project_allocations()}</h2>
				{#if data.user.canWrite && availableProjects.length && remaining !== 0}
					<form
						method="POST"
						action="?/add_project_allocation"
						class="mt-3 grid gap-4 sm:grid-cols-2"
					>
						<label class="field"
							><span class="field-label">{m.projects_title()}</span><select
								name="project_id"
								required
								class="control"
							>
								<option value="">—</option>
								{#each availableProjects as project (project.id)}<option value={project.id}
										>{project.name}</option
									>{/each}
							</select></label
						>
						<label class="field"
							><span class="field-label">{m.common_amount()}</span><input
								name="amount"
								value={(remaining / 100).toFixed(2)}
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
						<button class="btn sm:col-span-2 sm:w-fit">{m.project_add_allocation()}</button>
					</form>
				{:else if data.user.canWrite}<p class="mt-3 text-sm text-stone-500">
						{m.allocation_add_unavailable()}
					</p>
				{/if}
				{#if projectAllocations.length}
					<ul class="mt-4 space-y-2 text-sm">
						{#each projectAllocations as item (item.project.id)}
							<li class="space-y-2 rounded bg-stone-50 px-3 py-2">
								<a class="link" href="/projects/{item.project.id}">{item.project.name}</a>
								{#if data.user.canWrite}<AllocationEditor
										accountId={transaction.account_id}
										transactionId={transaction.id}
										projectId={item.project.id}
										amount={item.allocation.amount_cents}
										note={item.allocation.note}
									/>{:else}<span>{formatMoney(item.allocation.amount_cents)}</span
									>{#if item.allocation.note}<p>{item.allocation.note}</p>{/if}{/if}
							</li>
						{/each}
					</ul>
				{:else}<EmptyState message={m.project_no_allocations()} icon="projects" />{/if}
			</section>
		</section>

		<section class="space-y-6">
			<div class="card p-4">
				<h2 class="card-title">{m.common_evidence()}</h2>
				{#if transaction.evidence.length}
					<ul class="mt-3 space-y-2 text-sm">
						{#each transaction.evidence as item (item)}
							<li class="flex items-center justify-between gap-3 rounded bg-stone-50 px-3 py-2">
								<Icon name="paperclip" /><a
									class="link min-w-0 flex-1 truncate"
									href="/documents/download?path={encodeURIComponent(item)}"
									title={item}>{documentDisplayName(item)}</a
								>
								{#if data.user.canWrite}<form method="POST" action="?/delete_evidence">
										<input type="hidden" name="path" value={item} /><button
											class="btn-icon text-red-700"
											aria-label={m.evidence_unlink()}
											title={m.evidence_unlink()}><Icon name="link" /></button
										>
									</form>{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<EmptyState message={m.transaction_no_evidence()} icon="paperclip" />
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
							multiple
							required
							accept=".pdf,.png,.jpg,.jpeg,.webp"
							class="file-input"
							aria-label={m.transaction_evidence_upload()}
						/>
						<button class="btn">{m.transaction_evidence_upload()}</button>
					</form>
					{#if data.documents.length}
						<form
							method="POST"
							action="?/link_evidence"
							class="mt-5 space-y-3 border-t border-stone-100 pt-4"
						>
							<label class="field"
								><span class="field-label">{m.evidence_existing()}</span>
								<select name="path" required class="control"
									><option value="">—</option>
									{#each data.documents as document (document.path)}<option
											value={document.path}
											title={document.path}>{documentDisplayName(document.path)}</option
										>{/each}
								</select></label
							>
							<button class="btn-secondary"><Icon name="link" />{m.evidence_link()}</button>
						</form>
					{:else}<p class="mt-4 text-xs text-stone-500">{m.evidence_no_available()}</p>{/if}
				{/if}
			</div>
			<section class="card p-4">
				<h2 class="card-title">
					{data.group ? m.transfer_group_title() : m.transaction_link_transfer()}
				</h2>
				{#each data.groupSuggestions as suggestion (suggestion.key)}<div class="mt-3">
						<TransferGroupSuggestion
							{suggestion}
							accountNames={Object.fromEntries(
								data.accounts.map((item) => [item.account_id, item.name])
							)}
							canWrite={data.user.canWrite}
							action="?/link_group_suggestion"
						/>
					</div>{/each}
				{#if !data.groupSuggestions.length && data.suggestion}<div class="mt-3">
						<TransferSuggestion
							first={transaction}
							match={data.suggestion}
							accountNames={Object.fromEntries(
								data.accounts.map((item) => [item.account_id, item.name])
							)}
							canWrite={data.user.canWrite}
							action="?/link_transfer"
						/>
					</div>{/if}
				{#if data.group}<div class="mt-4">
						<TransferGroupCard
							group={data.group}
							accountNames={Object.fromEntries(
								data.accounts.map((item) => [item.account_id, item.name])
							)}
							canWrite={data.user.canWrite}
						/>
					</div>{/if}
				{#if data.user.canWrite}<form method="POST" action="?/link_transfer" class="mt-4 space-y-4">
						<label class="field"
							><span class="field-label">{m.transaction_candidates()}</span><select
								name="counterpart"
								required
								class="control"
								><option value="">—</option
								>{#each data.candidates as candidate (candidate.value)}<option
										value={candidate.value}>{candidate.label}</option
									>{/each}</select
							></label
						>
						<button class="btn-secondary"
							>{data.group ? m.transfer_add_member() : m.transaction_link_transfer()}</button
						>
					</form>
				{:else}<EmptyState message={m.empty_state()} />{/if}
			</section>
			{#if data.sumupLinks}<section class="card">
					<div class="card-header"><h2 class="card-title">SumUp</h2></div>
					<div class="card-body space-y-3 text-sm">
						<div class="flex justify-between">
							<span>{m.sumup_gross()}</span><Amount
								cents={Number(transaction.attributes?.total_amount_cents)}
							/>
						</div>
						<div class="flex justify-between">
							<span>{m.sumup_fee()}</span><Amount
								cents={-Number(transaction.attributes?.fee_cents)}
							/>
						</div>
						<div class="flex justify-between">
							<span>{m.sumup_net()}</span><Amount
								cents={Number(transaction.attributes?.payout_cents)}
							/>
						</div>
						{#each [data.sumupLinks.fee, data.sumupLinks.payout] as item}{#if item}<a
									class="row-link block"
									href="/transactions/{item.account_id}/{item.id}"
									>{item.label} · {formatDate(item.date)}</a
								>{/if}{/each}
					</div>
				</section>{/if}
			{#if transaction.source === 'csv' && transaction.raw.some((value) => value.trim().length > 0)}<div
					class="card p-4"
				>
					<details class="mt-3 text-xs text-stone-500">
						<summary class="cursor-pointer font-medium">{m.raw_csv()}</summary>
						<pre class="mt-2 overflow-x-auto rounded bg-stone-50 p-2">{transaction.raw.join(
								' | '
							)}</pre>
					</details>
				</div>{/if}{#if isManual && data.user.canWrite}
				<form
					method="POST"
					action="?/delete"
					onsubmit={(event) => {
						if (!confirm(m.common_confirm_delete())) event.preventDefault();
					}}
				>
					<h2 class="card-title mb-3">{m.danger_zone()}</h2>
					<button class="btn-danger">{m.common_delete()}</button>
				</form>
			{/if}
		</section>
	</div>
</div>
