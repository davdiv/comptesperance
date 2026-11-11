<script lang="ts">
	import { m } from '$lib/paraglide/messages.js';

	import PageHeader from '$lib/components/PageHeader.svelte';
	import Alert from '$lib/components/Alert.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import FormPanel from '$lib/components/FormPanel.svelte';
	import Amount from '$lib/components/Amount.svelte';
	import type { PageProps } from './$types';

	const { data, form }: PageProps = $props();
</script>

<div class="space-y-6">
	<PageHeader title={m.projects_title()} subtitle={m.projects_subtitle()} />
	<a class="card block p-5 transition-colors hover:bg-stone-50" href="/projects/unallocated">
		<span class="link font-semibold">{m.unallocated_title()}</span>
		<span class="mt-1 block text-sm text-stone-500">{m.unallocated_description()}</span>
	</a>
	{#if data.user.canWrite}
		<FormPanel label={m.project_new()} open={!!form?.error}
			><form method="POST" class="grid gap-4 sm:grid-cols-2">
				<label class="field"
					><span class="field-label">{m.project_name()}</span><input
						name="name"
						required
						class="control"
					/></label
				>
				<label class="field"
					><span class="field-label">{m.common_description()}</span><input
						name="description"
						class="control"
					/></label
				>
				<button class="btn sm:col-span-2 sm:w-fit">{m.project_new()}</button>
			</form></FormPanel
		>
	{/if}
	{#if form?.error}<Alert tone="error">{form.error}</Alert>{/if}
	<div class="table-wrap">
		<table class="table">
			<thead>
				<tr>
					<th>{m.project_name()}</th>
					<th>{m.project_description()}</th>
					<th class="num">{m.project_total()}</th>
					<th class="num">{m.project_allocations()}</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-stone-100">
				{#each data.projects as project (project.id)}
					<tr class="hover:bg-stone-50">
						<td><a class="link font-medium" href="/projects/{project.id}">{project.name}</a></td>
						<td class="px-4 py-3 text-stone-600">{project.description ?? '—'}</td>
						<td class="num"><Amount cents={project.total_cents} signed={false} /></td>
						<td class="num">{project.allocation_count}</td>
					</tr>
				{:else}
					<tr><td colspan="4"><EmptyState message={m.empty_state()} /></td></tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
