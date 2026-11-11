<script lang="ts">
	import { documentDisplayName } from '#lib/documents.ts';
	import { m } from '#lib/paraglide/messages.js';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Alert from '#lib/components/Alert.svelte';
	import Icon from '#lib/components/Icon.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
	function formatSize(size: number): string {
		if (size < 1024) return `${size} B`;
		if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
		return `${(size / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

<div class="space-y-6">
	<PageHeader title={m.documents_title()} subtitle={m.documents_subtitle()} />
	{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}
	{#if data.user.canWrite}
		<form
			method="POST"
			action="?/upload"
			enctype="multipart/form-data"
			class="card flex flex-wrap items-center gap-3 p-4"
		>
			<label class="field"
				><span class="field-label">{m.document_label()}</span><input
					type="file"
					name="file"
					multiple
					required
					class="file-input"
				/></label
			>
			<button class="btn">{m.document_upload()}</button>
		</form>
	{/if}
	<div class="table-wrap">
		<table class="table">
			<thead>
				<tr>
					<th>{m.account_name()}</th>
					<th>{m.document_size()}</th>
					<th>{m.document_type()}</th><th>{m.document_linked_transactions()}</th>
					<th></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-stone-100">
				{#each data.documents as document (document.path)}
					<tr class="hover:bg-stone-50">
						<td
							><a
								class="link inline-flex items-center gap-2 break-all"
								href="/documents/download?path={encodeURIComponent(document.path)}"
								title={document.path}><Icon name="file" />{documentDisplayName(document.path)}</a
							></td
						>
						<td>{formatSize(document.size)}</td>
						<td><span class="badge badge-neutral">{document.path.split('.').pop()}</span></td>
						<td
							><ul class="space-y-1">
								{#each document.transactions as transaction (transaction.account_id + transaction.id)}<li
									>
										<a
											class="link text-sm"
											href="/transactions/{transaction.account_id}/{transaction.id}"
											>{transaction.label}
											<span class="text-xs text-stone-500">· {transaction.account_name}</span></a
										>
									</li>{:else}<li class="text-stone-400">—</li>{/each}
							</ul></td
						><td class="num"
							>{#if data.user.canWrite}<form
									method="POST"
									action="?/delete"
									onsubmit={(event) => {
										if (
											!confirm(
												document.transactions.length
													? m.document_confirm_delete_linked()
													: m.common_confirm_delete()
											)
										)
											event.preventDefault();
									}}
								>
									<input type="hidden" name="path" value={document.path} /><button
										class="btn-icon text-red-700"
										aria-label={m.common_delete()}><Icon name="trash" /></button
									>
								</form>{/if}</td
						>
					</tr>
				{:else}
					<tr><td colspan="5"><EmptyState message={m.document_no_documents()} /></td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
