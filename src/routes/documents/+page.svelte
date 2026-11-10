<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
	function formatSize(size: number): string {
		if (size < 1024) return `${size} B`;
		if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
		return `${(size / (1024 * 1024)).toFixed(1)} MB`;
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="page-title">{m.documents_title()}</h1>
		<p class="text-slate-600">{m.documents_subtitle()}</p>
	</div>
	{#if form?.error}<p class="alert-error">{form.error}</p>{/if}
	{#if data.user.canWrite}
		<form
			method="POST"
			action="?/upload"
			enctype="multipart/form-data"
			class="card flex flex-wrap items-center gap-3 p-4"
		>
			<input type="file" name="file" required class="text-sm" />
			<button class="btn">{m.document_upload()}</button>
		</form>
	{/if}
	<div class="table-wrap">
		<table class="table">
			<thead class="bg-slate-50 text-left text-slate-500">
				<tr>
					<th class="px-4 py-3">{m.account_name()}</th>
					<th class="px-4 py-3">{m.document_size()}</th>
					<th class="px-4 py-3">{m.document_type()}</th>
					<th class="px-4 py-3"></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each data.documents as document}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3"
							><a class="link" href="/documents/download?path={encodeURIComponent(document.path)}"
								>{document.name}</a
							></td
						>
						<td class="px-4 py-3">{formatSize(document.size)}</td>
						<td class="px-4 py-3">{document.path.split('.').pop()}</td>
						<td class="px-4 py-3 text-right"
							>{#if data.user.canWrite}<form
									method="POST"
									action="?/delete"
									onsubmit={(event) => {
										if (!confirm(m.common_confirm_delete())) event.preventDefault();
									}}
								>
									<input type="hidden" name="path" value={document.path} /><button
										class="text-red-700 hover:underline">{m.common_delete()}</button
									>
								</form>{/if}</td
						>
					</tr>
				{:else}
					<tr
						><td colspan="4" class="px-4 py-8 text-center text-slate-500"
							>{m.document_no_documents()}</td
						></tr
					>
				{/each}
			</tbody>
		</table>
	</div>
</div>
